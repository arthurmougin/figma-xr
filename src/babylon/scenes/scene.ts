import * as BABYLON from "@babylonjs/core";
import {AdvancedDynamicTexture, Container, Control, Image} from "@babylonjs/gui/2D";
import {root} from "../gui/gui-main.json";

// create button type that extends Control and add frame as property
class ButtonFrame extends Control {
    frame?: any;
}
class MeshFrame extends BABYLON.Mesh {
    frame?: any;
}

const xrPolyfillPromise = new Promise((resolve) => {
    if (navigator.xr) {
        return resolve(true);
    }
    if ((<any>window).WebXRPolyfill) {
        //@ts-ignore
        new WebXRPolyfill();
        return resolve(true);
    } else {
        const url = "https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js";
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

const myScene = {
    UI:null as AdvancedDynamicTexture|null,
    Engine:null as BABYLON.Engine|null,
    Scene:null as BABYLON.Scene|null,
    webXRDefaultExperience:null as BABYLON.WebXRDefaultExperience|null,
    webXRAnchorSystem:null as BABYLON.WebXRAnchorSystem|null,
    async Spawn (frame: any) {
        const scene = this.Scene;
        const UI = this.UI;
        const canvas = scene?.getEngine().getRenderingCanvas();
        console.log(scene,UI,canvas)
        if (!scene || !UI || !canvas) return;

        //edit UI
        const Root = UI.getChildren()[0];
        const rect = Root.getChildByName("Rectangle") as Container;
        if (!rect) return;
        const Drop = rect.getChildByName("Drop");
        const Spawn = rect.getChildByName("Spawn");
        if (!Drop || !Spawn) return;
        Drop.isVisible = true;
        Spawn.isVisible = false;

        //create a plane
        const plane = BABYLON.MeshBuilder.CreatePlane("plane", { size: 0.5 }, scene) as MeshFrame;
        plane.frame = frame;

        //set plane in front of camera
        plane.position = new BABYLON.Vector3(0, 0, 2);
        const camera = scene.activeCamera as BABYLON.Camera;
        plane.parent = camera;

        //set plane material to frame image as png with variable opacity
        const material = new BABYLON.StandardMaterial("material", scene);
        material.diffuseTexture = new BABYLON.Texture(plane.frame.image, scene);
        material.diffuseTexture.hasAlpha = true;
        material.alpha = 1;
        plane.material = material;
        //resize plane to match image aspect ratio
        const aspectRatio = plane.frame.absoluteRenderBounds.width / plane.frame.absoluteRenderBounds.height;
        plane.scaling.x = aspectRatio;
    },
    async Drop (){
        const scene = this.Scene;
        const webXRDefaultExperience = this.webXRDefaultExperience;
        const webXRAnchorSystem = this.webXRAnchorSystem;
        const UI = this.UI;
        const canvas = scene?.getEngine().getRenderingCanvas();
        if (!scene || !webXRDefaultExperience || !webXRAnchorSystem || !UI || !canvas) return;

        //edit UI
        const Root = UI.getChildren()[0];
        const rect = Root.getChildByName("Rectangle") as Container;
        if (!rect) return;
        const Drop = rect.getChildByName("Drop");
        const Spawn = rect.getChildByName("Spawn");
        if (!Drop || !Spawn) return;
        Drop.isVisible = false;
        Spawn.isVisible = true;

        //get active camera
        const camera = scene.activeCamera as BABYLON.Camera;
        const camChild = camera.getChildren()[0] as MeshFrame;
        camChild.setParent(null);
        //not in xr
        if (webXRDefaultExperience.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            try {
                console.log("adding anchor")
                console.log(camChild.position,camChild.rotationQuaternion)
                const anchor = await webXRAnchorSystem.addAnchorAtPositionAndRotationAsync(
                    camChild.position,
                    camChild.rotationQuaternion ?
                        camChild.rotationQuaternion :
                        camChild.rotation.toQuaternion()
                );
                anchor.attachedNode = camChild;
            }
            catch (e) {
                console.log(e);
            }
        }
    },
    async createScene (canvas:HTMLCanvasElement) {
        await xrPolyfillPromise
        var engine = new BABYLON.Engine(canvas);
        var scene = new BABYLON.Scene(engine);
        this.Engine = engine;
        this.Scene = scene;

        this.Drop = this.Drop.bind(this);
        this.Spawn = this.Spawn.bind(this);

        // This creates and positions a free camera (non-mesh)
        var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);

        // This targets the camera to scene origin
        camera.setTarget(BABYLON.Vector3.Zero());

        // This attaches the camera to the canvas
        camera.attachControl(canvas, true);

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);

        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 0.7;

        engine.runRenderLoop(() => {
            scene.render();
        });

        window.addEventListener("resize", function () {
            engine.resize();
        });

        let advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("MainGUI", true, scene);
        this.UI = advancedTexture;
        advancedTexture.parseSerializedObject({root});
        advancedTexture.renderScale = 2;

        const webXRDefaultExperience = await scene.createDefaultXRExperienceAsync({
            uiOptions: {
                sessionMode: 'immersive-ar',
                referenceSpaceType: 'unbounded'
            },
            disableTeleportation: true,
            optionalFeatures: [
                "hit-test",
                "dom-overlay",
                "anchors",
                "light-estimation"
            ]
        });
        this.webXRDefaultExperience = webXRDefaultExperience;
        const featuresManager = webXRDefaultExperience.baseExperience.featuresManager;
        const webXRAnchorSystem : BABYLON.WebXRAnchorSystem = featuresManager.enableFeature( BABYLON.WebXRAnchorSystem, 'latest') as BABYLON.WebXRAnchorSystem;
        this.webXRAnchorSystem = webXRAnchorSystem;
        return scene;
    },
    async setFrames (frames:any[]) {
        if (!this.UI) return;
        console.log(this.UI)
        console.log(frames);//DropButton
        const DropButton = this.UI.getControlByName("DropButton") as BABYLON.Nullable<Control>;
        if(!DropButton) return;
        DropButton.onPointerClickObservable.add(()=>{
            this.Drop()
        });

        const buttonTemplate = this.UI.getControlByName("Button") as BABYLON.Nullable<Control>;
        if(!buttonTemplate) return;
        const buttonParent = buttonTemplate.parent;

        if(buttonTemplate.isVisible) {
            //first time loading
            buttonTemplate.isVisible = false;
            frames.forEach((frame: any) => {
                const button = buttonTemplate.clone() as ButtonFrame;
                button.isVisible = true;
                const image = button.getDescendants()[0] as Image;
                image.source = frame.image;
                button.frame = frame;
                button.onPointerClickObservable.add(()=>{
                    this.Spawn(button.frame)
                });
                buttonParent?.addControl(button);
            });
        }
    }
}

export default myScene;