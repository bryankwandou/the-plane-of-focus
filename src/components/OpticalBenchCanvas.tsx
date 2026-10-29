import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CAMERA_PRESETS,
  MIN_FOCUS_D,
  MAX_FOCUS_D,
  LENS_FRONT_X,
  OPTICAL_AXIS_Y,
  APERTURE_PRESETS,
  clamp,
  distToSlider,
  sliderToDist,
} from '../optics/opticalPhysics';
import {
  MATS,
  buildStudioEnvironment,
} from '../optics/proceduralMaterials';
import { buildCutawayLens } from '../optics/subsystems/cutawayLens';
import { buildOpticalRays } from '../optics/subsystems/opticalRays';
import { buildMiniatureValley } from '../optics/subsystems/miniatureValley';
import { buildImagePlaneScreen } from '../optics/subsystems/imagePlaneScreen';
import { buildBenchConsole } from '../optics/subsystems/benchConsole';
import { buildStudioRoom } from '../optics/subsystems/studioRoom';
import { buildPostProcessing } from '../optics/subsystems/postProcessing';

export interface CalloutScreenPos {
  id: string;
  label: string;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  visible: boolean;
  align: 'left' | 'right' | 'center';
}

interface OpticalBenchCanvasProps {
  focusD: number;
  apertureN: number;
  isExploded: boolean;
  cameraPresetIndex: number;
  resetSignal: number;
  onFocusChange: (newFocusD: number) => void;
  onApertureChange: (newApertureN: number) => void;
}

interface CalloutDef {
  id: string;
  label: string;
  getWorldAnchor: (focusGroupX: number, frontElemX: number) => THREE.Vector3;
  offsetPx: [number, number];
  align: 'left' | 'right' | 'center';
}

const LENS_CALLOUT_DEFS: CalloutDef[] = [
  {
    id: 'helicoid',
    label: 'Helicoid',
    getWorldAnchor: () => new THREE.Vector3(-0.86, OPTICAL_AXIS_Y + 1.48, 0.0),
    offsetPx: [0, -22],
    align: 'center',
  },
  {
    id: 'focus-group',
    label: 'Focus group',
    getWorldAnchor: (focusGroupX) =>
      new THREE.Vector3(focusGroupX - 0.05, OPTICAL_AXIS_Y + 0.84, 0.15),
    offsetPx: [-44, -26],
    align: 'right',
  },
  {
    id: 'focusing-ring',
    label: 'Focusing ring',
    getWorldAnchor: () => new THREE.Vector3(-0.28, OPTICAL_AXIS_Y + 0.96, 0.35),
    offsetPx: [42, -38],
    align: 'left',
  },
  {
    id: 'front-element',
    label: 'Front element',
    getWorldAnchor: (_fgX, frontElemX) =>
      new THREE.Vector3(frontElemX - 0.02, OPTICAL_AXIS_Y + 0.78, 0.22),
    offsetPx: [34, -26],
    align: 'left',
  },
  {
    id: 'rear-group',
    label: 'Rear group',
    getWorldAnchor: () => new THREE.Vector3(-2.28, OPTICAL_AXIS_Y - 0.82, 0.25),
    offsetPx: [-38, 18],
    align: 'right',
  },
];

