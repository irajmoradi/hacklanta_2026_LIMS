import { voice, attachment } from "spectrum-ts";
import type { config } from "./config";

export type Space = {
  send(content: string | ReturnType<typeof voice> | ReturnType<typeof attachment>): Promise<unknown>;
  responding<T>(fn: () => Promise<T>): Promise<T>;
};
export type Message = {
  id: string;
  platform: string;
  direction: string;
  sender?: { id: string };
  content: InboundContent;
  react(emoji: string): Promise<unknown>;
};
export type InboundContent = {
  type: string;
  text?: string;
  mimeType?: string;
  size?: number;
  stream?: () => unknown;
  items?: { content: InboundContent }[];
  content?: InboundContent;
};
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Use Spectrum's authenticated stream, never fetch a URL supplied in message text.
export async function downloadImage(content: InboundContent): Promise<Blob> {
  if (!content.mimeType?.toLowerCase().startsWith("image/") || !content.stream)
    throw new ApiError(415);
  if ((content.size ?? 0) > MAX_IMAGE_BYTES) throw new ApiError(413);
  const stream = await content.stream();
  if (!(stream instanceof ReadableStream)) throw new ApiError(415);
  const reader = stream.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  let expired = false;
  const timeout = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => {});
  }, 30000);
  let complete = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (expired) throw new ApiError(408);
      if (done) { complete = true; break; }
      if (!(value instanceof Uint8Array)) throw new ApiError(415);
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) throw new ApiError(413);
      parts.push(new Uint8Array(value));
    }
    return new Blob(parts, { type: content.mimeType });
  } finally {
    clearTimeout(timeout);
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function messageParts(content: InboundContent, depth = 0): InboundContent[] {
  if (depth > 4) return [];
  if (content.type === "group")
    return (content.items ?? []).flatMap(item => messageParts(item.content, depth + 1));
  if (content.type === "effect" && content.content)
    return messageParts(content.content, depth + 1);
  return [content];
}
export type OutboxItem = {
  id: string;
  phone_e164: string;
  text: string;
  audio_url: string | null;
  image_url?: string | null;
  video_url?: string | null;
  kind?: string;
};
export type Log = (
  event: string,
  fields?: Record<string, string | number>,
) => void;
export const log: Log = (event, fields = {}) =>
  console.log(
    JSON.stringify({ time: new Date().toISOString(), event, ...fields }),
  );
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`API status ${status}`);
  }
  get retryable() {
    return this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

export function apiClient(
  settings: ReturnType<typeof config>,
  fetcher: typeof fetch = fetch,
) {
  async function request(path: string, init: RequestInit = {}) {
    return fetcher(settings.api + path, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(90000),
      headers: {
        ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
        "x-service-key": settings.key,
      },
    });
  }
  return {
    async evidence(phone: string, caption: string, id: string, image: Blob) {
      const form = new FormData();
      form.set("phone_e164", phone);
      form.set("caption", caption);
      form.set("message_id", id);
      form.set("file", image, "evidence");
      const res = await request("/internal/inbound/evidence", { method: "POST", body: form });
      if (!res.ok) throw new ApiError(res.status);
      return res.json() as Promise<{ reply_text: string; processed_checkin: boolean }>;
    },
    async json<T>(path: string, body?: unknown): Promise<T> {
      const res = await request(
        path,
        body === undefined
          ? {}
          : { method: "POST", body: JSON.stringify(body) },
      );
      if (!res.ok) throw new ApiError(res.status);
      return res.json() as Promise<T>;
    },
    async audio(raw: string, image = false, video = false) {
      const url = new URL(raw, settings.api + "/");
      const base = new URL(settings.api);
      const prefix = base.pathname + "/internal/assets/";
      if (
        url.origin !== base.origin ||
        !url.pathname.startsWith(prefix) ||
        url.search ||
        url.hash
      )
        throw new ApiError(400);
      const res = await request(url.pathname.slice(base.pathname.length));
      if (!res.ok) throw new ApiError(res.status);
      const mimeType =
        res.headers.get("content-type")?.split(";")[0] ?? "audio/mpeg";
      if (!(video ? mimeType === "video/mp4" : image ? ["image/png", "image/jpeg", "image/webp"].includes(mimeType) : mimeType.startsWith("audio/"))) throw new ApiError(415);
      // talk_video guarantees H.264 + AAC MP4; no lossy second conversion is needed.
      return (image || video ? attachment : voice)(Buffer.from(await res.arrayBuffer()), {
        name: video ? "villager-gram.mp4" : image ? "portrait." + mimeType.split("/")[1] : "voice.mp3",
        mimeType,
      });
    },
  };
}

