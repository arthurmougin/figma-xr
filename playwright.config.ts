import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testIgnore: "mobile-lab.spec.ts",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "https://localhost:5173/figma-xr/",
    ignoreHTTPSErrors: true,
    launchOptions: {
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
      args: [
        "--enable-webgl",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
});
