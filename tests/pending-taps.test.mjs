import test from "node:test";
import assert from "node:assert/strict";
import { PendingTaps } from "../src/companion/pending-taps.ts";
import { unit, sub } from "../src/companion/geometry.ts";
const plane = {
  origin: [-0.5, 0.4, -1],
  axisU: [1, 0, 0],
  axisV: [0, -0.8, 0],
  normal: [0, 0, -1],
  residual: 0,
};
const snapshot = {
  revision: 3,
  bounds: { x: 100, y: 200, width: 1000, height: 800 },
  items: [
    {
      id: "left",
      bounds: { x: 100, y: 200, width: 450, height: 800 },
      version: 1,
      z: 0,
    },
    {
      id: "right",
      bounds: { x: 650, y: 200, width: 450, height: 800 },
      version: 1,
      z: 1,
    },
  ],
};
const catalog = new Map(
  ["left", "right"].map((id) => [
    id,
    {
      id,
      name: id,
      version: 1,
      image: "data:image/png;base64,AAAA",
      width: 450,
      height: 800,
    },
  ]),
);
const ray = (x, origin = [0, 0, 0]) => ({
  origin,
  direction: unit(sub([x, 0, -1], origin)),
});
test("a tap before matching is acknowledged immediately and resolves at its original ray after camera motion", () => {
  const queue = new PendingTaps();
  queue.setReference(snapshot, 1);
  const input = ray(-0.25),
    { tap } = queue.enqueue(input, 1000);
  assert.equal(queue.pending.length, 1);
  assert.equal(tap.createdAt, 1000);
  assert.deepEqual(queue.pump(1100, null, 0, catalog), []);
  // The phone moves to the right and aims elsewhere while the worker matches.
  input.origin[0] = 0.3;
  input.direction[0] = 0.8;
  const outcomes = queue.pump(1700, plane, 1650, catalog);
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].type, "resolved");
  assert.equal(outcomes[0].item.id, "left");
  assert.ok(Math.abs(outcomes[0].uv.x - 0.25) < 1e-9);
  assert.deepEqual(queue.pump(1750, plane, 1650, catalog), []);
});
test("several taps resolve independently without waiting for a ready indicator", () => {
  const queue = new PendingTaps();
  queue.setReference(snapshot, 0);
  queue.enqueue(ray(-0.25), 1000);
  queue.enqueue(ray(0.25), 1100);
  assert.deepEqual(queue.pump(1200, null, 0, catalog), []);
  const outcomes = queue.pump(2000, plane, 1990, catalog);
  assert.deepEqual(
    outcomes.map((o) => o.item.id),
    ["left", "right"],
  );
  assert.equal(queue.pending.length, 0);
});
test("taps during reference loading bind to that publication; edits cancel them even while no map exists", () => {
  const queue = new PendingTaps();
  queue.setReference(null, 1);
  queue.enqueue(ray(-0.25), 1000);
  assert.deepEqual(queue.setReference(snapshot, 1), []);
  assert.equal(queue.pump(1500, plane, 1450, catalog)[0].type, "resolved");
  queue.setReference(null, 2);
  queue.enqueue(ray(-0.25), 1600);
  const cancelled = queue.setReference(null, 3);
  assert.equal(cancelled[0].reason, "canvas-changed");
  queue.setReference({ ...snapshot, revision: 5 }, 3);
  assert.deepEqual(queue.pump(2000, plane, 1990, catalog), []);
});
test("matching waits for the correct catalog version and rejects stale match results", () => {
  const queue = new PendingTaps();
  queue.setReference(snapshot, 1);
  queue.enqueue(ray(-0.25), 1000);
  assert.deepEqual(queue.pump(2500, plane, 1000, catalog), []);
  assert.deepEqual(queue.pump(2600, plane, 2590, new Map()), []);
  assert.deepEqual(
    queue.pump(
      2700,
      plane,
      2690,
      new Map([["left", { ...catalog.get("left"), version: 2 }]]),
    ),
    [],
  );
  assert.equal(queue.pump(2800, plane, 2790, catalog)[0].item.version, 1);
});
test("XR anchor corrections can refine a retained ray without using the current camera aim", () => {
  const queue = new PendingTaps();
  queue.setReference(snapshot, 1);
  const { tap } = queue.enqueue(ray(-0.25), 1000);
  queue.updateRay(tap.id, ray(0.25, [0.01, 0, 0]));
  assert.equal(queue.pump(2000, plane, 1950, catalog)[0].item.id, "right");
});
test("timeouts, cancellation, empty space, capacity and reference resets finish jobs without later copies", () => {
  const queue = new PendingTaps(1000, 2);
  queue.setReference(snapshot, 1);
  queue.enqueue(ray(-0.25), 1000);
  queue.enqueue(ray(0.25), 1001);
  assert.equal(queue.enqueue(ray(0), 1002).outcomes[0].reason, "capacity");
  const outcomes = queue.pump(2001, plane, 2000, catalog);
  assert.deepEqual(
    outcomes.map((o) => o.reason),
    ["expired", "empty"],
  );
  queue.enqueue(ray(-0.25), 2100);
  assert.equal(queue.cancel("reset")[0].reason, "reset");
  assert.deepEqual(queue.pump(2200, plane, 2190, catalog), []);
  queue.enqueue(ray(-0.25), 2300);
  assert.equal(
    queue.setReference({ ...snapshot, revision: 4 }, 1)[0].reason,
    "canvas-changed",
  );
});
