import { useProjectStore } from "@/store/project.store";
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
import {
	GUI3DManager,
	StackPanel3D,
	TouchHolographicButton,
	TouchHolographicMenu,
} from "@babylonjs/gui";

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

	guiManager: GUI3DManager;
	ui: TouchHolographicMenu | undefined;
	buttonList: TouchHolographicButton[] = [];

	anchorMap: Map<string, IWebXRAnchor> = new Map();
	constructor(scene: Scene) {
		this.scene = scene;
		this.xrFeatures = {};
		this.initXR(scene);
		this.guiManager = new GUI3DManager(scene);
	}

	async initXR(scene: Scene) {
		await xrPolyfillPromise;

		//WebXR Features
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

		//XR UI
		this.ui = new TouchHolographicMenu("menu");
		//this.guiManager.addControl(this.ui);
		this.ui.backPlateMargin = 0.5;

		//const panelTop = new StackPanel3D();
		//const panelBottom = new StackPanel3D();

		this.ui.columns = 3;
		const previousButton = new TouchHolographicButton("Previous");
		previousButton.imageUrl = "../assets/icons/Back.png";
		this.ui.addButton(previousButton);
		const homeButton = new TouchHolographicButton("Home");
		this.ui.addButton(homeButton);
		const nextButton = new TouchHolographicButton("Next");
		nextButton.imageUrl = "../assets/icons/Front.png";
		this.ui.addButton(nextButton);

		const button1 = new TouchHolographicButton("Button 1");
		this.ui.addButton(button1);
		this.buttonList.push(button1);
		const button2 = new TouchHolographicButton("Button 2");
		this.ui.addButton(button2);
		this.buttonList.push(button2);
		const button3 = new TouchHolographicButton("Button 3");
		this.ui.addButton(button3);
		this.buttonList.push(button3);
		const button4 = new TouchHolographicButton("Button 4");
		this.ui.addButton(button4);
		this.buttonList.push(button4);
		const button5 = new TouchHolographicButton("Button 5");
		this.ui.addButton(button5);
		this.buttonList.push(button5);
		const button6 = new TouchHolographicButton("Button 6");
		this.ui.addButton(button6);
		this.buttonList.push(button6);
		const button7 = new TouchHolographicButton("Button 7");
		this.ui.addButton(button7);
		this.buttonList.push(button7);
		const button8 = new TouchHolographicButton("Button 8");
		this.ui.addButton(button8);
		this.buttonList.push(button8);
		const button9 = new TouchHolographicButton("Button 9");
		this.ui.addButton(button9);
		this.buttonList.push(button9);
	}

	async loadPagination(i = 1): Promise<void> {
		const QTE_PER_PAGE = 9;

		const projectStore = useProjectStore();
		const project = projectStore.projects.get(
			projectStore.currentProject || ""
		);
		if (!project) {
			throw new Error("Project not found");
		}
		const images = projectStore.currentImages;
		let loadedImages = images.filter((image) => image.image);

		//if we go back more, then we get back to top
		if (i < 1) i = Math.ceil(loadedImages.length / QTE_PER_PAGE);

		// Load the specified page of buttons
		const startIndex = (i - 1) * QTE_PER_PAGE;
		const endIndex = startIndex + QTE_PER_PAGE;

		//If we lack images to draw
		if (endIndex > loadedImages.length) {
			//but we can't load more images
			if (loadedImages.length == images.length) {
				return this.loadPagination(1);
			}

			// Load more images
			await projectStore.populateNextMissingImagesFromProject(
				projectStore.currentProject || "",
				loadedImages.length - endIndex
			);
			loadedImages = useProjectStore().currentImages;
		}

		const imagesToLoad = loadedImages.slice(startIndex, endIndex);
		for (let i = 0; i < this.buttonList.length; i++) {
			const imageFrame = imagesToLoad[i];
			const button = this.buttonList[i];
			if (imageFrame.image) {
				button.imageUrl = imageFrame.image;
			} else {
				button.imageUrl = "";
			}
		}
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
