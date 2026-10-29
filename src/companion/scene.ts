import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  Quaternion,
  Matrix,
  Color3,
  Color4,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  Texture,
  WebXRDefaultExperience,
  WebXRRawCameraAccess,
  WebXRAnchorSystem,
  SixDofDragBehavior,
  MultiPointerScaleBehavior,
  RenderTargetTexture,
  CopyTextureToTexture,
  type IWebXRAnchor,
  Ray as BabylonRay,
} from "@babylonjs/core";
import { ViewportTracker } from "./tracker";
import { PendingTaps, type TapOutcome } from "./pending-taps";
import { TapFeedback } from "./tap-feedback";
import {
  ScreenCalibrator,
  StableScreen,
  planeError,
  screenPosition,
  unit,
  cross,
  mul,
} from "./geometry";
import type {
  CatalogItem,
  ViewportSnapshot,
  Ray,
  CameraFrame,
  Vec3,
} from "./types";
const vector = (v: Vec3) => Vector3.FromArray(v);
export class CompanionScene {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private xr: WebXRDefaultExperience | null = null;
  private raw: WebXRRawCameraAccess | null = null;
  private anchors: WebXRAnchorSystem | null = null;
  private tracker: ViewportTracker | null = null;
  private calibrator = new ScreenCalibrator();
  private stable = new StableScreen();
  private snapshot: ViewportSnapshot | null = null;
  private items = new Map<string, CatalogItem>();
  private copy: CopyTextureToTexture;
  private target: RenderTargetTexture | null = null;
  private processing = false;
  private captureTime = 0;
  private matchedAt = 0;
  private disposed = false;
  private scanning = false;
  private inXR = false;
  private meshes: Mesh[] = [];
  private objectAnchors = new Map<Mesh, IWebXRAnchor>();
  private anchorEpoch = new Map<Mesh, number>();
  private taps = new PendingTaps();
  private feedback: TapFeedback;
  private canvasEpoch = 0;
  private trackingEpoch = 0;
  private pendingCount = 0;
  onStatus: (status: string) => void = () => {};
  onXR: (active: boolean) => void = () => {};
  onClone: (id: string) => void = () => {};
  onPending: (count: number) => void = () => {};
  private resize = () => this.engine.resize();
  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
    });
    this.scene = new Scene(this.engine);
    this.scene.useRightHandedSystem = true;
    this.scene.clearColor = new Color4(0.035, 0.05, 0.08, 1);
    this.camera = new FreeCamera(
      "companion-camera",
      new Vector3(0, 0, 0),
      this.scene,
    );
    this.camera.minZ = 0.01;
    this.camera.setTarget(new Vector3(0, 0, -1));
    this.camera.attachControl(canvas, true);
    this.copy = new CopyTextureToTexture(this.engine);
    this.feedback = new TapFeedback(this.scene);
    this.scene.onBeforeRenderObservable.add(() => this.processTaps());
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", this.resize);
  }
  updateCatalog(items: CatalogItem[]) {
    this.items = new Map(items.map((item) => [item.id, item]));
  }
  updateSnapshot(
    snapshot: ViewportSnapshot | null,
    canvasEpoch = this.canvasEpoch,
  ) {
    if (this.snapshot === snapshot && this.canvasEpoch === canvasEpoch) return;
    this.canvasEpoch = canvasEpoch;
    this.handleTapOutcomes(this.taps.setReference(snapshot, canvasEpoch));
    this.snapshot = snapshot;
    this.resetScreen(false);
    if (!snapshot) {
      this.tracker?.clear();
      if (this.scanning) this.trackingStatus("Waiting for the current canvas…");
      return;
    }
    if (this.scanning) this.loadReference(snapshot);
  }
  private resetScreen(cancel = true) {
    this.trackingEpoch++;
    this.calibrator.reset();
    this.stable.reset();
    this.matchedAt = 0;
    if (cancel) this.handleTapOutcomes(this.taps.cancel("reset"));
  }
  private trackingStatus(message: string) {
    this.onStatus(
      this.taps.pending.length
        ? `Locating ${this.taps.pending.length === 1 ? "tapped item" : this.taps.pending.length + " tapped items"}… ${message}`
        : message,
    );
  }
  private loadReference(snapshot: ViewportSnapshot) {
    if (!this.tracker) {
      this.tracker = new ViewportTracker();
      this.tracker.onStatus = (status) => {
        if (this.scanning) this.trackingStatus(status);
      };
    }
    void this.tracker
      .setReference(snapshot)
      .catch(() =>
        this.onStatus(
          "Could not prepare the canvas image. Refresh in the plugin to retry.",
        ),
      );
  }
  async enterXR(root: HTMLElement) {
    if (!this.xr) {
      this.xr = await WebXRDefaultExperience.CreateAsync(this.scene, {
        disableDefaultUI: true,
        disableTeleportation: true,
        ignoreNativeCameraTransformation: true,
      });
      const manager = this.xr.baseExperience.sessionManager;
      this.raw = this.xr.baseExperience.featuresManager.enableFeature(
        WebXRRawCameraAccess.Name,
        "latest",
        {},
        true,
        false,
      ) as WebXRRawCameraAccess;
      this.anchors = this.xr.baseExperience.featuresManager.enableFeature(
        WebXRAnchorSystem.Name,
        "latest",
        {},
        true,
        false,
      ) as WebXRAnchorSystem;
      this.raw.onTexturesUpdatedObservable.add(() => this.capture());
      manager.onXRReferenceSpaceChanged.add(() => this.resetScreen());
      manager.onXRSessionInit.add((session) => {
        this.inXR = true;
        this.scene.clearColor.a = 0;
        this.onXR(true);
        const starts = new WeakMap<XRInputSource, Ray | null>();
        const readRay = (event: XRInputSourceEvent): Ray | null => {
          const pose = event.frame.getPose(
            event.inputSource.targetRaySpace,
            manager.referenceSpace,
          );
          if (!pose) return null;
          const m = pose.transform.matrix;
          return {
            origin: [m[12], m[13], m[14]],
            direction: unit([-m[8], -m[9], -m[10]]),
          };
        };
        session.addEventListener("selectstart", (event) => {
          const ray = readRay(event);
          if (!ray) {
            starts.delete(event.inputSource);
            return;
          }
          const hit =
            ray &&
            this.scene.pickWithRay(
              new BabylonRay(vector(ray.origin), vector(ray.direction)),
              (mesh) => this.meshes.includes(mesh as Mesh),
            );
          // A gesture that started on a placed object belongs to manipulation.
          starts.set(event.inputSource, hit?.hit ? null : ray);
        });
        session.addEventListener("select", (event) => {
          const ray = starts.has(event.inputSource)
            ? starts.get(event.inputSource)
            : readRay(event);
          if (ray) this.queueTap(ray);
        });
        session.addEventListener("selectend", (event) =>
          starts.delete(event.inputSource),
        );
      });
      manager.onXRSessionEnded.add(() => {
        this.inXR = false;
        this.scanning = false;
        this.clear();
        this.scene.clearColor.a = 1;
        this.resetScreen();
        this.onXR(false);
        this.onStatus("AR ended. Your catalog is still ready.");
      });
    }
    await this.xr.baseExperience.enterXRAsync(
      "immersive-ar",
      "local",
      undefined,
      {
        optionalFeatures: ["camera-access", "anchors", "dom-overlay"],
        domOverlay: { root },
      },
    );
    this.setScanning(true);
    if (this.scanning)
      this.onStatus(
        "Tap the desktop at any time to copy an item, or place one from your catalog.",
      );
  }
  setScanning(enabled: boolean) {
    this.scanning = enabled;
    this.resetScreen(false);
    if (enabled) {
      if (!this.inXR) {
        this.scanning = false;
        this.onStatus("Enter AR before scanning your desktop.");
        return;
      }
      if (!this.raw?.attached) {
        this.scanning = false;
        this.onStatus(
          "Camera access was not granted for this AR session. Catalog placement is ready.",
        );
        return;
      }
      if (this.snapshot) this.loadReference(this.snapshot);
      else this.onStatus("Waiting for the plugin’s current canvas…");
    } else
      this.onStatus(
        "Tap a catalog item to place another copy. Drag or pinch placed items.",
      );
  }
  recalibrate() {
    this.cancelPending();
    this.setScanning(true);
  }
  cancelPending() {
    this.handleTapOutcomes(this.taps.cancel("cancelled"));
  }
  private queueTap(ray: Ray) {
    const { tap, outcomes } = this.taps.enqueue(ray, performance.now());
    this.handleTapOutcomes(outcomes);
    this.feedback.show(tap, this.anchors);
    this.notifyPending();
    this.trackingStatus("Your tap is saved. Move slightly sideways if needed.");
    this.processTaps();
  }
  private notifyPending() {
    const count = this.taps.pending.length;
    if (count !== this.pendingCount) {
      this.pendingCount = count;
      this.onPending(count);
    }
  }
  private processTaps() {
    const now = performance.now();
    for (const tap of this.taps.pending) {
      const ray = this.feedback.ray(tap.id);
      if (ray) this.taps.updateRay(tap.id, ray);
    }
    this.handleTapOutcomes(
      this.taps.pump(now, this.stable.plane, this.matchedAt, this.items),
    );
    this.feedback.animate(now);
  }
  private handleTapOutcomes(outcomes: TapOutcome[]) {
    for (const outcome of outcomes) {
      if (outcome.type === "resolved") this.copyResolvedTap(outcome);
      else {
        this.feedback.finish(outcome.tap.id, performance.now());
        const messages = {
          expired:
            "Could not locate that tap. Try again with the canvas in view.",
          "canvas-changed":
            "The canvas changed. Tap again to copy the updated item.",
          reset: "Tracking space changed. Tap again.",
          cancelled: "Pending copies cancelled.",
          empty: "No exported item at that tap.",
          capacity: "The oldest pending tap was replaced.",
        };
        this.onStatus(messages[outcome.reason]);
      }
    }
    this.notifyPending();
  }
  private capture() {
    if (
      !this.scanning ||
      this.processing ||
      !this.tracker ||
      !this.snapshot ||
      !this.copy.isReady() ||
      performance.now() - this.captureTime < 220
    )
      return;
    const manager = this.xr!.baseExperience.sessionManager,
      frame = manager.currentFrame;
    if (!frame) return;
    const view = frame.getViewerPose(manager.referenceSpace)?.views[0],
      source = this.raw!.texturesData[0];
    if (!view?.camera || !source) return;
    const factor = Math.min(1, 640 / view.camera.width),
      width = Math.round(view.camera.width * factor),
      height = Math.round(view.camera.height * factor);
    if (
      !this.target ||
      this.target.getSize().width !== width ||
      this.target.getSize().height !== height
    ) {
      this.target?.dispose();
      this.target = new RenderTargetTexture(
        "tracker-camera",
        { width, height },
        this.scene,
        false,
        true,
      );
    }
    if (
      !this.target.renderTarget ||
      !this.copy.copy(source, this.target.renderTarget)
    )
      return;
    const camera: CameraFrame = {
      width,
      height,
      projection: Array.from(view.projectionMatrix),
      cameraWorld: Array.from(view.transform.matrix),
    };
    const revision = this.snapshot.revision,
      snapshot = this.snapshot,
      trackingEpoch = this.trackingEpoch,
      capturedAt = performance.now();
    this.processing = true;
    this.captureTime = performance.now();
    const read = this.target.readPixels();
    if (!read) {
      this.processing = false;
      return;
    }
    void read
      .then(async (data) => {
        const bytes = new Uint8Array(
            data.buffer,
            data.byteOffset,
            data.byteLength,
          ),
          pixels = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++)
          pixels.set(
            bytes.subarray(
              (height - 1 - y) * width * 4,
              (height - y) * width * 4,
            ),
            y * width * 4,
          );
        const match = await this.tracker!.match(pixels, width, height);
        if (
          this.disposed ||
          !this.scanning ||
          this.trackingEpoch !== trackingEpoch ||
          this.snapshot?.revision !== revision
        )
          return;
        if (!match) {
          if (performance.now() - this.matchedAt > 1000)
            this.trackingStatus("Keep the canvas in view and avoid glare.");
          return;
        }
        if (!this.stable.plane) {
          const plane = this.calibrator.add(
            match,
            camera,
            snapshot.pixelWidth,
            snapshot.pixelHeight,
          );
          if (plane) this.stable.accept(plane);
        }
        if (
          this.stable.plane &&
          this.stable.verify(
            planeError(
              this.stable.plane,
              match,
              camera,
              snapshot.pixelWidth,
              snapshot.pixelHeight,
            ),
          )
        ) {
          this.matchedAt = capturedAt;
          this.trackingStatus("Canvas located. Tap whenever you want.");
          this.processTaps();
        } else
          this.trackingStatus("Move slightly sideways to locate the screen.");
      })
      .catch(() => {
        if (this.scanning)
          this.onStatus(
            "Could not read the AR camera frame. Try leaving and re-entering AR.",
          );
      })
      .finally(() => {
        this.processing = false;
      });
  }
  private copyResolvedTap(outcome: Extract<TapOutcome, { type: "resolved" }>) {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const {
        item,
        entry: selected,
        plane,
        tap: { ray },
        uv,
      } = outcome,
      rect = selected.bounds;
    const position = screenPosition(
      plane,
      (rect.x + rect.width / 2 - snapshot.bounds.x) / snapshot.bounds.width,
      (rect.y + rect.height / 2 - snapshot.bounds.y) / snapshot.bounds.height,
    );
    // Offset a few mm toward the viewer to avoid coplanar z-fighting.
    const facing =
      Vector3.Dot(vector(plane.normal), vector(ray.direction)) < 0 ? 1 : -1;
    const at = vector(position).add(vector(plane.normal).scale(0.008 * facing));
    const right = vector(unit(plane.axisU)),
      up = vector(mul(unit(plane.axisV), -1)),
      normal = vector(
        unit(cross(unit(plane.axisU), mul(unit(plane.axisV), -1))),
      );
    const basis = Matrix.Identity();
    Matrix.FromXYZAxesToRef(right, up, normal, basis);
    const width =
      (vector(plane.axisU).length() * rect.width) / snapshot.bounds.width;
    const rotation = Quaternion.FromRotationMatrix(basis);
    this.feedback.finish(outcome.tap.id, performance.now(), {
      position: vector(screenPosition(plane, uv.x, uv.y)).add(
        vector(plane.normal).scale(0.008 * facing),
      ),
      rotation,
    });
    if (this.spawn(item, at, rotation, width)) {
      this.onClone(item.id);
      this.onStatus(`Copied ${item.name} · drag to move, pinch to scale.`);
    }
  }
  place(item: CatalogItem) {
    const camera = this.scene.activeCamera!,
      ray = camera.getForwardRay(0.65),
      position = ray.origin.add(ray.direction.scale(0.65));
    if (
      this.spawn(
        item,
        position,
        camera.absoluteRotation.clone(),
        Math.min(0.35, (0.25 * item.width) / item.height),
      )
    )
      this.onStatus(`Placed ${item.name} · drag to move, pinch to scale.`);
  }
  private spawn(
    item: CatalogItem,
    position: Vector3,
    rotation: Quaternion,
    width: number,
  ) {
    if (this.meshes.length >= 60) {
      this.onStatus("Clear placed items before adding more copies.");
      return false;
    }
    const mesh = MeshBuilder.CreatePlane(
      item.name,
      { width, height: (width * item.height) / item.width },
      this.scene,
    );
    mesh.position.copyFrom(position);
    mesh.rotationQuaternion = rotation;
    mesh.isPickable = true;
    // Immutable per-clone texture/material: catalog updates cannot mutate a copy.
    const material = new StandardMaterial(
        `copy-${item.id}-${item.version}`,
        this.scene,
      ),
      texture = new Texture(item.image, this.scene, false, true);
    texture.hasAlpha = true;
    material.diffuseTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    material.backFaceCulling = false;
    mesh.material = material;
    const drag = new SixDofDragBehavior();
    drag.rotateDraggedObject = false;
    mesh.addBehavior(drag);
    mesh.addBehavior(new MultiPointerScaleBehavior());
    drag.onDragStartObservable.add(() => {
      this.anchorEpoch.set(mesh, (this.anchorEpoch.get(mesh) || 0) + 1);
      this.objectAnchors.get(mesh)?.remove();
      this.objectAnchors.delete(mesh);
    });
    drag.onDragEndObservable.add(() => void this.anchor(mesh));
    this.meshes.push(mesh);
    void this.anchor(mesh);
    material.emissiveColor = new Color3(1.6, 1.6, 1.6);
    setTimeout(() => {
      if (!mesh.isDisposed()) material.emissiveColor = Color3.White();
    }, 180);
    return true;
  }
  private async anchor(mesh: Mesh) {
    if (!this.inXR || !this.anchors?.attached) return;
    const epoch = (this.anchorEpoch.get(mesh) || 0) + 1;
    this.anchorEpoch.set(mesh, epoch);
    try {
      const anchor = await this.anchors.addAnchorAtPositionAndRotationAsync(
        mesh.position.clone(),
        mesh.rotationQuaternion?.clone(),
      );
      if (mesh.isDisposed() || this.anchorEpoch.get(mesh) !== epoch) {
        anchor.remove();
        return;
      }
      anchor.attachedNode = mesh;
      this.objectAnchors.set(mesh, anchor);
    } catch {
      /* World placement remains available when an anchor request fails. */
    }
  }
  clear() {
    this.taps.cancel();
    this.feedback.clear();
    this.notifyPending();
    for (const mesh of this.meshes) {
      this.objectAnchors.get(mesh)?.remove();
      mesh.dispose(false, true);
    }
    this.meshes = [];
    this.objectAnchors.clear();
    this.anchorEpoch.clear();
  }
  dispose() {
    this.disposed = true;
    this.scanning = false;
    window.removeEventListener("resize", this.resize);
    this.tracker?.dispose();
    this.clear();
    this.copy.dispose();
    this.target?.dispose();
    this.xr?.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
