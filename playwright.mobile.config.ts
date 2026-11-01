import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: "mobile-lab.spec.ts",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/figma-xr/",
    launchOptions: {
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
      args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    { name: "phone-portrait", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "phone-landscape", use: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "node server/static-preview.mjs",
    url: "http://127.0.0.1:4173/figma-xr/lab",
    reuseExistingServer: !process.env.CI,
  },
});
