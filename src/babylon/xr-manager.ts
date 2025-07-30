import {
	Mesh,
	Scene,
	WebXRAnchorSystem,
	WebXRBackgroundRemover,
	WebXRDefaultExperience,
	WebXRDepthSensing,
	WebXRDomOverlay,
	WebXRLightEstimation,
	WebXRState,
	IWebXRAnchor,
	WebXRNearInteraction,
} from "@babylonjs/core";

const xrPolyfillPromise = new Promise((resolve) => {
	if (navigator.xr) {
		return resolve(true);
	}
	if ((<any>window).WebXRPolyfill) {
		//@ts-ignore
		new WebXRPolyfill();
		return resolve(true);
	} else {
		const url =
			"https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js";
		const s = document.createElement("script");
		s.src = url;
		document.head.appendChild(s);
		s.onload = () => {
			//@ts-ignore
			new WebXRPolyfill();
			resolve(true);
		};
	}
});

export class XRManager {
	scene: Scene;
	xrFeatures: {
		webXRDefaultExperience?: WebXRDefaultExperience;
		webXRAnchorSystem?: WebXRAnchorSystem;
		xrBackgroundRemover?: WebXRBackgroundRemover;
		webXRDOMOverlay?: WebXRDomOverlay;
		webXRLightEstimation?: WebXRLightEstimation;
		webXRDepthSensing?: WebXRDepthSensing;
		webXRNearInteraction?: WebXRNearInteraction;
	} = {};
	anchorMap: Map<string, IWebXRAnchor> = new Map();
	constructor(scene: Scene) {
		this.scene = scene;
		this.xrFeatures = {};
		this.initXR(scene);
	}

	async initXR(scene: Scene) {
		await xrPolyfillPromise;

		const webXRDefaultExperience =
			await scene.createDefaultXRExperienceAsync({
				uiOptions: {
					sessionMode: "immersive-ar",
					referenceSpaceType: "unbounded",
				},
				disableTeleportation: true,
				optionalFeatures: [
					"hit-test",
					"anchors",
					"light-estimation",
					"dom-overlay",
					"depth-sensing",
				],
				disablePointerSelection: false,
				pointerSelectionOptions: {
					disablePointerUpOnTouchOut: false,
					enablePointerSelectionOnAllControllers: true,
				},
			});
		this.xrFeatures.webXRDefaultExperience = webXRDefaultExperience;

		//set the advanced texture as plane attached to the XR camera when entering XR and set it back when exiting
		// on enter in xr

		const featuresManager =
			webXRDefaultExperience.baseExperience.featuresManager;
		const webXRAnchorSystem: WebXRAnchorSystem =
			featuresManager.enableFeature(
				WebXRAnchorSystem,
				"latest",
				{},
				true,
				false
			) as WebXRAnchorSystem;
		this.xrFeatures.webXRAnchorSystem = webXRAnchorSystem;

		const xrBackgroundRemover = featuresManager.enableFeature(
			WebXRBackgroundRemover,
			"latest",
			{
				environmentHelperRemovalFlags: {
					skyBox: true,
					ground: true,
				},
			}
		);
		this.xrFeatures.xrBackgroundRemover =
			xrBackgroundRemover as WebXRBackgroundRemover;

		const domOverlay = featuresManager.enableFeature(
			WebXRDomOverlay,
			"latest",
			{
				element: "#ui-container",
			}
		);
		this.xrFeatures.webXRDOMOverlay = domOverlay as WebXRDomOverlay;

		const lightEstimation = featuresManager.enableFeature(
			WebXRLightEstimation,
			"latest",
			{
				setSceneEnvironmentTexture: true,
				createDirectionalLightSource: true,
			},
			true,
			false
		);
		this.xrFeatures.webXRLightEstimation =
			lightEstimation as WebXRLightEstimation;

		const depthSensing = featuresManager.enableFeature(
			WebXRDepthSensing,
			"latest",
			{
				dataFormatPreference: ["ushort", "float"],
				usagePreference: ["cpu", "gpu"],
				disableDepthSensingOnMaterials: false,
			},
			true,
			false
		);
		this.xrFeatures.webXRDepthSensing = depthSensing as WebXRDepthSensing;

		console.log(featuresManager.getEnabledFeatures());

		webXRDefaultExperience.baseExperience.onStateChangedObservable.add(
			(state) => {
				console.log("XR State Changed:", state);
				switch (state) {
					case WebXRState.IN_XR:
						console.log("Entered XR");
						//disable hemispherical light

						break;
					case WebXRState.ENTERING_XR:
						console.log("Entering XR");
						break;
					case WebXRState.EXITING_XR:
						console.log("Exited XR");
						break;
					case WebXRState.NOT_IN_XR:
						console.log("Not in XR");
						//enable hemispherical light
						break;
				}
			}
		);
	}

	async unanchorChild(mesh: Mesh) {
		const anchor = this.anchorMap.get(mesh.id);
		if (anchor) {
			anchor.remove();
		} else {
			console.warn("Anchor not found");
		}
	}

	async anchorChild(mesh: Mesh) {
		const oldAnchor = this.anchorMap.get(mesh.id);
		if (oldAnchor) {
			oldAnchor.remove();
		}
		const webXRDefaultExperience = this.xrFeatures.webXRDefaultExperience;
		const webXRAnchorSystem = this.xrFeatures.webXRAnchorSystem;

		if (!webXRDefaultExperience || !webXRAnchorSystem) {
			console.warn("WebXR experience or anchor system not found");
			return;
		}

		try {
			const anchor =
				await webXRAnchorSystem.addAnchorAtPositionAndRotationAsync(
					mesh.position,
					mesh.rotationQuaternion
						? mesh.rotationQuaternion
						: mesh.rotation.toQuaternion()
				);
			anchor.attachedNode = mesh;
			this.anchorMap.set(mesh.id, anchor);
		} catch (e) {
			console.warn(e);
		}
	}
}
