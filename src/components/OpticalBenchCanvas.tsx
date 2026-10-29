import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createStudioMaterials } from '../optics/proceduralMaterials';
import {
  buildOpticalBenchScene,
  OpticalBenchSceneController,
} from '../optics/buildOpticalBenchScene';
import {
  LensAssemblyMode,
  OpticalTelemetry,
} from '../optics/opticalPhysics';

interface ProjectedCallout {
  id: string;
  label: string;
  ax: number;
  ay: number;
  lx: number;
  ly: number;
  align: 'left' | 'right';
}

interface OpticalBenchCanvasProps {
  telemetry: OpticalTelemetry;
  assemblyMode: LensAssemblyMode;
  onDistanceChange: (newDistanceCm: number) => void;
}

export const OpticalBenchCanvas: React.FC<OpticalBenchCanvasProps> = ({
  telemetry,
  assemblyMode,
  onDistanceChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<OpticalBenchSceneController | null>(null);
  const telemetryRef = useRef<OpticalTelemetry>(telemetry);
  const assemblyRef = useRef<LensAssemblyMode>(assemblyMode);
  const distanceCallbackRef = useRef(onDistanceChange);

  const [callouts, setCallouts] = useState<ProjectedCallout[]>([]);
  const [isDraggingRing, setIsDraggingRing] = useState(false);

  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    assemblyRef.current = assemblyMode;
  }, [assemblyMode]);

  useEffect(() => {
    distanceCallbackRef.current = onDistanceChange;
  }, [onDistanceChange]);

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
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const materials = createStudioMaterials(renderer);
    const benchController = buildOpticalBenchScene(renderer, materials);
    controllerRef.current = benchController;

    // Post-processing studio bloom for authentic optical glass & ray glow
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(benchController.scene, benchController.camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.34,
      0.55,
      0.74
    );
    composer.addPass(bloomPass);

    // Interactive pointer state (drag focus ring or subtle parallax)
    let pointerDown = false;
    let dragMode: 'focus' | 'parallax' = 'focus';
    let lastClientX = 0;
    let lastClientY = 0;
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      pointerDown = true;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Center & right lens region or bottom vernier knob controls focus ring directly
      if (nx > -0.38 && nx < 0.72 && ny > -0.88 && ny < 0.65) {
        dragMode = 'focus';
        setIsDraggingRing(true);
      } else {
        dragMode = 'parallax';
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Subtle studio camera parallax following cursor
      targetParallaxX = nx * 0.24;
      targetParallaxY = ny * 0.14;

      if (!pointerDown) return;

      const dx = e.clientX - lastClientX;
      const dy = e.clientY - lastClientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      if (dragMode === 'focus') {
        const deltaCm = (dx - dy * 0.6) * 0.18;
        const nextDist = Math.max(
          30,
          Math.min(110, telemetryRef.current.distanceCm + deltaCm)
        );
        distanceCallbackRef.current(nextDist);
      }
    };

    const handlePointerUp = () => {
      pointerDown = false;
      setIsDraggingRing(false);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.deltaY * 0.04;
      const nextDist = Math.max(
        30,
        Math.min(110, telemetryRef.current.distanceCm + step)
      );
      distanceCallbackRef.current(nextDist);
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    domElem.addEventListener('wheel', handleWheel, { passive: false });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      benchController.camera.aspect = w / h;
      benchController.camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let animFrameId = 0;
    let lastTime = performance.now();
    let frameCounter = 0;

    const animate = (now: number) => {
      animFrameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      currentParallaxX += (targetParallaxX - currentParallaxX) * Math.min(1, dt * 5);
      currentParallaxY += (targetParallaxY - currentParallaxY) * Math.min(1, dt * 5);

      benchController.camera.position.x = -0.12 + currentParallaxX;
      benchController.camera.position.y = 0.32 + currentParallaxY;
      benchController.camera.lookAt(0.08, -0.06, 0);

      benchController.updateFromTelemetry(
        telemetryRef.current,
        assemblyRef.current,
        dt
      );

      composer.render();

      // Update projected 2D callout coordinates every 2 frames
      frameCounter++;
      if (frameCounter % 2 === 0) {
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const anchors = benchController.getCalloutAnchors();
        const projected: ProjectedCallout[] = anchors.map((a) => {
          const v = a.anchorWorld.clone().project(benchController.camera);
          const ax = (v.x * 0.5 + 0.5) * w;
          const ay = (-v.y * 0.5 + 0.5) * h;
          return {
            id: a.id,
            label: a.label,
            ax,
            ay,
            lx: ax + a.offsetScreen.dx,
            ly: ay + a.offsetScreen.dy,
            align: a.align,
          };
        });
        setCallouts(projected);
      }
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      domElem.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      benchController.dispose();
      renderer.dispose();
      if (domElem.parentNode === container) {
        container.removeChild(domElem);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        ref={mountRef}
        className={`w-full h-full ${
          isDraggingRing ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        aria-label="Interactive 3D cutaway camera lens optical bench"
      />

      {/* Technical 3D Leader-Line Callout Overlay matching the reference screenshot */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        {callouts.map((c) => {
          const elbowX = c.align === 'left' ? c.lx - 14 : c.lx + 14;
          return (
            <g key={c.id} className="opacity-80">
              <circle
                cx={c.ax}
                cy={c.ay}
                r={2.4}
                fill="#e8ecf2"
              />
              <polyline
                points={`${c.ax},${c.ay} ${elbowX},${c.ly} ${c.lx},${c.ly}`}
                fill="none"
                stroke="rgba(232, 236, 242, 0.42)"
                strokeWidth="1"
              />
              <text
                x={c.align === 'left' ? c.lx + 5 : c.lx - 5}
                y={c.ly + 3}
                textAnchor={c.align === 'left' ? 'start' : 'end'}
                fill="rgba(220, 228, 240, 0.78)"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                letterSpacing="0.02em"
              >
                {c.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
