import React, { useState, useEffect, useCallback } from 'react';
import { Camera, ExternalLink, HelpCircle, RotateCcw, X } from 'lucide-react';
import { OpticalBenchCanvas } from './components/OpticalBenchCanvas';
import {
  SUBJECTS,
  APERTURE_PRESETS,
  CAMERA_PRESETS,
  computeDofBounds,
  distToSlider,
  sliderToDist,
  formatDistCm,
  formatAperture,
  buildExplanationParts,
  clamp,
} from './optics/opticalPhysics';

export function App() {
  // Default state matches the exact reference screenshot: Middle (54 cm), f/16, Exploded, Hero Cutaway Lens View
  const [focusD, setFocusD] = useState<number>(SUBJECTS[1].d); // 2.35 -> 54 cm
  const [apertureN, setApertureN] = useState<number>(16);      // f/16 -> 12.2 cm sharp zone
  const [isExploded, setIsExploded] = useState<boolean>(true);
  const [cameraPresetIndex, setCameraPresetIndex] = useState<number>(0);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [hudScale, setHudScale] = useState<number>(() =>
    typeof window !== 'undefined' ? clamp(window.innerWidth / 1520, 0.52, 1.0) : 1.0
  );

  useEffect(() => {
    const onResize = () => {
      setHudScale(clamp(window.innerWidth / 1520, 0.52, 1.0));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const cycleCameraPreset = useCallback(() => {
    setCameraPresetIndex((prev) => (prev + 1) % CAMERA_PRESETS.length);
  }, []);

  const resetCameraView = useCallback(() => {
    setResetSignal((s) => s + 1);
  }, []);

  // Keyboard shortcuts matching the HUD hints (1 / 2 / 3, Q / E, X, C, R, ?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === '1') {
        setFocusD(SUBJECTS[0].d);
      } else if (key === '2') {
        setFocusD(SUBJECTS[1].d);
      } else if (key === '3') {
        setFocusD(SUBJECTS[2].d);
      } else if (key === 'q') {
        setApertureN(APERTURE_PRESETS[0]);
      } else if (key === 'e') {
        setApertureN(APERTURE_PRESETS[2]);
      } else if (key === 'x') {
        setIsExploded((prev) => !prev);
      } else if (key === 'c') {
        cycleCameraPreset();
      } else if (key === 'r') {
        resetCameraView();
      } else if (key === '?' || key === '/') {
        setShowHelpModal((prev) => !prev);
      } else if (key === 'escape') {
        setShowHelpModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycleCameraPreset, resetCameraView]);

  const [nearD, farD] = computeDofBounds(focusD, apertureN);
  const sharpZoneText = formatDistCm(farD - nearD, true);
  const focusDistText = formatDistCm(focusD, false);
  const apertureText = formatAperture(apertureN);
  const explanation = buildExplanationParts(focusD, apertureN);

  const sliderVal = distToSlider(focusD);
  const nearSliderT = distToSlider(nearD);
  const farSliderT = distToSlider(isFinite(farD) ? farD : 20);

  const activeSubjectIndex = SUBJECTS.findIndex((s) => Math.abs(s.d - focusD) < 0.14);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0c0f14] text-slate-100 select-none font-sans">
      {/* Full-Viewport 3D Optical Bench Laboratory */}
      <OpticalBenchCanvas
        focusD={focusD}
        apertureN={apertureN}
        isExploded={isExploded}
        cameraPresetIndex={cameraPresetIndex}
        resetSignal={resetSignal}
        onFocusChange={setFocusD}
        onApertureChange={setApertureN}
      />

      {/* TOP-LEFT HUD: Title, Subtitle, Live Telemetry Readouts & Dynamic Optical Explanation */}
      <div
        style={{
          transform: `scale(${hudScale})`,
          transformOrigin: 'top left',
        }}
        className="pointer-events-none absolute top-4 left-5 z-20 w-[265px]"
      >
        <div className="leading-none">
          <div className="text-[11px] font-bold tracking-[0.22em] text-slate-200 uppercase">
            THE PLANE
          </div>
          <h1 className="text-[24px] font-extrabold tracking-[0.04em] text-white uppercase mt-0.5">
            OF FOCUS
          </h1>
        </div>

        <p className="mt-2 text-[10.5px] leading-[1.45] text-slate-300/90 font-normal">
          Everyone knows when a photo is blurry. Almost nobody has seen the exact plane where it
          turns sharp. Turn the focus ring and watch it move.
        </p>

        {/* 3-Column Live Telemetry Bar: FOCUS | APERTURE | SHARP ZONE */}
        <div className="mt-2.5 pt-2 pb-2 border-y border-white/15 grid grid-cols-3 gap-1.5">
          <div>
            <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-slate-400">
              FOCUS
            </div>
            <div className="mt-0.5 text-[14px] font-mono font-semibold text-white">
              {focusDistText}
            </div>
          </div>

          <div className="border-l border-white/15 pl-2.5">
            <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-slate-400">
              APERTURE
            </div>
            <div className="mt-0.5 text-[14px] font-mono font-semibold text-white">
              {apertureText}
            </div>
          </div>

          <div className="border-l border-white/15 pl-2.5">
            <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-slate-400">
              SHARP ZONE
            </div>
            <div className="mt-0.5 text-[14px] font-mono font-semibold text-white">
              {sharpZoneText}
            </div>
          </div>
        </div>

        {/* Dynamic Optical Ray Explanation */}
        <p className="mt-2 text-[10px] leading-[1.48] text-slate-300/90">
          Only{' '}
          <span className="text-white font-semibold">
            {SUBJECTS[activeSubjectIndex >= 0 ? activeSubjectIndex : 1].name}
          </span>{' '}
          sits on the plane: its rays meet in{' '}
          <span className="text-white font-semibold">one point on the glass</span>.{' '}
          {explanation.body.replace(
            /^Only the [^:]+: its rays meet in one point on the glass\.\s*/,
            ''
          )}{' '}
          <span className="text-sky-200 font-semibold">{explanation.sharpZoneLabel}</span>
        </p>
      </div>

      {/* TOP-RIGHT HUD: Interactive Optical Control Card matching the reference screenshot */}
      <div
        style={{
          transform: `scale(${hudScale})`,
          transformOrigin: 'top right',
        }}
        className="pointer-events-auto absolute top-4 right-5 z-20 w-[332px] rounded-xl bg-[#11161f]/85 border border-white/15 backdrop-blur-md p-3 shadow-2xl"
      >
        {/* Header Row: FOCUS | drag the ring · 1 2 3 | DISTANCE 54 cm */}
        <div className="flex items-center justify-between text-[9px] font-mono tracking-[0.12em] text-slate-400 uppercase">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 font-semibold">FOCUS</span>
            <span className="text-slate-400/80 lowercase tracking-normal">
              drag the ring · 1 2 3
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">DISTANCE</span>
            <span className="text-white font-semibold tracking-normal">{focusDistText}</span>
          </div>
        </div>

        {/* Row 2: [Foreground] [Middle] [Background] + Continuous Distance Slider with DoF Band */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="grid grid-cols-3 bg-[#0a0d13]/90 p-0.5 rounded-lg border border-white/10 shrink-0">
            {SUBJECTS.map((subj, idx) => {
              const isSelected = activeSubjectIndex === idx;
              return (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => setFocusD(subj.d)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#bce3ff] text-[#09131c] font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {subj.shortName}
                </button>
              );
            })}
          </div>

          {/* Continuous Focus Distance Slider with Live Depth-of-Field Zone Band */}
          <div className="relative flex-1 h-6 flex items-center">
            <div className="w-full h-1.5 rounded-full bg-slate-800/90 border border-white/10 overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 bg-sky-300/35"
                style={{
                  left: `${nearSliderT * 100}%`,
                  width: `${Math.max(2, (farSliderT - nearSliderT) * 100)}%`,
                }}
              />
            </div>

            <input
              type="range"
              min={0}
              max={1}
              step={0.002}
              value={sliderVal}
              onChange={(e) => setFocusD(sliderToDist(parseFloat(e.target.value)))}
              aria-label="Focus distance"
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
            />

            <div
              className="pointer-events-none absolute w-3 h-3 rounded-full bg-[#cbe8ff] border-2 border-[#0b121a] shadow-md -translate-x-1/2"
              style={{ left: `${sliderVal * 100}%` }}
            />
          </div>
        </div>

        {/* Row 3 Headers: APERTURE | LENS */}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 text-[9px] font-mono tracking-[0.12em] text-slate-400 uppercase">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-semibold">APERTURE</span>
            <span className="w-2 h-2 rounded-full border border-slate-400/60 inline-block" />
          </div>
          <div>
            <span className="text-slate-300 font-semibold">LENS</span>
          </div>
        </div>

        {/* Row 4 Segmented Controls: [f/2] [f/5.6] [f/16]  |  [Assembled] [Exploded] */}
        <div className="mt-1 grid grid-cols-2 gap-2.5">
          <div className="grid grid-cols-3 bg-[#0a0d13]/90 p-0.5 rounded-lg border border-white/10">
            {APERTURE_PRESETS.map((ap) => {
              const isSelected = Math.abs(apertureN - ap) < 0.2;
              return (
                <button
                  key={ap}
                  type="button"
                  onClick={() => setApertureN(ap)}
                  className={`py-0.5 rounded-md text-[10px] font-mono transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#bce3ff] text-[#09131c] font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  f/{ap}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 bg-[#0a0d13]/90 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setIsExploded(false)}
              className={`py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                !isExploded
                  ? 'bg-[#bce3ff] text-[#09131c] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Assembled
            </button>
            <button
              type="button"
              onClick={() => setIsExploded(true)}
              className={`py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                isExploded
                  ? 'bg-[#bce3ff] text-[#09131c] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Exploded
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM-RIGHT ACTION BAR: Camera Preset Switcher, Reset View, Help Modal & Interactive @nayrbryanGaming X Link */}
      <div
        style={{
          transform: `scale(${hudScale})`,
          transformOrigin: 'bottom right',
        }}
        className="pointer-events-auto absolute bottom-3 right-5 z-20 flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={cycleCameraPreset}
          title="Switch Camera Angle (Shortcut: C)"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#11161f]/85 hover:bg-[#1a2230] border border-white/15 text-[10px] font-mono text-slate-200 transition-colors cursor-pointer backdrop-blur-sm"
        >
          <Camera className="w-3 h-3 text-sky-300" />
          <span>{CAMERA_PRESETS[cameraPresetIndex].name}</span>
          <span className="text-slate-400 text-[9px]">[C]</span>
        </button>

        <button
          type="button"
          onClick={resetCameraView}
          title="Reset Camera View (Shortcut: R)"
          className="p-1 rounded-md bg-[#11161f]/85 hover:bg-[#1a2230] border border-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer backdrop-blur-sm"
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          title="How the Optical Bench Works (Shortcut: ?)"
          className="p-1 rounded-md bg-[#11161f]/85 hover:bg-[#1a2230] border border-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer backdrop-blur-sm"
        >
          <HelpCircle className="w-3 h-3" />
        </button>

        <a
          href="https://x.com/nayrbryanGaming"
          target="_blank"
          rel="noopener noreferrer"
          title="Follow @nayrbryanGaming on X"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#11161f]/85 hover:bg-[#1a2230] border border-amber-400/35 text-[10px] font-mono text-amber-200 hover:text-amber-100 transition-colors cursor-pointer backdrop-blur-sm"
        >
          <ExternalLink className="w-2.5 h-2.5 text-amber-300" />
          <span>X · @nayrbryanGaming</span>
        </a>
      </div>

      {/* HOW IT WORKS MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#121822] border border-white/20 p-6 shadow-2xl text-slate-200">
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-xs font-mono uppercase tracking-widest text-sky-300">
              Interactive Optical Bench · © @nayrbryanGaming
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              How the Plane of Focus Works
            </h2>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-300">
              <p>
                <strong className="text-white">1. Conjugate Focal Points:</strong> Light rays
                diverging from a single point on the{' '}
                <span className="text-sky-300">Plane of Focus</span> refract through the 6-element
                lens and converge to a single sharp point on the Ground Glass image plane.
              </p>
              <p>
                <strong className="text-white">2. Circle of Confusion (CoC):</strong> Objects in
                front of or behind the Plane of Focus converge either behind or in front of the
                Ground Glass, forming a circular blur disc instead of a point.
              </p>
              <p>
                <strong className="text-white">3. Aperture Stop (f/2 vs f/16):</strong> Stopping
                down the 7-blade iris narrows the light cone angle, shrinking the Circle of
                Confusion and expanding the <span className="text-sky-300">Sharp Zone</span> (Depth
                of Field) from 1.5 cm at f/2 to 12.2 cm at f/16.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
              <div>Drag Focus Ring / Gear: Adjust focus</div>
              <div>Keys 1 / 2 / 3: Focus presets</div>
              <div>Left-Drag / Scroll: 360° Orbit &amp; Zoom</div>
              <div>Key C / R / X: Camera / Reset / Explode</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
