import {
	Camera,
	Color3,
	DeviceOrientationCamera,
	Engine,
	HemisphericLight,
	Mesh,
	MeshBuilder,
	Scene,
	StandardMaterial,
	Texture,
	Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D";
import { Inspector } from "@babylonjs/inspector";

import { TwickedFrameNode } from "../definition";
import { InteractionManager } from "./interaction-manager";

// create button type that extends Control and add frame as property
type MeshFrame = Mesh & {
	frame?: TwickedFrameNode;
};

export class SceneManager {
	UI?: AdvancedDynamicTexture;
	engine: Engine;
	scene: Scene;

	interactionManager: InteractionManager;
	constructor(canvas: HTMLCanvasElement) {
		var engine = new Engine(canvas, true, undefined, true);
		var scene = new Scene(engine);

		this.engine = engine;
		this.scene = scene;

		// This creates and positions a free camera (non-mesh)
		var camera = new DeviceOrientationCamera(
			"camera1",
			new Vector3(0, 5, -10),
			scene
		);

		// This targets the camera to scene origin
		camera.setTarget(Vector3.Zero());

		// This attaches the camera to the canvas
		camera.attachControl(canvas, true);
		camera.speed = 0.1;
		camera.minZ = 0.1;

		// This creates a light, aiming 0,1,0 - to the sky (non-mesh)
		var light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);

		// Default intensity is 1. Let's dim the light a small amount
		light.intensity = 0.9;

		const environment = scene.createDefaultEnvironment({
			skyboxSize: 100,
		});
		if (environment) {
			environment.setMainColor(Color3.FromHexString("#79ecec"));
		}

		engine.runRenderLoop(() => {
			scene.render();
		});

		window.addEventListener("resize", function () {
			engine.resize();
		});

		this.interactionManager = new InteractionManager(this.scene);

		// Debug
		document.addEventListener("keydown", (event) => {
			if (event.key === "i") {
				if (this.scene.debugLayer.isVisible()) {
					Inspector.Hide();
				} else {
					Inspector.Show(this.scene, {
						overlay: true,
						globalRoot: document.body,
					});
				}
			}
		});
	}
	async Spawn(frame: TwickedFrameNode) {
		const scene = this.scene;
		const canvas = scene?.getEngine().getRenderingCanvas();
		if (!scene || !canvas || !frame.image) return;

		//create a plane
		const plane = MeshBuilder.CreatePlane(
			"plane-" + frame.id,
			{ size: 0.125, sideOrientation: Mesh.DOUBLESIDE },
			scene
		) as MeshFrame;
		plane.frame = frame;

		//set plane in front of camera
		plane.position = new Vector3(0, 0, 0.5);
		const camera = scene.activeCamera as Camera;
		plane.parent = camera;
		//then live it there as child of scene
		plane.setParent(null);

		//set plane material to frame image as png with variable opacity
		const material = new StandardMaterial("material", scene);
		material.diffuseTexture = new Texture(frame.image, scene);
		material.diffuseTexture.hasAlpha = true;
		material.useAlphaFromDiffuseTexture = true;
		material.needDepthPrePass = true;
		console.log(material);
		plane.material = material;

		(material.diffuseTexture as Texture).onLoadObservable.add(() => {
			const aspectRatio =
				(material?.diffuseTexture?._texture?.baseWidth || 1) /
				(material?.diffuseTexture?._texture?.baseHeight || 1);
			plane.scaling = new Vector3(aspectRatio, 1, 1);
		});

		this.interactionManager.initChildInteraction(plane);
	}
}

export default SceneManager;
