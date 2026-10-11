import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "feat015.spec.ts",
  timeout: 120000,
  workers: 1,
  reporter: "list",
  outputDir: "artifacts/feat015/results",
  use: {
    baseURL: process.env.FEAT015_BASE_URL || "http://127.0.0.1:5185",
    viewport: { width: 1400, height: 900 },
    video: "off",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
});
