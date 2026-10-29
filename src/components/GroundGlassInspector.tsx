import React from 'react';
import { OpticalTelemetry } from '../optics/opticalPhysics';

interface GroundGlassInspectorProps {
  telemetry: OpticalTelemetry;
  isOpen: boolean;
  onToggle: () => void;
}

export const GroundGlassInspector: React.FC<GroundGlassInspectorProps> = ({
  telemetry,
  isOpen,
  onToggle,
}) => {
  const fgBlurPx = Math.min(18, telemetry.foregroundBlurMm * 2.4);
  const midBlurPx = Math.min(18, telemetry.middleBlurMm * 2.4);
  const bgBlurPx = Math.min(18, telemetry.backgroundBlurMm * 2.4);

  return (
    <div className="fixed bottom-4 left-6 z-20 flex items-end gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="px-3 py-1.5 rounded bg-[#11151e]/85 hover:bg-[#19202e] border border-white/15 text-[11px] font-mono text-[#d8e2f0] tracking-wide transition-colors shadow-lg"
      >
        {isOpen ? 'Hide Ground-Glass Viewfinder' : 'Inspect Ground-Glass Plane'}
      </button>

      {isOpen && (
        <div className="w-64 rounded-lg bg-[#0d1118]/90 backdrop-blur-md border border-white/15 p-3 shadow-2xl">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#93a3b8] mb-2">
            <span>Ground-Glass Image Plane</span>
            <span className="text-[#d4a853]">f/{telemetry.fNumber}</span>
          </div>

          {/* Simulated optical ground glass viewfinder with physical Circle-of-Confusion blur */}
          <div className="relative h-28 w-full rounded bg-[#080b10] border border-white/10 overflow-hidden flex items-end justify-around px-4 pb-2">
            {/* Reticle crosshairs */}
            <div className="pointer-events-none absolute inset-0 border border-dashed border-white/10 m-2 rounded-sm" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/10" />
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/10" />

            {/* Foreground sculpture (36 cm) */}
            <div
              className="flex flex-col items-center transition-all duration-150"
              style={{ filter: `blur(${fgBlurPx.toFixed(1)}px)` }}
            >
              <div className="w-0 h-0 border-l-[11px] border-r-[11px] border-b-[28px] border-l-transparent border-r-transparent border-b-[#70c261]" />
              <span className="text-[8px] font-mono text-white/70 mt-1">36cm</span>
            </div>

            {/* Middle Cedar (54 cm) */}
            <div
              className="flex flex-col items-center transition-all duration-150"
              style={{ filter: `blur(${midBlurPx.toFixed(1)}px)` }}
            >
              <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-b-[38px] border-l-transparent border-r-transparent border-b-[#4da349]" />
              <span className="text-[8px] font-mono text-[#f5d78e] mt-1">54cm</span>
            </div>

            {/* Background Pine (86 cm) */}
            <div
              className="flex flex-col items-center transition-all duration-150"
              style={{ filter: `blur(${bgBlurPx.toFixed(1)}px)` }}
            >
              <div className="w-0 h-0 border-l-[16px] border-r-[16px] border-b-[46px] border-l-transparent border-r-transparent border-b-[#2c7530]" />
              <span className="text-[8px] font-mono text-white/70 mt-1">86cm</span>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] font-mono text-[#93a3b8]">
            <div>
              FG CoC: <span className="text-white">{telemetry.foregroundBlurMm}mm</span>
            </div>
            <div>
              MID CoC: <span className="text-white">{telemetry.middleBlurMm}mm</span>
            </div>
            <div>
              BG CoC: <span className="text-white">{telemetry.backgroundBlurMm}mm</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