type Client = ReturnType<typeof apiClient>;
export function createHandlers(
  api: Client,
  openSpace: (phone: string) => Promise<Space>,
  logger: Log = log,
  sendEnabled = false,
) {
  // Bounded hot cache; the API persists inbound IDs across process restarts.
  const done = new Set<string>();
  const replies = new Map<
    string,
    { reply_text: string; processed_checkin: boolean }
  >();
  const inflight = new Map<string, Promise<void>>();
  const delivery = new Map<string, { text: boolean; audio: boolean; image: boolean; video: boolean }>();
  let draining = false;
  async function inbound(space: Space, message: Message) {
    if (
      message.direction !== "inbound" ||
      !message.id ||
      !message.sender?.id
    )
      return;
    const parts = messageParts(message.content);
    let photos = parts.filter(part => part.type === "attachment");
    const caption = parts.filter(part => part.type === "text").map(part => part.text ?? "").join("\n");
    if (caption.trim().toUpperCase() === "STOP") photos = [];
    if (!photos.length && !caption) return;
    if (photos.length > 20 || caption.length > 4000) throw new ApiError(413);
    const id = `${message.platform}:${message.id}`;
    if (done.has(id)) return;
    const current = inflight.get(id);
    if (current) return current;
    const work = (async () => {
      await space.responding(async () => {
        let result = replies.get(id);
        if (!result) {
          if (photos.length) {
            const results = [];
            for (const [index, photo] of photos.entries()) {
              try {
                results.push(await api.evidence(message.sender!.id, caption,
                  `${id}:photo:${index}`, await downloadImage(photo)));
              } catch (error) {
                if (!(error instanceof ApiError) || error.retryable) throw error;
                results.push({ reply_text: error.status === 413
                  ? "[AI Mayor] That photo is too large. Send an image up to 10 MiB."
                  : error.status === 415
                    ? "[AI Mayor] Send a valid JPEG, PNG or WebP photo as evidence."
                    : "[AI Mayor] I couldn't log that photo. Choose any pending competition, then resend it.",
                  processed_checkin: false });
              }
            }
            result = { reply_text: [...new Set(results.map(r => r.reply_text))].join("\n"),
              processed_checkin: results.some(r => r.processed_checkin) };
          } else result = await api.json<{
            reply_text: string;
            processed_checkin: boolean;
          }>("/internal/inbound", {
            phone_e164: message.sender!.id,
            text: caption,
            message_id: id,
          });
          replies.set(id, result);
        }
        if (sendEnabled) await space.send(result.reply_text);
        else logger("inbound_dry_run");
        done.add(id);
        replies.delete(id);
        if (done.size > 10000) done.delete(done.values().next().value!);
        if (sendEnabled && result.processed_checkin) {
          try {
            await message.react("👍");
          } catch {
            logger("reaction_failed");
          }
        }
        logger("inbound_processed");
      });
    })();
    inflight.set(id, work);
    try {
      await work;
    } finally {
      inflight.delete(id);
    }
  }
  async function drainOutbox() {
    if (draining) return;
    draining = true;
    try {
      const items = await api.json<OutboxItem[]>("/internal/outbox?limit=1");
      for (const item of items) {
        const progress = delivery.get(item.id) ?? { text: false, audio: false, image: false, video: false };
        delivery.set(item.id, progress);
        try {
          if (!sendEnabled) {
            await api.json(`/internal/outbox/${item.id}/dry-run`, {});
            delivery.delete(item.id);
            logger("outbox_dry_run", { id: item.id });
            continue;
          }
          // Fetch audio before sending anything: a bad asset must not silently become "sent".
          const audio =
            item.audio_url && !progress.audio
              ? await api.audio(item.audio_url)
              : null;
          const video = item.video_url && !progress.video ? await api.audio(item.video_url, false, true) : null;
          const picture = !item.video_url && !progress.video && item.image_url && !progress.image ? await api.audio(item.image_url, true) : null;
          if (item.kind === "villagergram") await api.json(`/internal/outbox/${item.id}/ready`, {});
          const space = await openSpace(item.phone_e164);
          if (!progress.text) {
            await space.send(
              item.kind === "villagergram" || item.text.startsWith("[AI")
                ? item.text
                : `[AI Mayor] ${item.text}`,
            );
            progress.text = true;
          }
          if (video && !progress.video) {
            await space.send(video);
            progress.video = true;
          }
          if (audio && !progress.audio) {
            await space.send(audio);
            progress.audio = true;
          }
          if (picture && !progress.image) {
            await space.send(picture);
            progress.image = true;
          }
          await api.json(`/internal/outbox/${item.id}/sent`, {});
          delivery.delete(item.id);
          logger("outbox_sent");
        } catch (error) {
          logger("outbox_failed", {
            status: error instanceof ApiError ? error.status : 0,
            // Message only (no phone numbers or payloads) so provider failures are diagnosable.
            error: String(error instanceof Error ? error.message : error).replace(/\+?\d[\d\s().-]{6,}/g, "<num>").slice(0, 200),
          });
          if (error instanceof ApiError && !error.retryable) {
            await api.json(`/internal/outbox/${item.id}/failed`, {
              error: "Delivery rejected",
            });
            delivery.delete(item.id);
          } else throw error; // Lease expires; retained progress avoids resending on an ack retry.
        }
      }
    } finally {
      draining = false;
    }
  }
  return { inbound, drainOutbox, sendEnabled };
}

