import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface PostProcessingPipeline {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  setSize: (width: number, height: number) => void;
  render: () => void;
  dispose: () => void;
}

export function buildPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number
): PostProcessingPipeline {
  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Subtle high-threshold bloom so only the internal optical beam waist, lens rim crescents,
  // and Plane of Focus laser contour emit a crisp studio optical halo.
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.26, // strength
    0.45, // radius
    0.82  // threshold
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return {
    composer,
    bloomPass,
    setSize: (w: number, h: number) => {
      composer.setSize(w, h);
    },
    render: () => {
      composer.render();
    },
    dispose: () => {
      composer.dispose();
    },
  };
}
