import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";

test("the production vision worker initializes without the development server", async ({ page }) => {
  await page.goto("lab");
  const workerPath = "/figma-xr/assets/" + readdirSync("dist/assets")
    .find(name => name.startsWith("tracker.worker-") && name.endsWith(".js"));
  const count = await page.evaluate(async path => {
    const worker = new Worker(path, { type: "module" });
    try {
      return await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Vision worker timed out")), 20_000);
        worker.onerror = event => { clearTimeout(timeout); reject(new Error(event.message)); };
        worker.onmessage = event => {
          if (event.data.type === "reference") { clearTimeout(timeout); resolve(event.data.count); }
          if (event.data.type === "error") { clearTimeout(timeout); reject(new Error(event.data.message)); }
        };
        const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, 640, 480);
        for (let i = 0; i < 150; i++) {
          ctx.fillStyle = `hsl(${i * 51 % 360} 60% 30%)`;
          ctx.fillRect(i * 89 % 610, i * 67 % 450, 7 + i % 23, 5 + i % 17);
        }
        const pixels = ctx.getImageData(0, 0, 640, 480).data;
        worker.postMessage({ type: "reference", revision: 1, width: 640, height: 480,
          originalWidth: 640, originalHeight: 480, pixels: pixels.buffer }, [pixels.buffer]);
      });
    } finally { worker.terminate(); }
  }, workerPath);
  expect(count).toBeGreaterThan(100);
});

test("mobile lab supports onboarding, search, placement and backup without any backend", async ({ page }, testInfo) => {
  const backend: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", route => { backend.push(route.request().url()); return route.abort(); });
  await page.goto("lab");
  await expect(page.getByText("Demo catalog · no desktop required", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explore on your phone" })).toBeVisible();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Place Welcome card", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Placed Welcome card");
  await page.getByRole("textbox", { name: "Find a catalog item" }).fill("weather");
  await expect(page.getByRole("button", { name: /^Place / })).toHaveCount(1);
  await page.getByRole("button", { name: "Hide catalog", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Find a catalog item" })).not.toBeVisible();
  await page.getByRole("button", { name: "Show catalog", exact: true }).click();
  await page.locator("summary").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export catalog backup", exact: true }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.items).toHaveLength(6);
  expect(backup.items.every((item: { pageId: string }) => item.pageId === "demo")).toBe(true);
  await page.getByRole("button", { name: "Show onboarding", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Explore on your phone" })).toBeVisible();
  await page.locator("summary").click();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  const fits = await page.evaluate(() => {
    const controls = document.querySelector(".controls")!.getBoundingClientRect();
    return controls.left >= 0 && controls.right <= innerWidth && controls.bottom <= innerHeight + 1 &&
      document.documentElement.scrollWidth <= innerWidth;
  });
  expect(fits).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile-lab.png") });
  expect(backend).toEqual([]);
  expect(errors).toEqual([]);
});

test("an imported catalog survives reload and is preserved when visiting the sample lab", async ({ page }) => {
  await page.goto("companion");
  // A valid PNG generated in the browser, with no real Figma data.
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 100; canvas.height = 50;
    canvas.getContext("2d")!.fillRect(0, 0, 100, 50);
    return canvas.toDataURL("image/png");
  });
  const backup = { format: "figma-xr-catalog", version: 1, items: [
    { id: "portable:1", pageId: "private-fixture", name: "My portable card", version: 1, width: 100, height: 50, updatedAt: 0, image },
  ] };
  await page.locator("summary").click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import catalog backup", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "catalog.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByText("Imported catalog · ready without a desktop", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Place My portable card", exact: true })).toBeVisible();
  await page.goto("lab");
  await expect(page.getByRole("button", { name: "Place Welcome card", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Place My portable card", exact: true })).toHaveCount(0);
  await page.locator("summary").click();
  await page.getByRole("link", { name: "Open my saved catalog", exact: true }).click();
  await expect(page.getByRole("button", { name: "Place My portable card", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Place Welcome card", exact: true })).toHaveCount(0);
});

test("a phone without WebXR can still place designs in the 3D preview", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "xr", { value: undefined, configurable: true }));
  await page.goto("lab");
  await expect(page.getByText("3D preview is available. This browser does not provide AR.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter AR", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "Place Welcome card", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Placed Welcome card");
});