export const OpticalBenchCanvas: React.FC<OpticalBenchCanvasProps> = ({
  focusD,
  apertureN,
  isExploded,
  cameraPresetIndex,
  resetSignal,
  onFocusChange,
  onApertureChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [callouts, setCallouts] = useState<CalloutScreenPos[]>([]);
  const [isDraggingControl, setIsDraggingControl] = useState<string | null>(null);

  const stateRef = useRef({
    focusD,
    apertureN,
    isExploded,
    onFocusChange,
    onApertureChange,
  });

  useEffect(() => {
    stateRef.current = {
      focusD,
      apertureN,
      isExploded,
      onFocusChange,
      onApertureChange,
    };
  }, [focusD, apertureN, isExploded, onFocusChange, onApertureChange]);

  const camTargetRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
  }>({
    active: false,
    pos: CAMERA_PRESETS[0].pos.clone(),
    target: CAMERA_PRESETS[0].target.clone(),
    fov: CAMERA_PRESETS[0].fov,
  });

  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraPresetIndex] || CAMERA_PRESETS[0];
    camTargetRef.current = {
      active: true,
      pos: preset.pos.clone(),
      target: preset.target.clone(),
      fov: preset.fov,
    };
  }, [cameraPresetIndex, resetSignal]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0c0f14');
    scene.fog = new THREE.FogExp2('#0c0f14', 0.018);

    buildStudioEnvironment(renderer, scene);

    const preset0 = CAMERA_PRESETS[0];
    const camera = new THREE.PerspectiveCamera(preset0.fov, width / height, 0.1, 120);
    camera.position.copy(preset0.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(preset0.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxDistance = 28;
    controls.minDistance = 1.4;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.update();

    const stopAutoCamera = () => {
      camTargetRef.current.active = false;
    };
    controls.addEventListener('start', stopAutoCamera);

    // Studio Lighting Rig calibrated to match the warm brass + ice-cyan optical glass look
    const keyLight = new THREE.DirectionalLight('#fff5e4', 2.4);
    keyLight.position.set(3.5, 9.5, 6.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    const d = 6.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const coolRimLight = new THREE.DirectionalLight('#8be4ff', 1.55);
    coolRimLight.position.set(-5.5, 6.4, -4.2);
    scene.add(coolRimLight);

    const warmBrassFill = new THREE.PointLight('#ffad42', 1.85, 8.5, 1.4);
    warmBrassFill.position.set(-1.35, 3.85, 2.35);
    scene.add(warmBrassFill);

    const valleySunLight = new THREE.SpotLight('#fff0d6', 2.6, 14, Math.PI * 0.28, 0.45, 1.2);
    valleySunLight.position.set(3.4, 7.6, 2.4);
    valleySunLight.target.position.set(3.2, 3.2, 0);
    scene.add(valleySunLight);
    scene.add(valleySunLight.target);

    // Build all 3D Subsystems
    const studioRoom = buildStudioRoom();
    scene.add(studioRoom);

    const benchConsole = buildBenchConsole({
      darkAnodized: MATS.anodizedBlack,
      gunmetal: MATS.consoleDark,
      brushedBrass: MATS.brushedBrass,
      brightBrass: MATS.brushedBrass,
      chrome: MATS.brushedSteel,
    });
    scene.add(benchConsole.group);

    const cutawayLens = buildCutawayLens(scene);
    const opticalRays = buildOpticalRays(scene);

    const miniatureValley = buildMiniatureValley({
      darkAnodized: MATS.anodizedBlack,
      brushedBrass: MATS.brushedBrass,
    });
    scene.add(miniatureValley.group);

    const imagePlaneScreen = buildImagePlaneScreen({
      darkAnodized: MATS.anodizedBlack,
      brushedBrass: MATS.brushedBrass,
    });
    scene.add(imagePlaneScreen.group);

    const postPipeline = buildPostProcessing(renderer, scene, camera, width, height);

    // Raycasting & Direct 3D Manipulation (Focus Ring, Brass Thumbwheel, Plane of Focus, Console Slider, Subjects)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersectPt = new THREE.Vector3();

    let activeDragMode: 'focus-ring' | 'focus-plane' | 'console-slider' | null = null;
    let dragStartClientX = 0;
    let dragStartSliderT = 0;

    const getInteractiveTargets = (): THREE.Object3D[] => [
      ...cutawayLens.interactiveMeshes,
      benchConsole.railThumbGear,
      benchConsole.sliderKnob,
      benchConsole.sliderTrackCollider,
      benchConsole.irisClickTarget,
      ...benchConsole.filmstripThumbs,
      ...benchConsole.apertureDials,
      miniatureValley.planeCollider,
      ...miniatureValley.subjectTargets,
    ];

    const updatePointerNdc = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      updatePointerNdc(ev);
      raycaster.setFromCamera(pointerNdc, camera);

      const hits = raycaster.intersectObjects(getInteractiveTargets(), true);
      if (hits.length === 0) return;

      const hitObj = hits[0].object;
      const uData = hitObj.userData || hitObj.parent?.userData || {};
      const iType = uData.interactiveType || uData.type;

      if (iType === 'focus-ring' || iType === 'focusRing') {
        activeDragMode = 'focus-ring';
        setIsDraggingControl('focus-ring');
        controls.enabled = false;
        dragStartClientX = ev.clientX;
        dragStartSliderT = distToSlider(stateRef.current.focusD);
        renderer.domElement.style.cursor = 'ew-resize';
      } else if (iType === 'focusPlane') {
        activeDragMode = 'focus-plane';
        setIsDraggingControl('focus-plane');
        controls.enabled = false;
        dragPlane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 0, 1),
          hits[0].point
        );
        renderer.domElement.style.cursor = 'ew-resize';
      } else if (iType === 'consoleSlider') {
        activeDragMode = 'console-slider';
        setIsDraggingControl('console-slider');
        controls.enabled = false;
        dragStartClientX = ev.clientX;
        dragStartSliderT = distToSlider(stateRef.current.focusD);
        renderer.domElement.style.cursor = 'ew-resize';
      } else if (iType === 'lens-iris' || iType === 'irisToggle') {
        const curAp = stateRef.current.apertureN;
        const idx = APERTURE_PRESETS.findIndex((a) => Math.abs(a - curAp) < 0.5);
        const nextAp = APERTURE_PRESETS[(idx + 1) % APERTURE_PRESETS.length];
        stateRef.current.onApertureChange(nextAp);
      } else if (iType === 'apertureDial' && typeof uData.apertureN === 'number') {
        stateRef.current.onApertureChange(uData.apertureN);
      } else if (iType === 'filmstrip' && typeof uData.focusD === 'number') {
        stateRef.current.onFocusChange(uData.focusD);
      } else if (iType === 'subject' && typeof uData.d === 'number') {
        stateRef.current.onFocusChange(uData.d);
      } else if (iType === 'x-profile') {
        window.open('https://x.com/nayrbryanGaming', '_blank', 'noopener,noreferrer');
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      updatePointerNdc(ev);

      if (activeDragMode === 'focus-ring' || activeDragMode === 'console-slider') {
        const dx = ev.clientX - dragStartClientX;
        const sensitivity = activeDragMode === 'focus-ring' ? 260 : 220;
        const newT = clamp(dragStartSliderT + dx / sensitivity, 0, 1);
        stateRef.current.onFocusChange(sliderToDist(newT));
        return;
      }

      if (activeDragMode === 'focus-plane') {
        raycaster.setFromCamera(pointerNdc, camera);
        if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
          const newD = clamp(intersectPt.x - LENS_FRONT_X, MIN_FOCUS_D, MAX_FOCUS_D);
          stateRef.current.onFocusChange(newD);
        }
        return;
      }

      // Hover cursor feedback
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(getInteractiveTargets(), true);
      if (hits.length > 0) {
        const uData = hits[0].object.userData || hits[0].object.parent?.userData || {};
        const iType = uData.interactiveType || uData.type;
        if (iType === 'focus-ring' || iType === 'focusRing' || iType === 'focusPlane' || iType === 'consoleSlider') {
          renderer.domElement.style.cursor = 'ew-resize';
        } else {
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onPointerUp = () => {
      if (activeDragMode) {
        activeDragMode = null;
        setIsDraggingControl(null);
        controls.enabled = true;
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // WASD / Arrow Key Free Camera Navigation
    const keysPressed = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      keysPressed.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      postPipeline.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let rafId = 0;
    let lastTime = performance.now();
    let frameCount = 0;
    const projVec = new THREE.Vector3();
    const forwardVec = new THREE.Vector3();
    const rightVec = new THREE.Vector3();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) * 0.001);
      lastTime = now;
      const timeSec = now * 0.001;

      // Smooth camera transition when switching presets
      if (camTargetRef.current.active) {
        const lerpRate = Math.min(1, dt * 6.5);
        camera.position.lerp(camTargetRef.current.pos, lerpRate);
        controls.target.lerp(camTargetRef.current.target, lerpRate);
        camera.fov += (camTargetRef.current.fov - camera.fov) * lerpRate;
        camera.updateProjectionMatrix();

        if (
          camera.position.distanceTo(camTargetRef.current.pos) < 0.015 &&
          controls.target.distanceTo(camTargetRef.current.target) < 0.015
        ) {
          camTargetRef.current.active = false;
        }
      }

      // WASD movement
      if (keysPressed.size > 0) {
        const moveSpeed = 3.6 * dt;
        camera.getWorldDirection(forwardVec);
        forwardVec.y = 0;
        forwardVec.normalize();
        rightVec.crossVectors(forwardVec, camera.up).normalize();

        if (keysPressed.has('w')) {
          camera.position.addScaledVector(forwardVec, moveSpeed);
          controls.target.addScaledVector(forwardVec, moveSpeed);
          camTargetRef.current.active = false;
        }
        if (keysPressed.has('s')) {
          camera.position.addScaledVector(forwardVec, -moveSpeed);
          controls.target.addScaledVector(forwardVec, -moveSpeed);
          camTargetRef.current.active = false;
        }
        if (keysPressed.has('a')) {
          camera.position.addScaledVector(rightVec, -moveSpeed);
          controls.target.addScaledVector(rightVec, -moveSpeed);
          camTargetRef.current.active = false;
        }
        if (keysPressed.has('d')) {
          camera.position.addScaledVector(rightVec, moveSpeed);
          controls.target.addScaledVector(rightVec, moveSpeed);
          camTargetRef.current.active = false;
        }
      }

      controls.update();

      const { focusD: curFocusD, apertureN: curAp, isExploded: curExploded } = stateRef.current;

      // Update all 3D optical subsystems
      cutawayLens.update(curFocusD, curAp, curExploded, dt);
      const fgX = cutawayLens.getFocusGroupX();
      const frontElemX = cutawayLens.getFrontElementX();

      opticalRays.update(curFocusD, curAp, fgX, frontElemX);
      miniatureValley.updateFocusPlane(curFocusD, curAp, timeSec);
      imagePlaneScreen.updateProjection(curFocusD, curAp);
      benchConsole.updateConsole(curFocusD, curAp);

      postPipeline.render();

      // Update 2D screen-space leader-line callouts every 2 frames
      frameCount++;
      if (frameCount % 2 === 0) {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        const uiScale = clamp(w / 1600, 0.55, 1.15);
        const nextCallouts: CalloutScreenPos[] = LENS_CALLOUT_DEFS.map((def) => {
          const worldPt = def.getWorldAnchor(fgX, frontElemX);
          projVec.copy(worldPt).project(camera);
          const visible = projVec.z > -1 && projVec.z < 1 && Math.abs(projVec.x) < 1.05;
          const anchorX = (projVec.x * 0.5 + 0.5) * w;
          const anchorY = (-projVec.y * 0.5 + 0.5) * h;
          return {
            id: def.id,
            label: def.label,
            anchorX,
            anchorY,
            labelX: anchorX + def.offsetPx[0] * uiScale,
            labelY: anchorY + def.offsetPx[1] * uiScale,
            visible,
            align: def.align,
          };
        });
        setCallouts(nextCallouts);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      postPipeline.dispose();
      renderer.dispose();
      if (domElem.parentNode === container) {
        container.removeChild(domElem);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      <div ref={mountRef} className="w-full h-full" />

      {/* Technical Leader-Line Callouts Overlay matching the reference post */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full z-10"
        style={{ overflow: 'visible' }}
      >
        {callouts.map((c) =>
          c.visible ? (
            <g key={c.id}>
              <line
                x1={c.anchorX}
                y1={c.anchorY}
                x2={c.labelX}
                y2={c.labelY}
                stroke="rgba(226, 238, 255, 0.36)"
                strokeWidth="1"
              />
              <circle
                cx={c.anchorX}
                cy={c.anchorY}
                r="2.2"
                fill="rgba(235, 245, 255, 0.85)"
              />
            </g>
          ) : null
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 z-10">
        {callouts.map((c) =>
          c.visible ? (
            <div
              key={c.id}
              style={{
                left: `${c.labelX}px`,
                top: `${c.labelY}px`,
                transform:
                  c.align === 'right'
                    ? 'translate(-100%, -50%)'
                    : c.align === 'center'
                    ? 'translate(-50%, -100%)'
                    : 'translate(0%, -50%)',
              }}
              className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0c1017]/75 border border-white/15 backdrop-blur-sm text-[10px] font-mono tracking-wide text-slate-200/95 whitespace-nowrap shadow-sm"
            >
              <span className="w-1 h-1 rounded-full bg-sky-300/90 inline-block" />
              <span>{c.label}</span>
            </div>
          ) : null
        )}
      </div>

      {/* Subtle status badge when actively dragging a 3D mechanical control */}
      {isDraggingControl && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-sky-950/85 border border-sky-400/40 text-sky-100 text-xs font-mono tracking-wider uppercase shadow-lg">
          {isDraggingControl === 'focus-ring'
            ? 'Turning Focus Ring Helical Drive'
            : isDraggingControl === 'focus-plane'
            ? 'Sliding Plane of Focus in Valley'
            : 'Adjusting Optical Bench Console'}
        </div>
      )}
    </div>
  );
};
