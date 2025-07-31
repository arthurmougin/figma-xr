import {
	ActionManager,
	ExecuteCodeAction,
	GizmoManager,
	Mesh,
	MeshBuilder,
	MultiPointerScaleBehavior,
	Scene,
	SixDofDragBehavior,
} from "@babylonjs/core";

import { XRManager } from "./xr-manager";

export class InteractionManager {
	scene: Scene;
	xrManager: XRManager;
	gizmoManager: GizmoManager;

	constructor(scene: Scene) {
		this.scene = scene;
		this.xrManager = new XRManager(this.scene);
		this.gizmoManager = new GizmoManager(this.scene, 1);
		this.gizmoManager.positionGizmoEnabled = false;
		this.gizmoManager.rotationGizmoEnabled = false; //true;
		this.gizmoManager.scaleGizmoEnabled = false; //true;
		this.gizmoManager.boundingBoxGizmoEnabled = true; //false;
		this.gizmoManager.usePointerToAttachGizmos = false;
		this.gizmoManager.attachableMeshes = [];
		//this.gizmoManager.gizmos.rotationGizmo!.updateGizmoRotationToMatchAttachedMesh =
		//	false;
		this.gizmoManager.gizmos.boundingBoxGizmo!.scaleBoxSize = 0.01;
		this.gizmoManager.gizmos.boundingBoxGizmo!.rotationSphereSize = 0.01;
	}

	attachBehaviors(mesh: Mesh) {
		console.log("Attaching behaviors to:", mesh);
		mesh.isNearGrabbable = true;
		mesh.isNearPickable = true;
		mesh.isPickable = true;
		const scaleBehavior = new MultiPointerScaleBehavior();
		mesh.addBehavior(scaleBehavior);
		const dragBehavior = new SixDofDragBehavior();
		mesh.addBehavior(dragBehavior);

		dragBehavior.onDragStartObservable.add(() => {
			//console.log("onDragStartObservable:", mesh.name);
		});

		dragBehavior.onDragEndObservable.add(() => {
			//console.log("onDragEndObservable:", mesh.name);
			this.xrManager.anchorChild(mesh);
		});
	}

	initChildInteraction(mesh: Mesh) {
		//make movable
		mesh.isNearGrabbable = true;
		mesh.isNearPickable = true;
		mesh.isPickable = true;

		const child = MeshBuilder.CreateBox(
			"BoundingBoxFiller",
			{ size: 0.1 },
			this.scene
		);
		child.isVisible = false;
		child.parent = mesh;

		mesh.actionManager = new ActionManager(this.scene);

		mesh.actionManager.registerAction(
			new ExecuteCodeAction(ActionManager.OnDoublePickTrigger, () => {
				//console.log("Mesh OnDoublePickTrigger:", mesh.name, e);
				//maybe delete
			})
		);
		mesh.actionManager.registerAction(
			new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
				//console.log("Mesh OnPickTrigger:", mesh.name, e);
				this.handleAttachingGizmo(mesh);
			})
		);
		this.gizmoManager.attachableMeshes?.push(mesh);
		this.attachBehaviors(mesh);
	}

	handleAttachingGizmo(mesh: Mesh) {
		const oldMesh = this.gizmoManager.attachedMesh;
		//if there is a previously attached mesh, we clear it
		if (oldMesh) {
			this.gizmoManager.attachToMesh(null);
			oldMesh.getChildren().forEach((child) => {
				child.dispose();
			});
		}

		//if the new one is different from the old one, then we attach it
		if (oldMesh?.name != mesh.name) {
			this.gizmoManager.attachToMesh(mesh);
		}
	}
}
