import { describe, expect, test } from "bun:test";
import {
  apiClient,
  ApiError,
  createHandlers,
  retryDelay,
  runInbox,
} from "./agent";
import type { Message, Space } from "./agent";
import { config } from "./config";

const settings = config(
  { SERVICE_KEY: "fake", VILLAGE_API_URL: "http://localhost:8911/api" },
  false,
);
const message = (id = "1", overrides = {}): Message => ({
  id,
  platform: "imessage",
  direction: "inbound",
  sender: { id: "+15555550101" },
  content: { type: "text", text: "checkin: walked" },
  react: async () => {},
  ...overrides,
});
const fakeSpace = () => {
  const sent: unknown[] = [];
  const space: Space = {
    send: async (content) => {
      sent.push(content);
    },
    responding: async (fn) => fn(),
  };
  return { space, sent };
};
const fetchMock = (
  fn: (url: string, init?: RequestInit) => Promise<Response> | Response,
) =>
  ((url: unknown, init?: RequestInit) => fn(String(url), init)) as typeof fetch;
const quiet = () => {};

for (const failure of ['audio', 'ack']) test(`video precedes audio; ${failure} retry preserves progress and skips portrait`, async () => {
  const sent: unknown[] = [], fetched: string[] = [];
  let audioAttempts = 0, acknowledgements = 0;
  const api = apiClient(settings, fetchMock((url) => {
    fetched.push(url);
    if (url.endsWith('.mp4')) return new Response('mp4', {headers:{'content-type':'video/mp4'}});
    if (url.endsWith('.mp3')) return new Response('ID3', {headers:{'content-type':'audio/mpeg'}});
    if (url.endsWith('.png')) throw Error('Portrait must be skipped');
    if (url.endsWith('/sent') && failure === 'ack' && ++acknowledgements === 1) return new Response('', {status:503});
    return Response.json(url.includes('?limit') ? [{id:'video-gram',kind:'villagergram',phone_e164:'+15555550101',text:'AI avatar greeting',video_url:'/api/internal/assets/a.mp4',audio_url:'/api/internal/assets/a.mp3',image_url:'/api/internal/assets/a.png'}] : {});
  }));
  // Builders are passed through unchanged; compare the exact fetched objects to send order.
  const original = api.audio;
  let video: unknown, audio: unknown;
  api.audio = async (...args) => {
    const content = await original(...args);
    if (args[2]) video = content; else audio = content;
    return content;
  };
  const space: Space = {responding: async fn => fn(), send: async content => {
    if (content === audio && failure === 'audio' && ++audioAttempts === 1) throw Error('transient');
    sent.push(content);
  }};
  const handlers = createHandlers(api, async () => space, quiet, true);
  await expect(handlers.drainOutbox()).rejects.toThrow();
  await handlers.drainOutbox();
  expect(sent).toEqual(['AI avatar greeting', video, audio]);
  expect(fetched.filter(url => url.endsWith('.mp4'))).toHaveLength(1);
  expect(fetched.some(url => url.endsWith('.png'))).toBe(false);
});

test('video rejects external assets and non-MP4 MIME types', async () => {
  let calls = 0;
  const api = apiClient(settings, fetchMock(() => {
    calls++;
    return new Response('bad', {headers:{'content-type':'text/html'}});
  }));
  await expect(api.audio('https://elsewhere.test/a.mp4', false, true)).rejects.toThrow();
  expect(calls).toBe(0);
  await expect(api.audio('/api/internal/assets/a.mp4', false, true)).rejects.toThrow();
});

test("delivery defaults to dry run without opening a space or fetching media", async () => {
  const requests: string[] = [];
  const api = apiClient(settings, fetchMock((url) => {
    requests.push(url);
    return Response.json(url.includes("?limit") ? [{id:"dry", phone_e164:"+15555550101", text:"private", audio_url:"/api/internal/assets/x.mp3", image_url:"/api/internal/assets/x.png"}] : {});
  }));
  await createHandlers(api, async () => { throw new Error("Must not contact Photon"); }, quiet).drainOutbox();
  expect(requests.map(u => new URL(u).pathname)).toEqual(["/api/internal/outbox", "/api/internal/outbox/dry/dry-run"]);
  expect(settings.sendEnabled).toBe(false);
  expect(config({SERVICE_KEY:"fake", PHOTON_SEND_ENABLED:"true"}, false).sendEnabled).toBe(true);
});