export const retryDelay = (failures: number, base = 1000) =>
  Math.min(60000, base * 2 ** Math.min(failures, 10));
export async function runInbox(
  app: { messages: AsyncIterable<readonly [Space, Message]> },
  handlers: ReturnType<typeof createHandlers>,
  signal: AbortSignal,
  logger: Log = log,
) {
  for await (const [space, message] of app.messages) {
    for (let failures = 0; !signal.aborted; failures++) {
      try {
        await handlers.inbound(space, message);
        break;
      } catch (error) {
        if (error instanceof ApiError && !error.retryable) {
          logger("inbound_rejected", { status: error.status });
          try {
            if (handlers.sendEnabled) await space.send(
              "[AI Mayor] I couldn't process that message. Text help for check-ins, goals, challenges and photo evidence, or STOP.",
            );
          } catch {
            logger("reply_failed");
          }
          break;
        }
        const delay = retryDelay(failures);
        logger("inbound_retry", { delay_ms: delay });
        await pause(delay, signal);
      }
    }
    if (signal.aborted) break;
  }
}
export async function pause(ms: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}
export async function runOutbox(
  handlers: ReturnType<typeof createHandlers>,
  pollMs: number,
  signal: AbortSignal,
  logger: Log = log,
) {
  let failures = 0;
  while (!signal.aborted) {
    let delay = pollMs;
    try {
      await handlers.drainOutbox();
      failures = 0;
    } catch {
      delay = retryDelay(failures++, pollMs);
      logger("outbox_retry", { delay_ms: delay });
    }
    await pause(delay, signal);
  }
}
