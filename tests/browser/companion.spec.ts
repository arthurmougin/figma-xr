import { test, expect } from "@playwright/test";
import WebSocket from "ws";
import { once } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
test("catalog connects before the 3D engine finishes loading", async ({ page, request }) => {
  test.skip(!!process.env.TEST_PRODUCTION, "Intercepts the development module URL");
  let release!: () => void;
  const engineDownload = new Promise<void>((resolve) => { release = resolve; });
  const requests: string[] = [];
  page.on("request", (req) => requests.push(new URL(req.url()).pathname));
  await page.route("**/src/companion/scene.ts*", async (route) => {
    await engineDownload;
    await route.continue();
  });
  const response = await request.post("https://localhost:5173/api/pair/rooms", {
    headers: { Origin: "null" },
  });
  expect(response.status()).toBe(201);
  const pair = await response.json();
  const desktop = new WebSocket("wss://localhost:5173/api/pair/socket", {
    origin: "null", rejectUnauthorized: false,
  });
  try {
    await once(desktop, "open");
    desktop.send(JSON.stringify({ type: "join", role: "desktop", room: pair.room, token: pair.desktopToken }));
    await page.goto("companion#" + new URLSearchParams({
      room: pair.room, token: pair.phoneToken, relay: "https://localhost:5173",
    }), { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Plugin connected · catalog updates live")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Preparing 3D");
    await expect(page.getByRole("button", { name: "Enter AR", exact: true })).toBeDisabled();
    expect(requests.some((path) => /XRView\.vue|Projects\.vue|babylon\/scene|@babylonjs_inspector/.test(path))).toBe(false);
    release();
    await expect(page.getByRole("button", { name: "Enter AR", exact: true })).toBeEnabled();
  } finally {
    release();
    desktop.terminate();
  }
});
test("phone connection check works without downloading the app", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (req) => { if (req.resourceType() === "script") scripts.push(req.url()); });
  await page.goto("phone-check.html");
  await expect(page.getByText("Pairing relay: reachable.", { exact: true })).toBeVisible();
  await expect(page.getByText("Live connection: WebSocket reached the relay.", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("The phone can reach the app and relay");
  // Vite adds its development client; no Vue, application or 3D modules are needed.
  expect(scripts.every((url) => /@vite\/client|vite\/dist\/client\/env/.test(url))).toBe(true);
});
test("plugin pairing skips OAuth, applies edits and retains the catalog offline after reload", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await request.post("https://localhost:5173/api/pair/rooms", {
    headers: { Origin: "null" },
  });
  expect(response.status()).toBe(201);
  const pair = await response.json();
  const desktop = new WebSocket("wss://localhost:5173/api/pair/socket", {
    origin: "null",
    rejectUnauthorized: false,
  });
  try {
    await once(desktop, "open");
    desktop.send(
      JSON.stringify({
        type: "join",
        role: "desktop",
        room: pair.room,
        token: pair.desktopToken,
      }),
    );
    await page.goto(
      "companion#" +
        new URLSearchParams({
          room: pair.room,
          token: pair.phoneToken,
          relay: "https://localhost:5173",
        }),
    );
    await expect(
      page.getByText("Plugin connected · catalog updates live"),
    ).toBeVisible();
    expect(new URL(page.url()).hash).toBe("");
    await expect(
      page.getByRole("button", { name: "Enter AR", exact: true }),
    ).toBeVisible();
    const image = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 100;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#7066ee";
      c.fillRect(0, 0, 200, 100);
      c.fillStyle = "white";
      c.fillText("Card", 30, 50);
      return canvas.toDataURL();
    });
    const item = {
      id: "frame:1",
      name: "Purple card",
      pageId: "page",
      version: 1,
      width: 200,
      height: 100,
      updatedAt: Date.now(),
      image,
    };
    desktop.send(JSON.stringify({ type: "catalog", items: [item] }));
    await expect(
      page.getByRole("button", { name: "Place Purple card", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Place Purple card", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Placed Purple card");
    desktop.send(
      JSON.stringify({
        type: "catalog",
        items: [{ ...item, name: "Edited card", version: 2 }],
      }),
    );
    await expect(
      page.getByRole("button", { name: "Place Edited card", exact: true }),
    ).toBeVisible();
    desktop.close();
    await once(desktop, "close");
    await expect(
      page.getByText("Plugin offline · saved catalog ready"),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            new Promise<number>((resolve) => {
              const open = indexedDB.open("figma-xr-companion");
              open.onsuccess = () => {
                const db = open.result;
                const tx = db.transaction("catalog");
                const get = tx
                  .objectStore("catalog")
                  .get(
                    sessionStorage.getItem("figma-xr-pair")
                      ? JSON.parse(sessionStorage.getItem("figma-xr-pair")!)
                          .room
                      : "",
                  );
                get.onsuccess = () => resolve(get.result?.[0]?.version || 0);
              };
            }),
        ),
      )
      .toBe(2);
    await page.evaluate(() => sessionStorage.removeItem("figma-xr-pair"));
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Place Edited card", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Place Edited card", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Placed Edited card");
    expect(errors).toEqual([]);
  } finally {
    desktop.terminate();
  }
});
test("OpenCV worker initializes and extracts natural features in the browser", async ({
  page,
}) => {
  await page.goto("companion");
  const workerUrl = process.env.TEST_PRODUCTION
    ? "/figma-xr/assets/" +
      readdirSync("dist/assets").find(
        (name) => name.startsWith("tracker.worker-") && name.endsWith(".js"),
      )
    : "/figma-xr/src/companion/tracker.worker.ts?worker_file&type=module";
  const count = await page.evaluate(async (workerUrl) => {
    const WorkerClass = Worker;
    const worker = new WorkerClass(new URL(workerUrl, location.origin), {
      type: "module",
    });
    try {
      return await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("OpenCV worker initialization timed out")),
          20000,
        );
        worker.onerror = (event) => {
          clearTimeout(timer);
          reject(new Error(event.message));
        };
        worker.onmessage = (event) => {
          if (event.data.type === "error") {
            clearTimeout(timer);
            reject(new Error(event.data.message));
          }
          if (event.data.type === "reference") {
            clearTimeout(timer);
            resolve(event.data.count);
          }
        };
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const c = canvas.getContext("2d")!;
        c.fillStyle = "white";
        c.fillRect(0, 0, 640, 480);
        for (let i = 0; i < 150; i++) {
          c.fillStyle = `hsl(${(i * 51) % 360} 60% 30%)`;
          c.fillRect(
            (i * 89) % 610,
            (i * 67) % 450,
            7 + (i % 23),
            5 + (i % 17),
          );
        }
        c.fillStyle = "black";
        c.font = "28px sans-serif";
        c.fillText("Figma XR canvas", 100, 230);
        const pixels = c.getImageData(0, 0, 640, 480).data;
        worker.postMessage(
          {
            type: "reference",
            revision: 1,
            width: 640,
            height: 480,
            originalWidth: 640,
            originalHeight: 480,
            pixels: pixels.buffer,
          },
          [pixels.buffer],
        );
      });
    } finally {
      worker.terminate();
    }
  }, workerUrl);
  expect(count).toBeGreaterThan(100);
});

