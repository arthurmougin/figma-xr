import test from "node:test";
import assert from "node:assert/strict";
import cvModule from "@techstark/opencv-js";
import { FeatureMatcher } from "../src/companion/features.mjs";
const cv = await cvModule;
test("natural features recover a perspective canvas and discard an edited or blank reference", () => {
  const tracker = new FeatureMatcher(cv),
    ref = new cv.Mat(480, 640, cv.CV_8UC4, new cv.Scalar(230, 230, 230, 255)),
    warped = new cv.Mat();
  const H = cv.matFromArray(
    3,
    3,
    cv.CV_64F,
    [0.82, 0.035, 38, -0.025, 0.8, 44, 0.00003, 0.00008, 1],
  );
  try {
    let seed = 42;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let i = 0; i < 160; i++) {
      const x = 20 + Math.floor(random() * 570),
        y = 20 + Math.floor(random() * 420),
        r = 3 + Math.floor(random() * 13);
      cv.rectangle(
        ref,
        new cv.Point(x, y),
        new cv.Point(x + r * 2, y + r),
        new cv.Scalar(random() * 180, random() * 180, random() * 180, 255),
        i % 3 === 0 ? -1 : 2,
      );
    }
    cv.putText(
      ref,
      "Figma XR live canvas",
      new cv.Point(65, 230),
      cv.FONT_HERSHEY_SIMPLEX,
      1.1,
      new cv.Scalar(15, 20, 30, 255),
      2,
    );
    assert.ok(tracker.setReference(ref.data, 640, 480, 7) > 200);
    cv.warpPerspective(
      ref,
      warped,
      H,
      new cv.Size(640, 480),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(80, 80, 80, 255),
    );
    const match = tracker.match(warped.data, 640, 480);
    assert.ok(match);
    assert.equal(match.revision, 7);
    assert.ok(match.inliers > 40);
    assert.ok(match.error < 2.5);
    const p = { x: 320, y: 240 };
    const project = (h) => {
      const w = h[6] * p.x + h[7] * p.y + h[8];
      return [
        (h[0] * p.x + h[1] * p.y + h[2]) / w,
        (h[3] * p.x + h[4] * p.y + h[5]) / w,
      ];
    };
    const a = project(match.homography),
      b = project(Array.from(H.data64F));
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 2);
    tracker.clear();
    assert.equal(tracker.match(warped.data, 640, 480), null);
    assert.equal(
      tracker.setReference(new Uint8Array(640 * 480 * 4), 640, 480, 8),
      0,
    );
    assert.equal(tracker.match(warped.data, 640, 480), null);
  } finally {
    tracker.dispose();
    ref.delete();
    warped.delete();
    H.delete();
  }
});
