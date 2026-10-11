import { expect, test } from "bun:test";
import { apiClient, createHandlers, downloadImage, MAX_IMAGE_BYTES, runInbox } from "./agent";
import type { InboundContent, Message, Space } from "./agent";
import { config } from "./config";

const settings = config({ SERVICE_KEY: "fake", VILLAGE_API_URL: "http://localhost:8911/api" }, false);
const photo = (overrides: Partial<InboundContent> = {}): InboundContent => ({
  type: "attachment", mimeType: "image/png", size: 3,
  stream: async () => new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2, 3])); c.close(); } }),
  ...overrides,
});
const message = (content: InboundContent): Message => ({
  id: "photo", platform: "imessage", direction: "inbound", sender: { id: "+15555550101" },
  content, react: async () => {},
});
const space = (sent: unknown[]): Space => ({
  send: async value => { sent.push(value); }, responding: async fn => fn(),
});

test("Spectrum grouped photos upload separately with caption, service auth and stable IDs", async () => {
  const sent: unknown[] = [], ids: string[] = [], logs: unknown[] = [];
  let calls = 0;
  const api = apiClient(settings, (async (url, init) => {
    calls++;
    expect(String(url)).toEndWith("/internal/inbound/evidence");
    expect(init?.headers).toEqual({ "x-service-key": "fake" });
    expect(init?.redirect).toBe("error");
    const form = init!.body as FormData;
    expect(form.get("phone_e164")).toBe("+15555550101");
    expect(form.get("caption")).toBe("checkin: Ran three miles");
    ids.push(String(form.get("message_id")));
    const file = form.get("file") as File;
    expect(file.type).toBe("image/png");
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3]);
    return Response.json({ reply_text: "Logged", processed_checkin: true });
  }) as typeof fetch);
  const room = space(sent);
  const handlers = createHandlers(api, async () => room, (...args) => { logs.push(args); }, true);
  const msg = message({ type: "group", items: [
    { content: { type: "text", text: "checkin: Ran three miles" } },
    { content: photo() }, { content: photo() },
  ] });
  const app = { messages: (async function* () { yield [room, msg] as const; yield [room, msg] as const; })() };
  await runInbox(app, handlers, new AbortController().signal);
  expect(calls).toBe(2);
  expect(ids).toEqual(["imessage:photo:photo:0", "imessage:photo:photo:1"]);
  expect(sent).toEqual(["Logged"]);
  expect(JSON.stringify(logs)).not.toContain("+15555550101");
  expect(JSON.stringify(logs)).not.toContain("three miles");
});

test("size and MIME metadata reject before download; stream limit cancels oversized transfer", async () => {
  let reads = 0, cancelled = false;
  const stream = async () => { reads++; return new ReadableStream(); };
  await expect(downloadImage(photo({ mimeType: "video/mp4", stream }))).rejects.toMatchObject({ status: 415 });
  await expect(downloadImage(photo({ size: MAX_IMAGE_BYTES + 1, stream }))).rejects.toMatchObject({ status: 413 });
  expect(reads).toBe(0);
  await expect(downloadImage(photo({ size: undefined, stream: async () => new ReadableStream({
    start(c) { c.enqueue(new Uint8Array(MAX_IMAGE_BYTES)); c.enqueue(new Uint8Array(1)); },
    cancel() { cancelled = true; },
  }) }))).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true);
  expect((await downloadImage(photo({ size: MAX_IMAGE_BYTES, stream: async () => new ReadableStream({
    start(c) { c.enqueue(new Uint8Array(MAX_IMAGE_BYTES)); c.close(); },
  }) }))).size).toBe(MAX_IMAGE_BYTES);
});

test("invalid photo gets a friendly reply and does not prevent a second valid photo", async () => {
  const sent: unknown[] = [];
  let calls = 0;
  const api = apiClient(settings, (async (_url: unknown) => {
    calls++;
    return Response.json({ reply_text: "Logged valid photo", processed_checkin: true });
  }) as typeof fetch);
  const room = space(sent), handlers = createHandlers(api, async () => room, () => {}, true);
  await handlers.inbound(room, message({ type: "group", items: [
    { content: photo({ mimeType: "text/html" }) }, { content: photo() },
  ] }));
  expect(calls).toBe(1);
  expect(String(sent[0])).toContain("JPEG, PNG or WebP");
  expect(String(sent[0])).toContain("Logged valid photo");
});

test("upload retries preserve IDs and failed reply retries do not redownload", async () => {
  let calls = 0, sends = 0, downloads = 0;
  const ids: string[] = [];
  const api = apiClient(settings, (async (_url, init) => {
    ids.push(String((init!.body as FormData).get("message_id")));
    if (++calls === 1) return new Response("", { status: 503 });
    return Response.json({ reply_text: "Logged", processed_checkin: false });
  }) as typeof fetch);
  const room: Space = { responding: async fn => fn(), send: async () => {
    if (++sends === 1) throw new Error("temporary send failure");
  } };
  const msg = message(photo({ stream: async () => {
    downloads++;
    return new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
  } }));
  const handlers = createHandlers(api, async () => room, () => {}, true);
  await expect(handlers.inbound(room, msg)).rejects.toThrow();
  await expect(handlers.inbound(room, msg)).rejects.toThrow();
  await handlers.inbound(room, msg);
  expect(downloads).toBe(2);
  expect(calls).toBe(2);
  expect(ids[0]).toBe(ids[1]);
});

test("unknown-phone invitation is returned without claiming a check-in", async () => {
  const sent: unknown[] = [];
  const room = space(sent);
  const api = apiClient(settings, (async (_url: unknown) => Response.json({
    reply_text: "Join the village first", processed_checkin: false,
  })) as typeof fetch);
  await createHandlers(api, async () => room, () => {}, true).inbound(room, message(photo()));
  expect(sent).toEqual(["Join the village first"]);
});

test("effect-wrapped text uses its extracted body", async () => {
  const sent: unknown[] = [];
  const room = space(sent);
  const api = apiClient(settings, (async (_url, init) => {
    expect(JSON.parse(String(init?.body)).text).toBe("my goals");
    return Response.json({ reply_text: "Your goals", processed_checkin: false });
  }) as typeof fetch);
  await createHandlers(api, async () => room, () => {}, true).inbound(room,
    message({ type: "effect", content: { type: "text", text: "my goals" } }));
  expect(sent).toEqual(["Your goals"]);
});
