import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { apiClient, createHandlers, log, runInbox, runOutbox } from "./agent";
import { config, loadEnvironment } from "./config";

try {
  loadEnvironment();
  const settings = config(process.env);
  const app = await Spectrum({
    projectId: process.env.PROJECT_ID!,
    projectSecret: process.env.PROJECT_SECRET!,
    providers: [imessage.config()],
  });
  const im = imessage(app);
  const handlers = createHandlers(apiClient(settings), async (phone) =>
    im.space.create(await im.user(phone)),
    log, settings.sendEnabled,
  );
  const controller = new AbortController();
  const stop = () => {
    controller.abort();
    void app.stop();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  log("agent_started");
  try {
    await Promise.all([
      runInbox(app, handlers, controller.signal).finally(() =>
        controller.abort(),
      ),
      runOutbox(handlers, settings.pollMs, controller.signal),
    ]);
  } finally {
    stop();
  }
} catch {
  log("agent_start_or_runtime_failed");
  process.exitCode = 1;
}
