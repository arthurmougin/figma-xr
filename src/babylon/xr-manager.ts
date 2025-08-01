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
	WebXRExperienceHelper,
} from "@babylonjs/core";
import { GUI3DManager, HandMenu, TouchHolographicButton } from "@babylonjs/gui";
import SceneManager from "./scene";
import { TwickedFrameNode } from "@/definition";
import { useProjectStore } from "@/store/project.store";

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
	ui:
		| {
				menu: HandMenu;
				buttonList: TouchHolographicButton[];
				currentTab: number;
				backButton: TouchHolographicButton;
				frontButton: TouchHolographicButton;
		  }
		| undefined;

	anchorMap: Map<string, IWebXRAnchor> = new Map();
	constructor(scene: Scene) {
		this.scene = scene;
		this.xrFeatures = {};
		this.initXR(scene);
		this.guiManager = new GUI3DManager(scene);
	}

	async initXR(scene: Scene) {
		await xrPolyfillPromise;

		// WebXR Features
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

		// WebXRAnchorSystem
		const webXRAnchorSystem: WebXRAnchorSystem =
			featuresManager.enableFeature(
				WebXRAnchorSystem,
				"latest",
				{},
				true,
				false
			) as WebXRAnchorSystem;
		this.xrFeatures.webXRAnchorSystem = webXRAnchorSystem;

		// WebXRBackgroundRemover
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

		// WebXRDomOverlay
		const domOverlay = featuresManager.enableFeature(
			WebXRDomOverlay,
			"latest",
			{
				element: "#ui-container",
			}
		);
		this.xrFeatures.webXRDOMOverlay = domOverlay as WebXRDomOverlay;

		// WebXRLightEstimation
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

		// WebXRDepthSensing
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

		this.initUI(webXRDefaultExperience.baseExperience);
	}

	initUI(helper: WebXRExperienceHelper) {
		this.ui = {
			menu: new HandMenu(helper, "menu"),
			buttonList: [],
			currentTab: 1,
			backButton: new TouchHolographicButton("back"),
			frontButton: new TouchHolographicButton("next"),
		};

		this.ui.menu.backPlateMargin = 0.5;
		this.ui.menu.columns = 3;

		this.ui.backButton.imageUrl = "../assets/icons/Back.png";
		this.ui.menu.addButton(this.ui.backButton);
		this.ui.backButton.onPointerClickObservable.add(() => {
			this.turnPage("prev");
		});

		const homeButton = new TouchHolographicButton("Home");
		this.ui.menu.addButton(homeButton);
		homeButton.isVisible = false;

		this.ui.frontButton.imageUrl = "../assets/icons/Front.png";
		this.ui.menu.addButton(this.ui.frontButton);
		this.ui.frontButton.onPointerClickObservable.add(() => {
			this.turnPage("next");
		});

		for (let i = 1; i <= 6; i++) {
			const button = new TouchHolographicButton(`Button ${i}`);
			button.onPointerClickObservable.add(() =>
				this.onButtonClick(button)
			);
			this.ui.menu.addButton(button);
			this.ui.buttonList.push(button);
		}

		this.loadPagination();

		this.guiManager.addControl(this.ui.menu);
	}

	async turnPage(direction: "next" | "prev"): Promise<void> {
		if (!this.ui) throw new Error("UI not initialized");
		if (direction === "next") {
			this.ui.currentTab = this.ui.currentTab + 1;
		} else if (direction === "prev" && this.ui.currentTab > 1) {
			this.ui.currentTab = this.ui.currentTab - 1;
		}

		this.ui.backButton.isVisible = false;
		this.ui.frontButton.isVisible = false;

		await this.loadPagination();

		this.ui.backButton.isVisible = true;
		this.ui.frontButton.isVisible = true;
	}

	async loadPagination(): Promise<void> {
		// INPUT CONTROL
		if (!this.ui) throw new Error("UI not initialized");
		const QTE_PER_PAGE = this.ui.buttonList.length;

		const projectStore = useProjectStore();
		const project = projectStore.projects.get(
			projectStore.currentProject || ""
		);

		//We cant "watch" the project as a vue component
		if (!project) {
			setTimeout(() => {
				this.loadPagination();
			}, 1000);
			return;
		}

		// PAGINATION AND MEDIA LOADING
		const images = projectStore.currentImages;
		let loadedImages = images.filter((image) => image.image);

		//if we go back more, then we get back to top
		if (this.ui.currentTab < 1)
			this.ui.currentTab = Math.ceil(loadedImages.length / QTE_PER_PAGE);

		// Load the specified page of buttons
		const startIndex = (this.ui.currentTab - 1) * QTE_PER_PAGE;
		const endIndex = startIndex + QTE_PER_PAGE;

		//If we lack images to draw
		if (endIndex > loadedImages.length) {
			//but we can't load more images
			if (loadedImages.length == images.length) {
				this.ui.currentTab = 1;
				return this.loadPagination();
			}

			// Load more images
			await projectStore.populateNextMissingImagesFromProject(
				projectStore.currentProject || "",
				QTE_PER_PAGE
			);
			loadedImages = useProjectStore().currentImages;
		}

		// RENDERING
		const imagesToLoad = loadedImages.slice(startIndex, endIndex);
		// for each button
		for (let i = 0; i < this.ui.buttonList.length; i++) {
			const imageFrame = imagesToLoad[i];
			const button = this.ui.buttonList[i];

			if (imageFrame.image) {
				button.imageUrl = imageFrame.image;
				if (!button.node) throw new Error("Missing node on button");
				if (!button.node.metadata) button.node.metadata = {};
				button.node.metadata.frame = imageFrame;
				button.isVisible = true;
			} else {
				// If we are at the last page and it's not full, we hide the empty buttons
				button.imageUrl = "";
				button.isVisible = false;
			}
		}
	}

	async onButtonClick(button: TouchHolographicButton) {
		if (!button.isVisible || !button.node) return;

		const frame: TwickedFrameNode | undefined = button.node.metadata?.frame;
		if (!frame)
			throw new Error("something went wrong when adding the button");

		SceneManager.getInstance().Spawn(frame);
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
