// A bounded CPU matcher shared by the camera worker and deterministic tests.
export class FeatureMatcher {
  constructor(cv) {
    this.cv = cv;
    this.orb = new cv.ORB(1400, 1.2, 8, 25, 0, 2, cv.ORB_HARRIS_SCORE, 31, 14);
    this.matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
    this.reference = null;
  }
  describe(rgba, width, height) {
    const cv = this.cv,
      source = cv.matFromArray(height, width, cv.CV_8UC4, rgba),
      gray = new cv.Mat(),
      smooth = new cv.Mat(),
      keypoints = new cv.KeyPointVector(),
      descriptors = new cv.Mat(),
      mask = new cv.Mat();
    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
      // Reduce pixel-grid noise on screens. This does not remove severe moire.
      cv.GaussianBlur(
        gray,
        smooth,
        new cv.Size(3, 3),
        0.7,
        0.7,
        cv.BORDER_DEFAULT,
      );
      this.orb.detectAndCompute(smooth, mask, keypoints, descriptors);
      const points = Array.from({ length: keypoints.size() }, (_, i) => {
        const p = keypoints.get(i).pt;
        return { x: p.x, y: p.y };
      });
      return { points, descriptors };
    } catch (error) {
      descriptors.delete();
      throw error;
    } finally {
      source.delete();
      gray.delete();
      smooth.delete();
      keypoints.delete();
      mask.delete();
    }
  }
  clear() {
    this.reference?.descriptors.delete();
    this.reference = null;
  }
  setReference(rgba, width, height, revision) {
    this.clear();
    this.reference = {
      ...this.describe(rgba, width, height),
      width,
      height,
      revision,
    };
    return this.reference.points.length;
  }
  match(rgba, width, height) {
    const ref = this.reference;
    if (!ref || ref.descriptors.rows < 16) return null;
    const cv = this.cv,
      frame = this.describe(rgba, width, height),
      pairs = new cv.DMatchVectorVector();
    let source, target, mask, h;
    try {
      if (frame.descriptors.rows < 16) return null;
      this.matcher.knnMatch(ref.descriptors, frame.descriptors, pairs, 2);
      const candidates = [],
        used = new Set();
      for (let i = 0; i < pairs.size(); i++) {
        const pair = pairs.get(i);
        try {
          if (pair.size() < 2) continue;
          const a = pair.get(0),
            b = pair.get(1);
          if (
            a.distance < 0.72 * b.distance &&
            a.distance < 65 &&
            !used.has(a.trainIdx)
          ) {
            used.add(a.trainIdx);
            candidates.push({
              id: a.queryIdx,
              reference: { ...ref.points[a.queryIdx] },
              image: { ...frame.points[a.trainIdx] },
            });
          }
        } finally {
          pair.delete();
        }
      }
      if (candidates.length < 16) return null;
      source = cv.matFromArray(
        candidates.length,
        1,
        cv.CV_32FC2,
        candidates.flatMap((p) => [p.reference.x, p.reference.y]),
      );
      target = cv.matFromArray(
        candidates.length,
        1,
        cv.CV_32FC2,
        candidates.flatMap((p) => [p.image.x, p.image.y]),
      );
      mask = new cv.Mat();
      h = cv.findHomography(source, target, cv.RANSAC, 3, mask, 1500, 0.995);
      if (h.empty()) return null;
      const homography = Array.from(h.data64F),
        points = candidates.filter((_, i) => mask.data[i]);
      if (points.length < 14 || points.length / candidates.length < 0.45)
        return null;
      const xs = points.map((p) => p.reference.x),
        ys = points.map((p) => p.reference.y);
      const coverage =
        ((Math.max(...xs) - Math.min(...xs)) *
          (Math.max(...ys) - Math.min(...ys))) /
        (ref.width * ref.height);
      if (coverage < 0.08) return null;
      const errors = points.map((p) => {
        const [a, b, c, d, e, f, g, j, k] = homography,
          w = g * p.reference.x + j * p.reference.y + k;
        return Math.hypot(
          (a * p.reference.x + b * p.reference.y + c) / w - p.image.x,
          (d * p.reference.x + e * p.reference.y + f) / w - p.image.y,
        );
      });
      const error = Math.sqrt(
        errors.reduce((sum, x) => sum + x * x, 0) / errors.length,
      );
      if (!Number.isFinite(error) || error > 2.5) return null;
      return {
        revision: ref.revision,
        homography,
        points,
        inliers: points.length,
        error,
        coverage,
      };
    } finally {
      frame.descriptors.delete();
      pairs.delete();
      source?.delete();
      target?.delete();
      mask?.delete();
      h?.delete();
    }
  }
  dispose() {
    this.clear();
    this.orb.delete();
    this.matcher.delete();
  }
}
