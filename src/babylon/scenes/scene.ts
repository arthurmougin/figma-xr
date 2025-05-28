import { Engine, Scene, FreeCamera, Vector3, HemisphericLight } from "@babylonjs/core";
import { FrameImage } from "../../definition";
import "@babylonjs/loaders/glTF/2.0";

const createScene = async (canvas: HTMLCanvasElement) => {
  const engine = new Engine(canvas);
  const scene = new Scene(engine);

  const camera = new FreeCamera("camera1", new Vector3(0, 5, -10), scene);
  camera.setTarget(Vector3.Zero());
  camera.attachControl(canvas, true);

  new HemisphericLight("light", Vector3.Up(), scene);



  // here we add XR support
  const xr = await scene.createDefaultXRExperienceAsync({
    disableTeleportation:true,
    uiOptions: {
      sessionMode: "immersive-ar",
      requiredFeatures: ["anchors"],
    }
  });

  xr.baseExperience.featuresManager.enableFeature("xr-dom-overlay","stable",{
    element: ".html-ui"
  }, undefined, true);

  const anchorSystem = xr.baseExperience.featuresManager.getEnabledFeature("xr-anchor-system");
  console.log(xr, anchorSystem);











  window.addEventListener('resize', () => engine.resize(true))

  engine.runRenderLoop(() => {
    scene.render();
  });
  
  function sendToBabylonjs(data:FrameImage){
    console.log(data);
    // Send data to Babylon.js
  }

  return sendToBabylonjs

};

export { createScene };