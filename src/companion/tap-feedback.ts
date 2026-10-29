import {
  Color3,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  type IWebXRAnchor,
  type LinesMesh,
  type WebXRAnchorSystem,
} from "@babylonjs/core";
import { cross, dot, mul, unit } from "./geometry.ts";
import type { PendingTap } from "./pending-taps.ts";
import type { Ray } from "./types.ts";
import { Matrix } from "@babylonjs/core";
interface Indicator {
  root: TransformNode;
  ring: Mesh;
  line: LinesMesh;
  material: StandardMaterial;
  createdAt: number;
  anchor?: IWebXRAnchor;
}
interface Fade {
  ring: Mesh;
  material: StandardMaterial;
  startedAt: number;
}
export class TapFeedback {
  private indicators = new Map<number, Indicator>();
  private fading: Fade[] = [];
  private scene: Scene;
  constructor(scene: Scene) {
    this.scene = scene;
  }
  show(tap: PendingTap, anchors: WebXRAnchorSystem | null) {
    const root = new TransformNode("pending-tap-ray", this.scene),
      ray = tap.ray;
    root.position.copyFromFloats(...ray.origin);
    const up =
      Math.abs(dot(ray.direction, [0, 1, 0])) > 0.98
        ? ([0, 0, 1] as const)
        : ([0, 1, 0] as const);
    const right = unit(cross(ray.direction, [...up])),
      vertical = unit(cross(right, ray.direction)),
      back = mul(ray.direction, -1);
    const basis = Matrix.Identity();
    Matrix.FromXYZAxesToRef(
      Vector3.FromArray(right),
      Vector3.FromArray(vertical),
      Vector3.FromArray(back),
      basis,
    );
    root.rotationQuaternion = Quaternion.FromRotationMatrix(basis);
    // This is feedback along a retained ray, not a claimed surface hit. Depth
    // remains unknown until the matched screen plane is available.
    const ring = MeshBuilder.CreateTorus(
      "pending-tap",
      { diameter: 0.025, thickness: 0.002, tessellation: 24 },
      this.scene,
    );
    ring.parent = root;
    ring.position.z = -0.65;
    ring.rotation.x = Math.PI / 2;
    ring.isPickable = false;
    const material = new StandardMaterial("pending-tap-feedback", this.scene);
    material.disableLighting = true;
    material.emissiveColor = new Color3(0.65, 0.55, 1);
    material.alpha = 0.8;
    ring.material = material;
    const line = MeshBuilder.CreateLines(
      "pending-tap-ray",
      { points: [new Vector3(0, 0, -0.08), new Vector3(0, 0, -1.5)] },
      this.scene,
    );
    line.parent = root;
    line.color = new Color3(0.65, 0.55, 1);
    line.alpha = 0.2;
    line.isPickable = false;
    const indicator = { root, ring, line, material, createdAt: tap.createdAt };
    this.indicators.set(tap.id, indicator);
    if (anchors?.attached) void this.anchor(tap.id, indicator, anchors);
  }
  private async anchor(
    id: number,
    indicator: Indicator,
    anchors: WebXRAnchorSystem,
  ) {
    try {
      const anchor = await anchors.addAnchorAtPositionAndRotationAsync(
        indicator.root.position.clone(),
        indicator.root.rotationQuaternion!.clone(),
      );
      if (this.indicators.get(id) !== indicator) {
        anchor.remove();
        return;
      }
      anchor.attachedNode = indicator.root;
      indicator.anchor = anchor;
    } catch {
      /* Retain the original ray in XR reference coordinates. */
    }
  }
  ray(id: number): Ray | null {
    const indicator = this.indicators.get(id);
    if (!indicator) return null;
    const matrix = indicator.root.computeWorldMatrix(true),
      origin = Vector3.TransformCoordinates(Vector3.Zero(), matrix),
      direction = Vector3.TransformNormal(
        new Vector3(0, 0, -1),
        matrix,
      ).normalize();
    return {
      origin: [origin.x, origin.y, origin.z],
      direction: [direction.x, direction.y, direction.z],
    };
  }
  finish(
    id: number,
    now: number,
    hit?: { position: Vector3; rotation: Quaternion },
  ) {
    const indicator = this.indicators.get(id);
    if (!indicator) return;
    const { root, ring, material } = indicator;
    ring.computeWorldMatrix(true);
    ring.setParent(null);
    if (hit) {
      ring.position.copyFrom(hit.position);
      ring.rotationQuaternion = hit.rotation.multiply(
        Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2),
      );
      ring.rotation.setAll(0);
    }
    material.emissiveColor = hit
      ? new Color3(0.6, 1, 0.85)
      : new Color3(1, 0.5, 0.45);
    indicator.anchor?.remove();
    root.dispose();
    this.indicators.delete(id);
    this.fading.push({ ring, material, startedAt: now });
  }
  animate(now: number) {
    for (const indicator of this.indicators.values()) {
      const pulse = 1 + 0.17 * Math.sin((now - indicator.createdAt) * 0.009);
      indicator.ring.scaling.setAll(pulse);
    }
    this.fading = this.fading.filter((effect) => {
      const t = (now - effect.startedAt) / 250;
      if (t >= 1) {
        effect.ring.dispose(false, true);
        return false;
      }
      effect.ring.scaling.setAll(1 + 2 * t);
      effect.material.alpha = 1 - t;
      return true;
    });
  }
  clear() {
    for (const indicator of this.indicators.values()) {
      indicator.anchor?.remove();
      indicator.root.dispose(false, true);
    }
    for (const effect of this.fading) effect.ring.dispose(false, true);
    this.indicators.clear();
    this.fading = [];
  }
}
