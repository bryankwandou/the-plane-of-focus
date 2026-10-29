import React, { useEffect, useMemo, useState } from 'react';
import {
  AperturePreset,
  computeOpticalTelemetry,
  FocusPreset,
  LensAssemblyMode,
  SUBJECT_TARGETS,
} from './optics/opticalPhysics';
import { OpticalBenchCanvas } from './components/OpticalBenchCanvas';
import { GroundGlassInspector } from './components/GroundGlassInspector';

const APERTURE_OPTIONS: AperturePreset[] = [2, 5.6, 16];

export function App() {
  // Default state matches the exact reference screenshot: Middle (54 cm), f/16, Exploded
  const [distanceCm, setDistanceCm] = useState<number>(54);
  const [aperture, setAperture] = useState<AperturePreset>(16);
  const [assemblyMode, setAssemblyMode] = useState<LensAssemblyMode>('exploded');
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);

  const telemetry = useMemo(
    () => computeOpticalTelemetry(distanceCm, aperture),
    [distanceCm, aperture]
  );

  // Keyboard shortcuts 1, 2, 3 as indicated by "drag the ring · 1 2 3" in the HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') {
        setDistanceCm(SUBJECT_TARGETS.foreground.distanceCm);
      } else if (e.key === '2') {
        setDistanceCm(SUBJECT_TARGETS.middle.distanceCm);
      } else if (e.key === '3') {
        setDistanceCm(SUBJECT_TARGETS.background.distanceCm);
      } else if (e.key === 'ArrowLeft') {
        setDistanceCm((prev) => Math.max(30, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setDistanceCm((prev) => Math.min(110, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectPreset = (preset: FocusPreset) => {
    setDistanceCm(SUBJECT_TARGETS[preset].distanceCm);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#090b0f] select-none">
      {/* Full-Viewport 3D WebGL Cutaway Optical Bench */}
      <OpticalBenchCanvas
        telemetry={telemetry}
        assemblyMode={assemblyMode}
        onDistanceChange={setDistanceCm}
      />

      {/* TOP-LEFT HUD: "THE PLANE OF FOCUS" + Telemetry Readout Table */}
      <section
        aria-label="Optical Telemetry and Explanation"
        className="pointer-events-none fixed top-5 left-6 z-20 max-w-[295px]"
      >
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#8fa3bc] leading-none">
          THE PLANE
        </div>
        <h1 className="text-[23px] font-bold tracking-[0.03em] text-[#f0f5fa] leading-tight mt-0.5">
          OF FOCUS
        </h1>

        <p className="mt-2 text-[11px] leading-[1.48] text-[#b4c0cf] font-normal">
          Everyone knows when a photo is blurry. Almost nobody has seen the exact
          plane where it turns sharp. Turn the focus ring and watch it move.
        </p>

        {/* 3-Column Live Optical Readout (FOCUS | APERTURE | SHARP ZONE) */}
        <div className="mt-3.5 grid grid-cols-3 border-y border-white/15 py-2">
          <div className="pr-2 border-r border-white/10">
            <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-[#7e8fa6]">
              FOCUS
            </div>
            <div className="mt-0.5 text-[14px] font-mono font-semibold text-[#f2f6fc]">
              {telemetry.distanceCm} cm
            </div>
          </div>

          <div className="px-2.5 border-r border-white/10">
            <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-[#7e8fa6]">
              APERTURE
            </div>
            <div className="mt-0.5 text-[14px] font-mono font-semibold text-[#f2f6fc]">
              f/{telemetry.fNumber}
            </div>
          </div>

          <div className="pl-2.5">
            <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-[#7e8fa6]">
              SHARP ZONE
            </div>
            <div className="mt-0.5 text-[14px] font-mono font-semibold text-[#f2f6fc]">
              {telemetry.sharpZoneCm.toFixed(1)} cm
            </div>
          </div>
        </div>

        {/* Dynamic Plane-of-Focus Explanation */}
        <p className="mt-2.5 text-[10.5px] leading-[1.45] text-[#c2cddb]">
          {telemetry.narrativeText.replace(
            `Sharp zone: ${telemetry.sharpZoneCm.toFixed(1)} cm.`,
            ''
          )}
          <strong className="font-semibold text-[#f2f6fc]">
            Sharp zone: {telemetry.sharpZoneCm.toFixed(1)} cm.
          </strong>
        </p>
      </section>

      {/* TOP-RIGHT HUD: Interactive Focus, Distance, Aperture & Exploded View Controls */}
      <aside
        aria-label="Lens Controls"
        className="fixed top-5 right-6 z-20 w-[360px] rounded-lg bg-[#10141d]/85 backdrop-blur-md border border-white/12 px-3.5 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.65)]"
      >
        {/* Row 1 Header: FOCUS | drag the ring · 1 2 3 | DISTANCE | 54 cm */}
        <div className="flex items-center justify-between text-[9px] font-mono tracking-wider">
          <div className="flex items-center gap-2">
            <span className="uppercase font-semibold text-[#aebdca]">FOCUS</span>
            <span className="text-[#6d7c90]">drag the ring · 1 2 3</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="uppercase text-[#7f8fa3]">DISTANCE</span>
            <span className="font-semibold text-[#eef3f9]">{telemetry.distanceCm} cm</span>
          </div>
        </div>

        {/* Row 1 Controls: Foreground / Middle / Background + Continuous Distance Slider */}
        <div className="mt-1.5 flex items-center gap-2.5">
          <div className="grid grid-cols-3 gap-1 flex-shrink-0">
            {(['foreground', 'middle', 'background'] as FocusPreset[]).map((presetKey) => {
              const target = SUBJECT_TARGETS[presetKey];
              const isActive = telemetry.activePreset === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => handleSelectPreset(presetKey)}
                  className={`px-2.5 py-1 rounded text-[10.5px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#dce6f2] text-[#0b0f17] font-semibold shadow-sm'
                      : 'bg-[#1a202c]/90 text-[#b5c2d1] hover:bg-[#232b3a] hover:text-white border border-white/5'
                  }`}
                >
                  {target.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={30}
              max={110}
              step={1}
              value={telemetry.distanceCm}
              onChange={(e) => setDistanceCm(Number(e.target.value))}
              aria-label="Focus distance in centimeters"
              className="optical-slider w-full"
            />
          </div>
        </div>

        {/* Subtle Divider */}
        <div className="my-2 h-px bg-white/10" />

        {/* Row 2 Header: APERTURE | f-number | LENS */}
        <div className="grid grid-cols-2 text-[9px] font-mono tracking-wider">
          <div className="flex items-center justify-between pr-3">
            <span className="uppercase font-semibold text-[#aebdca]">APERTURE</span>
            <span className="text-[#6d7c90]">f-number</span>
          </div>
          <div className="pl-2">
            <span className="uppercase font-semibold text-[#aebdca]">LENS</span>
          </div>
        </div>

        {/* Row 2 Controls: f/2 | f/5.6 | f/16  +  Assembled | Exploded */}
        <div className="mt-1.5 grid grid-cols-2 gap-2.5">
          <div className="grid grid-cols-3 gap-1">
            {APERTURE_OPTIONS.map((fVal) => {
              const isActive = aperture === fVal;
              return (
                <button
                  key={fVal}
                  type="button"
                  onClick={() => setAperture(fVal)}
                  className={`py-1 rounded text-[10.5px] font-mono transition-all ${
                    isActive
                      ? 'bg-[#dce6f2] text-[#0b0f17] font-semibold shadow-sm'
                      : 'bg-[#1a202c]/90 text-[#b5c2d1] hover:bg-[#232b3a] hover:text-white border border-white/5'
                  }`}
                >
                  f/{fVal}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-1">
            {(['assembled', 'exploded'] as LensAssemblyMode[]).map((mode) => {
              const isActive = assemblyMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAssemblyMode(mode)}
                  className={`py-1 rounded text-[10.5px] font-medium capitalize transition-all ${
                    isActive
                      ? 'bg-[#dce6f2] text-[#0b0f17] font-semibold shadow-sm'
                      : 'bg-[#1a202c]/90 text-[#b5c2d1] hover:bg-[#232b3a] hover:text-white border border-white/5'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Optional Ground-Glass Viewfinder Inspector (Bottom-Left) */}
      <GroundGlassInspector
        telemetry={telemetry}
        isOpen={inspectorOpen}
        onToggle={() => setInspectorOpen((prev) => !prev)}
      />

      {/* Bottom-Right Badge matching screenshot */}
      <div className="fixed bottom-3.5 right-5 z-20 flex items-center gap-2">
        <a
          href="https://x.com"
          target="_blank"
          rel="noreferrer"
          className="px-2.5 py-1 rounded bg-[#11151e]/80 hover:bg-[#1b2230] border border-white/12 text-[10px] font-mono text-[#b8c4d4] transition-colors"
        >
          Follow on X
        </a>
      </div>
    </main>
  );
}

export default App;