test("Villager-gram sends labeled text, authenticated audio and portrait attachments", async () => {
  const {space, sent} = fakeSpace();
  const api = apiClient(settings, fetchMock((url, init) => {
    expect(new Headers(init?.headers).get("x-service-key")).toBe("fake");
    if (url.endsWith(".png")) return new Response(new Uint8Array([1,2]), {headers:{"content-type":"image/png"}});
    if (url.endsWith(".mp3")) return new Response("ID3", {headers:{"content-type":"audio/mpeg"}});
    return Response.json(url.includes("?limit") ? [{id:"gram",kind:"villagergram",phone_e164:"+15555550101",text:"Speaker's villager (AI voice), sent by Sender via Village: hello",audio_url:"/api/internal/assets/a.mp3",image_url:"/api/internal/assets/a.png"}] : {});
  }));
  await createHandlers(api, async () => space, quiet, true).drainOutbox();
  expect(sent).toHaveLength(3);
  expect(sent[0]).toBe("Speaker's villager (AI voice), sent by Sender via Village: hello");
});

describe("config", () => {
  test("rejects missing credentials, URLs and unsafe poll intervals", () => {
    expect(() => config({})).toThrow("SERVICE_KEY");
    expect(() => config({ SERVICE_KEY: "x" })).toThrow("PROJECT_ID");
    for (const url of [
      "file:///tmp",
      "http://secret@localhost",
      "http://localhost?secret=x",
    ])
      expect(() =>
        config({ SERVICE_KEY: "x", VILLAGE_API_URL: url }, false),
      ).toThrow();
    for (const poll of ["0", "NaN", "999999", "1.5"])
      expect(() =>
        config({ SERVICE_KEY: "x", OUTBOX_POLL_MS: poll }, false),
      ).toThrow();
    expect(retryDelay(50)).toBe(60000);
    expect(retryDelay(0)).toBe(1000);
  });
});
test("fake Spectrum stream ignores echoes, dedupes and reacts only after a check-in", async () => {
  let calls = 0,
    reactions = 0;
  const { space, sent } = fakeSpace();
  const api = apiClient(
    settings,
    fetchMock((url, init) => {
      calls++;
      expect(JSON.parse(String(init?.body)).message_id).toBe("imessage:1");
      return Response.json({ reply_text: "saved", processed_checkin: true });
    }),
  );
  const handlers = createHandlers(api, async () => space, quiet, true);
  const msg = message("1", {
    react: async (emoji: string) => {
      expect(emoji).toBe("👍");
      reactions++;
    },
  });
  const app = {
    messages: (async function* () {
      yield [space, message("echo", { direction: "outbound" })] as const;
      yield [
        space,
        message("reaction", { content: { type: "reaction" } }),
      ] as const;
      yield [space, msg] as const;
      yield [space, msg] as const;
    })(),
  };
  await runInbox(app, handlers, new AbortController().signal, quiet);
  expect([calls, reactions, sent.length]).toEqual([1, 1, 1]);
});
test("failed response delivery retries cached API result; reaction failure doesn't resend", async () => {
  let calls = 0,
    sends = 0;
  const space: Space = {
    responding: async (fn) => fn(),
    send: async () => {
      if (++sends === 1) throw Error();
    },
  };
  const api = apiClient(
    settings,
    fetchMock(() => {
      calls++;
      return Response.json({ reply_text: "saved", processed_checkin: true });
    }),
  );
  const handlers = createHandlers(api, async () => space, quiet, true);
  const msg = message("retry", {
    react: async () => {
      throw Error();
    },
  });
  await expect(handlers.inbound(space, msg)).rejects.toThrow();
  await handlers.inbound(space, msg);
  await handlers.inbound(space, msg);
  expect([calls, sends]).toEqual([1, 2]);
});
test("concurrent inbound duplicates share one request and STOP reaches internal route", async () => {
  let calls = 0;
  const { space } = fakeSpace();
  const api = apiClient(
    settings,
    fetchMock(async (_, init) => {
      calls++;
      expect(JSON.parse(String(init?.body)).text).toBe("STOP");
      await Promise.resolve();
      return Response.json({ reply_text: "off", processed_checkin: false });
    }),
  );
  const handlers = createHandlers(api, async () => space, quiet, true);
  const msg = message("stop", {
    content: { type: "text", text: "STOP" },
    react: async () => {
      throw Error("must not react");
    },
  });
  await Promise.all([
    handlers.inbound(space, msg),
    handlers.inbound(space, msg),
  ]);
  expect(calls).toBe(1);
});
test("outbox authenticates audio, uses voice builder, retries ack without duplicate sends", async () => {
  const { space, sent } = fakeSpace();
  let acknowledgements = 0;
  const api = apiClient(
    settings,
    fetchMock((url, init) => {
      expect((init?.headers as Record<string, string>)["x-service-key"]).toBe(
        "fake",
      );
      if (url.endsWith("/sent"))
        return ++acknowledgements === 1
          ? new Response("", { status: 503 })
          : Response.json({ ok: true });
      if (url.includes("/assets/"))
        return new Response("ID3fake", {
          headers: { "content-type": "audio/mpeg" },
        });
      return Response.json([
        {
          id: "out",
          phone_e164: "+15555550101",
          text: "hello",
          audio_url: "/api/internal/assets/voice/test.mp3",
        },
      ]);
    }),
  );
  const handlers = createHandlers(api, async () => space, quiet, true);
  await expect(handlers.drainOutbox()).rejects.toBeInstanceOf(ApiError);
  await handlers.drainOutbox();
  expect(sent.length).toBe(2);
  expect(sent[0]).toBe("[AI Mayor] hello");
  expect(
    await (sent[1] as { build(): Promise<unknown> }).build(),
  ).toMatchObject({ type: "voice", mimeType: "audio/mpeg" });
  expect(acknowledgements).toBe(2);
});
test("rejects external or unauthenticated asset paths before sending credentials", async () => {
  let calls = 0;
  const api = apiClient(
    settings,
    fetchMock(() => {
      calls++;
      return Response.json({});
    }),
  );
  for (const url of [
    "https://evil.test/api/internal/assets/x",
    "/api/assets/x",
    "/api/internal/assets/../outbox",
  ])
    await expect(api.audio(url)).rejects.toBeInstanceOf(ApiError);
  expect(calls).toBe(0);
});
test("API failure remains retryable and overlapping drains do not double claim", async () => {
  let calls = 0;
  const { space } = fakeSpace();
  const api = apiClient(
    settings,
    fetchMock(async () => {
      calls++;
      await Promise.resolve();
      return new Response("", { status: 503 });
    }),
  );
  const handlers = createHandlers(api, async () => space, quiet, true);
  const result = await Promise.allSettled([
    handlers.drainOutbox(),
    handlers.drainOutbox(),
  ]);
  expect(calls).toBe(1);
  expect(result[0]?.status).toBe("rejected");
  await expect(handlers.inbound(space, message())).rejects.toBeInstanceOf(
    ApiError,
  );
  expect(calls).toBe(2);
});