test("plugin auto-prepares a QR without URL entry and waits for a phone before exporting", async ({
  page,
  context,
}) => {
  const html = readFileSync("plugin/dist/ui.html", "utf8");
  await page.goto("companion");
  await page.evaluate((html) => {
    (window as any).pluginMessages = [];
    window.addEventListener("message", (event) => {
      const message = event.data?.pluginMessage;
      if (!message) return;
      (window as any).pluginMessages.push(message.type);
      if (message.type === "load-settings")
        (window as any).pluginNonce = message.nonce;
      if (message.type === "load-settings")
        (event.source as Window).postMessage(
          {
            pluginMessage: {
              type: "settings",
              nonce: message.nonce,
              settings: {
                website: "https://localhost:5173/figma-xr/",
                relay: "https://localhost:5173",
              },
            },
          },
          "*",
        );
    });
    const iframe = document.createElement("iframe");
    iframe.id = "plugin";
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.srcdoc = html;
    document.body.replaceChildren(iframe);
  }, html);
  const frame = page.frameLocator("#plugin");

  await expect(
    frame.getByRole("link", { name: "Open companion", exact: true }),
  ).toBeVisible();
  await expect(frame.locator("#website")).not.toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as any).pluginMessages.includes("connected"),
    ),
  ).toBe(false);
  const href = await frame
    .getByRole("link", { name: "Open companion", exact: true })
    .getAttribute("href");
  const phone = await context.newPage();
  await phone.goto(href!);
  await expect(
    frame.getByText("Phone connected", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).pluginMessages.includes("connected")),
    )
    .toBe(true);
  await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 80;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "teal";
    c.fillRect(0, 0, 120, 80);
    const image = Uint8Array.from(
      atob(canvas.toDataURL().split(",")[1]),
      (char) => char.charCodeAt(0),
    );
    (
      document.querySelector("#plugin") as HTMLIFrameElement
    ).contentWindow!.postMessage(
      {
        pluginMessage: {
          type: "catalog-bytes",
          nonce: (window as any).pluginNonce,
          items: [
            {
              id: "from-plugin",
              name: "Plugin export",
              pageId: "p",
              version: 1,
              width: 120,
              height: 80,
              updatedAt: Date.now(),
              image,
            },
          ],
        },
      },
      "*",
    );
  });
  await expect(
    phone.getByRole("button", { name: "Place Plugin export", exact: true }),
  ).toBeVisible();
  await page.close();
  await expect(
    phone.getByText("Plugin offline · saved catalog ready"),
  ).toBeVisible();
  await phone.close();
});

