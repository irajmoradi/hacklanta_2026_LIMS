import { expect, test } from "bun:test";
import { apiClient, createHandlers } from "./agent";
import type { InboundContent, Message, Space } from "./agent";
import { config } from "./config";

const settings = config({ SERVICE_KEY: "mock", VILLAGE_API_URL: "http://mock/api" }, false);

for (const command of ["check in: Ran", "daily: Good day", "progress: Ran 5k", "goal: Run twice",
  "stretch: Run again", "go beyond", "challenges", "join abcdef12", "enter abcdef12: Ran",
  "status", "help", "Y", "N", "I ran 5k today"]) {
  test(`forwards ${command} unchanged with transport ID`, async () => {
    const payloads: unknown[] = [];
    const api = apiClient(settings, (async (_url, init) => {
      payloads.push(JSON.parse(String(init!.body)));
      return Response.json({ reply_text: "Recorded", processed_checkin: true });
    }) as typeof fetch);
    const room: Space = { send: async () => {}, responding: async fn => fn() };
    const handlers = createHandlers(api, async () => room, () => {}, false);
    const msg: Message = { id: "same", platform: "imessage", direction: "inbound",
      sender: { id: "+15555550101" }, react: async () => {},
      content: { type: "effect", content: { type: "text", text: command } } };
    await handlers.inbound(room, msg);
    await handlers.inbound(room, msg);
    expect(payloads).toEqual([{ phone_e164: "+15555550101", text: command, message_id: "imessage:same" }]);
  });
}

for (const caption of ["progress: Ran 5k", "enter abcdef12: value=5 Ran", "I ran 5k today", "STOP"]) {
  test(`photo caption ${caption} remains one action; STOP skips attachment`, async () => {
    let calls = 0, downloads = 0;
    const api = apiClient(settings, (async (url, init) => {
      calls++;
      if (caption === "STOP") {
        expect(String(url)).toEndWith("/internal/inbound");
        expect(JSON.parse(String(init!.body)).text).toBe("STOP");
      } else {
        expect(String(url)).toEndWith("/internal/inbound/evidence");
        const form = init!.body as FormData;
        expect(form.get("caption")).toBe(caption);
        expect(form.get("message_id")).toBe("imessage:photo:photo:0");
      }
      return Response.json({ reply_text: "Recorded", processed_checkin: false });
    }) as typeof fetch);
    const image: InboundContent = { type: "attachment", mimeType: "image/png", stream: async () => {
      downloads++;
      return new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
    } };
    const room: Space = { send: async () => {}, responding: async fn => fn() };
    const handlers = createHandlers(api, async () => room, () => {}, false);
    await handlers.inbound(room, { id: "photo", platform: "imessage", direction: "inbound",
      sender: { id: "+15555550101" }, react: async () => {}, content: { type: "group", items: [
        { content: { type: "text", text: caption } }, { content: image },
      ] } });
    expect(calls).toBe(1);
    expect(downloads).toBe(caption === "STOP" ? 0 : 1);
  });
}