test("API-down inbox retries the same message ID and completes once recovered", async () => {
  let calls = 0;
  const { space, sent } = fakeSpace();
  const events: string[] = [];
  const api = apiClient(
    settings,
    fetchMock(() => {
      calls++;
      return calls === 1
        ? new Response("", { status: 503 })
        : Response.json({
            reply_text: "back online",
            processed_checkin: false,
          });
    }),
  );
  const handlers = createHandlers(api, async () => space, quiet, true);
  const app = {
    messages: (async function* () {
      yield [space, message("recover")] as const;
    })(),
  };
  await runInbox(app, handlers, new AbortController().signal, (event) =>
    events.push(event),
  );
  expect(calls).toBe(2);
  expect(sent).toEqual(["back online"]);
  expect(events).toEqual(["inbound_retry"]);
});

test("missing audio fails the outbox item without sending text or acknowledging sent", async () => {
  const { space, sent } = fakeSpace();
  const paths: string[] = [];
  const api = apiClient(
    settings,
    fetchMock((url) => {
      paths.push(url);
      if (url.includes("/assets/")) return new Response("", { status: 404 });
      if (url.endsWith("/failed")) return Response.json({ ok: true });
      return Response.json([
        {
          id: "bad",
          phone_e164: "+15555550101",
          text: "hello",
          audio_url: "/api/internal/assets/missing.mp3",
        },
      ]);
    }),
  );
  await createHandlers(api, async () => space, quiet, true).drainOutbox();
  expect(sent).toEqual([]);
  expect(paths.some((path) => path.endsWith("/failed"))).toBe(true);
  expect(paths.some((path) => path.endsWith("/sent"))).toBe(false);
});
