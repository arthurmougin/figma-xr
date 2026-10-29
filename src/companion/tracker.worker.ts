import cvModule from "@techstark/opencv-js";
import { FeatureMatcher } from "./features.mjs";
const ready = Promise.resolve(cvModule).then((cv) => new FeatureMatcher(cv));
let revision = -1,
  scaleX = 1,
  scaleY = 1;
self.onmessage = async (event) => {
  const data = event.data;
  try {
    const tracker = await ready;
    if (data.type === "reference") {
      revision = data.revision;
      scaleX = data.width / data.originalWidth;
      scaleY = data.height / data.originalHeight;
      const count = tracker.setReference(
        new Uint8ClampedArray(data.pixels),
        data.width,
        data.height,
        revision,
      );
      self.postMessage({ type: "reference", revision, count });
    } else if (data.type === "clear") {
      revision = -1;
      tracker.clear();
    } else if (data.type === "frame") {
      const match =
        data.revision === revision
          ? tracker.match(
              new Uint8ClampedArray(data.pixels),
              data.width,
              data.height,
            )
          : null;
      if (match) {
        for (const p of match.points) {
          p.reference.x /= scaleX;
          p.reference.y /= scaleY;
        }
        for (const i of [0, 3, 6]) match.homography[i] *= scaleX;
        for (const i of [1, 4, 7]) match.homography[i] *= scaleY;
      }
      self.postMessage({
        type: "match",
        id: data.id,
        revision: data.revision,
        match,
      });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      id: data.id,
      message:
        error instanceof Error ? error.message : "Image tracking failed.",
    });
  }
};
