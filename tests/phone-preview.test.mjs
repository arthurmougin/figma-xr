import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createPhonePreview } from "../server/phone-preview.mjs";
test("phone preview serves built assets and pairing without exposing sources, credentials or OAuth", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "figma-phone-")),
    dist = join(directory, "dist");
  await mkdir(dist);
  await mkdir(join(dist, "assets"));
  await writeFile(join(dist, "index.html"), "<h1>Companion</h1>");
  await writeFile(join(dist, "assets", "app.js"), 'console.log("companion")');
  await writeFile(join(directory, ".env.auth"), "not-public");
  const origin = "https://test-phone.trycloudflare.com",
    preview = createPhonePreview({ distDir: dist, origins: [origin] });
  preview.server.listen(0, "127.0.0.1");
  await once(preview.server, "listening");
  const url = `http://127.0.0.1:${preview.server.address().port}`;
  t.after(async () => {
    await preview.close();
    await rm(directory, { recursive: true, force: true });
  });
  assert.match(
    await (await fetch(url + "/figma-xr/companion")).text(),
    /Companion/,
  );
  const script = await fetch(url + "/figma-xr/assets/app.js");
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /javascript/);
  for (const path of [
    "/api/figma/token",
    "/src/companion/scene.ts",
    "/.env.auth",
    "/figma-xr/.env.auth",
    "/figma-xr/%2e%2e%2f.env.auth",
    "/figma-xr/assets/missing.js",
  ])
    assert.equal((await fetch(url + path)).status, 404, path);
  assert.equal(
    (await fetch(url + "/api/figma/token", { method: "POST" })).status,
    405,
  );
  assert.equal(
    (
      await fetch(url + "/api/pair/rooms", {
        method: "POST",
        headers: { Origin: origin },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await fetch(url + "/api/pair/rooms", {
        method: "POST",
        headers: { Origin: "https://other.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(url + "/api/pair/rooms", {
        method: "POST",
        headers: { Origin: "null" },
      })
    ).status,
    201,
  );
});
