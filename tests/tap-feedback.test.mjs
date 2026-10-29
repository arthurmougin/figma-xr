import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine, Scene, Quaternion, Vector3 } from "@babylonjs/core";
import { TapFeedback } from "../src/companion/tap-feedback.ts";
const tap = {
  id: 1,
  createdAt: 1000,
  revision: 1,
  ray: { origin: [0, 0, 0], direction: [0, 0, -1] },
};
test("tap feedback follows anchor corrections and cleans up after resolution", async () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    feedback = new TapFeedback(scene);
  let anchor;
  const anchors = {
    attached: true,
    async addAnchorAtPositionAndRotationAsync() {
      anchor = {
        remove() {
          this.removed = true;
        },
      };
      return anchor;
    },
  };
  try {
    feedback.show(tap, anchors);
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(anchor.attachedNode);
    anchor.attachedNode.position.x = 0.1;
    assert.ok(Math.abs(feedback.ray(1).origin[0] - 0.1) < 1e-6);
    assert.ok(Math.abs(feedback.ray(1).direction[2] + 1) < 1e-6);
    feedback.finish(1, 1500, {
      position: new Vector3(0, 0, -1),
      rotation: Quaternion.Identity(),
    });
    assert.equal(anchor.removed, true);
    assert.equal(feedback.ray(1), null);
    feedback.animate(1800);
    assert.equal(scene.meshes.length, 0);
    feedback.clear();
  } finally {
    feedback.clear();
    scene.dispose();
    engine.dispose();
  }
});
test("a late anchor cannot resurrect cancelled tap feedback", async () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    feedback = new TapFeedback(scene);
  let finish;
  const anchor = {
    removed: false,
    remove() {
      this.removed = true;
    },
  };
  try {
    feedback.show(tap, {
      attached: true,
      addAnchorAtPositionAndRotationAsync: () =>
        new Promise((resolve) => (finish = resolve)),
    });
    feedback.clear();
    finish(anchor);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(anchor.removed, true);
    assert.equal(anchor.attachedNode, undefined);
    assert.equal(scene.meshes.length, 0);
    assert.equal(feedback.ray(1), null);
  } finally {
    feedback.clear();
    scene.dispose();
    engine.dispose();
  }
});
