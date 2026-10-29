import type {
  CameraFrame,
  MatchResult,
  Point,
  Ray,
  Rect,
  ScreenPlane,
  Vec3,
  ViewportItem,
} from "./types.ts";
export const add = (a: Vec3, b: Vec3): Vec3 =>
  a.map((v, i) => v + b[i]) as Vec3;
export const sub = (a: Vec3, b: Vec3): Vec3 =>
  a.map((v, i) => v - b[i]) as Vec3;
export const mul = (a: Vec3, n: number): Vec3 => a.map((v) => v * n) as Vec3;
export const dot = (a: Vec3, b: Vec3): number =>
  a.reduce((n, v, i) => n + v * b[i], 0);
export const length = (a: Vec3): number => Math.hypot(...a);
export const unit = (a: Vec3): Vec3 => mul(a, 1 / length(a));
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function invert3(m: number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const out = [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ];
  const det = a * out[0] + b * out[3] + c * out[6];
  return Math.abs(det) < 1e-12 ? null : out.map((v) => v / det);
}
export function transformPoint(h: number[], p: Point): Point | null {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-9) return null;
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}
export function contains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}
export function pickItem(
  items: ViewportItem[],
  point: Point,
): ViewportItem | undefined {
  // The plugin supplies paint order. No nearest-centre fallback on empty space.
  return items
    .filter((item) => contains(item.bounds, point))
    .sort(
      (a, b) =>
        b.z - a.z ||
        a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height,
    )[0];
}
export function pixelRay(point: Point, frame: CameraFrame): Ray {
  const p = frame.projection,
    m = frame.cameraWorld;
  const y = (1 - (2 * point.y) / frame.height + p[9]) / p[5];
  const x = ((2 * point.x) / frame.width - 1 + p[8] - p[4] * y) / p[0];
  const d: Vec3 = [x, y, -1];
  return {
    origin: [m[12], m[13], m[14]],
    direction: unit([
      m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
      m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
      m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
    ]),
  };
}
export function triangulate(a: Ray, b: Ray): Vec3 | null {
  const baseline = length(sub(a.origin, b.origin));
  const cosine = dot(a.direction, b.direction),
    denominator = 1 - cosine * cosine;
  if (baseline < 0.025 || denominator < 0.0001) return null;
  const delta = sub(a.origin, b.origin),
    d = dot(a.direction, delta),
    e = dot(b.direction, delta);
  const ta = (cosine * e - d) / denominator,
    tb = (e - cosine * d) / denominator;
  if (ta < 0.1 || tb < 0.1 || ta > 5 || tb > 5) return null;
  const pa = add(a.origin, mul(a.direction, ta)),
    pb = add(b.origin, mul(b.direction, tb));
  return length(sub(pa, pb)) > 0.025 ? null : mul(add(pa, pb), 0.5);
}
export function fitScreen(
  samples: { point: Point; world: Vec3 }[],
  width: number,
  height: number,
): ScreenPlane | null {
  if (samples.length < 8) return null;
  const normal = Array(9).fill(0),
    targets = [Array(3).fill(0), Array(3).fill(0), Array(3).fill(0)];
  for (const s of samples) {
    const r = [1, s.point.x / width, s.point.y / height];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) normal[i * 3 + j] += r[i] * r[j];
      for (let k = 0; k < 3; k++) targets[k][i] += r[i] * s.world[k];
    }
  }
  const inv = invert3(normal);
  if (!inv) return null;
  const coefficients = targets.map((t) =>
    [0, 1, 2].map((i) =>
      inv.slice(i * 3, i * 3 + 3).reduce((sum, v, j) => sum + v * t[j], 0),
    ),
  );
  const origin = coefficients.map((c) => c[0]) as Vec3,
    axisU = coefficients.map((c) => c[1]) as Vec3,
    axisV = coefficients.map((c) => c[2]) as Vec3;
  const w = length(axisU),
    h = length(axisV);
  if (
    w < 0.08 ||
    h < 0.04 ||
    w > 4 ||
    h > 3 ||
    Math.abs(dot(unit(axisU), unit(axisV))) > 0.15 ||
    Math.abs(w / h / (width / height) - 1) > 0.2
  )
    return null;
  const residual = Math.sqrt(
    samples.reduce(
      (sum, s) =>
        sum +
        length(
          sub(
            add(
              add(origin, mul(axisU, s.point.x / width)),
              mul(axisV, s.point.y / height),
            ),
            s.world,
          ),
        ) **
          2,
      0,
    ) / samples.length,
  );
  return residual > 0.015
    ? null
    : { origin, axisU, axisV, normal: unit(cross(axisU, axisV)), residual };
}
export function intersectScreen(ray: Ray, plane: ScreenPlane): Point | null {
  const den = dot(ray.direction, plane.normal);
  if (Math.abs(den) < 1e-6) return null;
  const distance = dot(sub(plane.origin, ray.origin), plane.normal) / den;
  if (distance <= 0) return null;
  const delta = sub(
    add(ray.origin, mul(ray.direction, distance)),
    plane.origin,
  );
  const u = dot(plane.axisU, plane.axisU),
    v = dot(plane.axisV, plane.axisV),
    uv = dot(plane.axisU, plane.axisV),
    det = u * v - uv * uv;
  return {
    x: (dot(delta, plane.axisU) * v - dot(delta, plane.axisV) * uv) / det,
    y: (dot(delta, plane.axisV) * u - dot(delta, plane.axisU) * uv) / det,
  };
}
export function screenPosition(plane: ScreenPlane, u: number, v: number): Vec3 {
  return add(add(plane.origin, mul(plane.axisU, u)), mul(plane.axisV, v));
}
export class ScreenCalibrator {
  private observations: { match: MatchResult; frame: CameraFrame }[] = [];
  revision = -1;
  reset(revision = -1) {
    this.observations = [];
    this.revision = revision;
  }
  add(
    match: MatchResult,
    frame: CameraFrame,
    width: number,
    height: number,
  ): ScreenPlane | null {
    if (match.revision !== this.revision) this.reset(match.revision);
    const current = new Map(match.points.map((p) => [p.id, p]));
    for (const previous of this.observations) {
      const samples: { point: Point; world: Vec3 }[] = [];
      for (const point of previous.match.points) {
        const now = current.get(point.id);
        if (!now) continue;
        const world = triangulate(
          pixelRay(point.image, previous.frame),
          pixelRay(now.image, frame),
        );
        if (world) samples.push({ point: point.reference, world });
      }
      const plane = fitScreen(samples, width, height);
      if (plane) return plane;
    }
    this.observations.push({ match, frame });
    if (this.observations.length > 8) this.observations.shift();
    return null;
  }
}
export function projectWorld(point: Vec3, frame: CameraFrame): Point | null {
  const m = frame.cameraWorld,
    d = sub(point, [m[12], m[13], m[14]]),
    p = frame.projection;
  const x = dot(d, [m[0], m[1], m[2]]),
    y = dot(d, [m[4], m[5], m[6]]),
    z = dot(d, [m[8], m[9], m[10]]);
  if (z >= -0.01) return null;
  return {
    x: (((p[0] * x + p[4] * y + p[8] * z) / -z + 1) * frame.width) / 2,
    y: ((1 - (p[5] * y + p[9] * z) / -z) * frame.height) / 2,
  };
}
export function planeError(
  plane: ScreenPlane,
  match: MatchResult,
  frame: CameraFrame,
  width: number,
  height: number,
): number {
  const errors = match.points.map((point) => {
    const projected = projectWorld(
      screenPosition(
        plane,
        point.reference.x / width,
        point.reference.y / height,
      ),
      frame,
    );
    return projected
      ? Math.hypot(projected.x - point.image.x, projected.y - point.image.y)
      : Infinity;
  });
  return Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
}
// A screen pose is accepted across observations, then held fixed. New noisy
// homographies never drive existing objects. Reprojection checks detect drift.
export class StableScreen {
  plane: ScreenPlane | null = null;
  private candidate: ScreenPlane | null = null;
  private failures = 0;
  accept(plane: ScreenPlane): ScreenPlane | null {
    const previous = this.candidate;
    this.candidate = plane;
    if (
      previous &&
      length(sub(previous.origin, plane.origin)) < 0.025 &&
      dot(previous.normal, plane.normal) > 0.99 &&
      Math.abs(length(previous.axisU) / length(plane.axisU) - 1) < 0.08
    ) {
      this.plane = plane;
      this.failures = 0;
    }
    return this.plane;
  }
  verify(error: number): boolean {
    if (error <= 6) {
      this.failures = 0;
      return true;
    }
    if (++this.failures >= 3) this.reset();
    return false;
  }
  reset() {
    this.plane = null;
    this.candidate = null;
    this.failures = 0;
  }
}
