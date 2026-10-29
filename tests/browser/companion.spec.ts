import { test, expect } from "@playwright/test";
import WebSocket from "ws";
import { once } from "node:events";
import { readdirSync } from "node:fs";
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
