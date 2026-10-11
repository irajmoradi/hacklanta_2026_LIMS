import { resolve } from "node:path";
import { apiClient, createHandlers, runInbox } from "../src/agent";
import type { Message, Space } from "../src/agent";
import { config } from "../src/config";
import assert from "node:assert/strict";

if (!process.argv.includes("--client")) {
  // Python owns isolated database setup, the temporary server and guaranteed cleanup.
  const apiDir = resolve(import.meta.dir, "../../api");
  const child = Bun.spawn(
    [
      "python",
      "-m",
      "uv",
      "run",
      "--directory",
      apiDir,
      "python",
      "scripts/simulate_api006.py",
    ],
    { stdout: "inherit", stderr: "inherit", env: process.env },
  );
  process.exitCode = await child.exited;
} else {
  const sent: unknown[] = [],
    reactions: string[] = [];
  const space: Space = {
    send: async (content) => {
      sent.push(content);
    },
    responding: async (fn) => fn(),
  };
  const msg: Message = {
    id: "simulation-checkin",
    platform: "imessage",
    direction: "inbound",
    sender: { id: "+15555550101" },
    content: { type: "text", text: "checkin: Simulation walk completed" },
    react: async (emoji) => {
      reactions.push(emoji);
    },
  };
  const handlers = createHandlers(
    apiClient(config(process.env, false)),
    async (phone) => {
      assert.equal(phone, "+15555550101");
      return space;
    },
    () => {}, true,
  );
  const app = {
    messages: (async function* () {
      yield [space, msg] as const;
      yield [space, msg] as const;
    })(),
  };
  await runInbox(app, handlers, new AbortController().signal);
  assert.equal(sent.length, 1);
  assert.match(String(sent[0]), /\+10 XP/);
  assert.deepEqual(reactions, ["👍"]);
  await handlers.drainOutbox();
  assert.equal(sent.length, 2);
  assert.match(String(sent[1]), /Simulation outbox/);
  console.log("Simulation handlers: PASS (fake Spectrum; no iMessage traffic)");
}
