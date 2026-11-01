import test from "node:test";
import assert from "node:assert/strict";
import { catalogFile, parseCatalogFile } from "../src/companion/catalog-file.mjs";
const item = { id: "1:2", name: "Card", pageId: "page", version: 1, width: 200, height: 100, updatedAt: 0, image: "data:image/png;base64,AAAA" };
test("portable catalogs round-trip only whitelisted asset fields, without credentials", () => {
  const file = catalogFile([{ ...item, token: "private", relay: "https://private.example", html: "<script>" }]);
  assert.deepEqual(parseCatalogFile(JSON.stringify(file)), [item]);
  assert.doesNotMatch(JSON.stringify(file), /private|relay|script/);
});
test("catalog import rejects executable/remote images, invalid dimensions, duplicates and unknown formats", () => {
  const parse = items => parseCatalogFile(JSON.stringify({ format: "figma-xr-catalog", version: 1, items }));
  for (const invalid of [
    { ...item, image: "https://example.com/tracking.png" },
    { ...item, image: "data:image/svg+xml;base64,AAAA" },
    { ...item, width: 0 }, { ...item, height: 100000 }, { ...item, version: -1 },
  ]) assert.throws(() => parse([invalid]), /invalid/);
  assert.throws(() => parse([item, item]), /duplicate/);
  assert.throws(() => parse(Array(257).fill(item)), /256/);
  assert.throws(() => parseCatalogFile('{"version":2}'), /version 1/);
  assert.throws(() => parseCatalogFile("not json"));
});