test("plugin accepts SDK-dispatched replies with no parent source and ignores other launch tokens", async ({
  page,
}) => {
  const html = readFileSync("plugin/dist/ui.html", "utf8");
  await page.goto("companion");
  await page.evaluate((html) => {
    window.addEventListener("message", (event) => {
      if (event.data?.pluginMessage?.type === "load-settings")
        (window as any).pluginNonce = event.data.pluginMessage.nonce;
    });
    const iframe = document.createElement("iframe");
    iframe.id = "plugin";
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.srcdoc = html;
    document.body.replaceChildren(iframe);
  }, html);
  await expect
    .poll(() => page.evaluate(() => (window as any).pluginNonce || ""))
    .toMatch(/^[a-f0-9]{32}$/);
  const nonce = await page.evaluate(() => (window as any).pluginNonce),
    frame = page.frameLocator("#plugin");
  await frame
    .locator("body")
    .evaluate(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          source: null,
          data: {
            pluginMessage: {
              type: "settings",
              nonce: "wrong-token",
              settings: null,
            },
          },
        }),
      ),
    );
  await expect(
    frame.getByRole("link", { name: "Open companion", exact: true }),
  ).not.toBeVisible();
  await frame
    .locator("body")
    .evaluate(
      (_, nonce) =>
        window.dispatchEvent(
          new MessageEvent("message", {
            source: null,
            data: {
              pluginMessage: {
                type: "settings",
                nonce,
                settings: {
                  website: "https://localhost:5173/figma-xr/",
                  relay: "https://localhost:5173",
                },
              },
            },
          }),
        ),
      nonce,
    );
  await expect(
    frame.getByRole("link", { name: "Open companion", exact: true }),
  ).toBeVisible();
});

test("plugin shows a recoverable controller timeout instead of preparing indefinitely", async ({
  page,
}) => {
  const html = readFileSync("plugin/dist/ui.html", "utf8");
  await page.goto("companion");
  await page.evaluate((html) => {
    const iframe = document.createElement("iframe");
    iframe.id = "plugin";
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.srcdoc = html;
    document.body.replaceChildren(iframe);
  }, html);
  const frame = page.frameLocator("#plugin");
  await expect(frame.getByRole("status")).toContainText(
    "controller did not respond",
    { timeout: 7000 },
  );
  await frame
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await expect(frame.getByRole("status")).toContainText(
    "Loading your connection",
  );
});
