import test from "node:test";
import assert from "node:assert/strict";
import {
  invert3,
  transformPoint,
  pickItem,
  pixelRay,
  projectWorld,
  triangulate,
  fitScreen,
  intersectScreen,
  ScreenCalibrator,
  StableScreen,
  planeError,
  unit,
  sub,
  screenPosition,
} from "../src/companion/geometry.ts";
const projection = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, -1, -1, 0, 0, -0.2, 0];
const camera = (x) => ({
  width: 640,
  height: 480,
  projection,
  cameraWorld: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1],
});
const plane = {
  origin: [-0.3, 0.225, -1],
  axisU: [0.6, 0, 0],
  axisV: [0, -0.45, 0],
  normal: [0, 0, -1],
  residual: 0,
};
const features = Array.from({ length: 35 }, (_, i) => ({
  id: i,
  reference: { x: (i % 7) * 100, y: Math.floor(i / 7) * 112.5 },
}));
const match = (x) => ({
  revision: 4,
  homography: [],
  points: features.map((p) => ({
    ...p,
    image: projectWorld(
      screenPosition(plane, p.reference.x / 600, p.reference.y / 450),
      camera(x),
    ),
  })),
  inliers: 35,
  error: 0,
  coverage: 1,
});
test("homography inversion maps a perspective camera tap back into the canvas", () => {
  const h = [0.7, 0.1, 60, -0.1, 0.9, 30, 0.0003, 0.0005, 1],
    p = { x: 318, y: 172 };
  const restored = transformPoint(invert3(h), transformPoint(h, p));
  assert.ok(Math.hypot(restored.x - p.x, restored.y - p.y) < 1e-8);
  assert.equal(invert3(Array(9).fill(0)), null);
});
test("selection uses containing paint bounds and never selects a nearby item on empty space", () => {
  const items = [
    { id: "frame", z: 0, bounds: { x: 0, y: 0, width: 200, height: 200 } },
    { id: "nested", z: 2, bounds: { x: 30, y: 40, width: 50, height: 60 } },
  ];
  assert.equal(pickItem(items, { x: 45, y: 50 }).id, "nested");
  assert.equal(pickItem(items, { x: 250, y: 150 }), undefined);
});
test("camera rays agree with projection, including projection offsets and skew", () => {
  const frame = camera(0.05);
  frame.projection = [
    2, 0, 0, 0, 0.08, 2, 0, 0, 0.1, -0.05, -1, -1, 0, 0, -0.2, 0,
  ];
  const world = [0.1, 0.2, -1],
    ray = pixelRay(projectWorld(world, frame), frame),
    expected = unit(sub(world, ray.origin));
  assert.ok(
    Math.hypot(...ray.direction.map((v, i) => v - expected[i])) < 1e-10,
  );
});
test("screen calibration recovers metric scale from translated XR camera observations", () => {
  const calibrator = new ScreenCalibrator();
  assert.equal(calibrator.add(match(0), camera(0), 600, 450), null);
  const result = calibrator.add(match(0.07), camera(0.07), 600, 450);
  assert.ok(result);
  assert.ok(Math.abs(result.axisU[0] - 0.6) < 1e-8);
  assert.ok(planeError(result, match(0.07), camera(0.07), 600, 450) < 1e-6);
  const uv = intersectScreen(
    { origin: [0, 0, 0], direction: [0, 0, -1] },
    result,
  );
  assert.ok(Math.abs(uv.x - 0.5) < 1e-8);
  assert.ok(Math.abs(uv.y - 0.5) < 1e-8);
  assert.equal(
    calibrator.add({ ...match(0.1), revision: 5 }, camera(0.1), 600, 450),
    null,
  );
});
test("rotation-only, parallel rays and degenerate correspondences cannot invent screen depth", () => {
  assert.equal(
    triangulate(
      { origin: [0, 0, 0], direction: [0, 0, -1] },
      { origin: [0, 0, 0], direction: [0.1, 0, -1] },
    ),
    null,
  );
  assert.equal(
    triangulate(
      { origin: [0, 0, 0], direction: [0, 0, -1] },
      { origin: [0.1, 0, 0], direction: [0, 0, -1] },
    ),
    null,
  );
  assert.equal(
    fitScreen(
      Array.from({ length: 20 }, () => ({
        point: { x: 10, y: 10 },
        world: [0, 0, -1],
      })),
      600,
      450,
    ),
    null,
  );
});
test("screen pose requires repeated agreement and is held fixed while fresh matches are verified", () => {
  const stable = new StableScreen();
  assert.equal(stable.accept(plane), null);
  assert.equal(stable.accept({ ...plane, origin: [0.1, 0, -1] }), null);
  stable.reset();
  stable.accept(plane);
  const locked = stable.accept({ ...plane, origin: [-0.299, 0.225, -1] });
  assert.ok(locked);
  assert.equal(stable.verify(2), true);
  assert.equal(stable.plane, locked);
  assert.equal(stable.verify(9), false);
  assert.equal(stable.plane, locked);
  stable.verify(10);
  stable.verify(12);
  assert.equal(stable.plane, null);
});
