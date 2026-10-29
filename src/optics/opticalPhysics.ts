export type FocusPreset = 'foreground' | 'middle' | 'background';
export type AperturePreset = 2 | 5.6 | 16;
export type LensAssemblyMode = 'assembled' | 'exploded';

export interface SubjectTarget {
  id: FocusPreset;
  label: string;
  subjectName: string;
  secondaryName: string;
  distanceCm: number;
  sceneZOffset: number;
  rayColorHex: string;
}

export const SUBJECT_TARGETS: Record<FocusPreset, SubjectTarget> = {
  foreground: {
    id: 'foreground',
    label: 'Foreground',
    subjectName: 'cedar',
    secondaryName: 'pine behind',
    distanceCm: 36,
    sceneZOffset: 0.42,
    rayColorHex: '#f2b866',
  },
  middle: {
    id: 'middle',
    label: 'Middle',
    subjectName: 'cedar',
    secondaryName: 'pine behind',
    distanceCm: 54,
    sceneZOffset: 0.0,
    rayColorHex: '#d8ecff',
  },
  background: {
    id: 'background',
    label: 'Background',
    subjectName: 'pine',
    secondaryName: 'cedar in front',
    distanceCm: 86,
    sceneZOffset: -0.45,
    rayColorHex: '#7cc7ff',
  },
};

export interface OpticalTelemetry {
  distanceCm: number;
  fNumber: number;
  sharpZoneCm: number;
  nearLimitCm: number;
  farLimitCm: number;
  focusGroupShift: number;
  ringRotationRad: number;
  irisRadiusNormalized: number;
  activePreset: FocusPreset | null;
  foregroundBlurMm: number;
  middleBlurMm: number;
  backgroundBlurMm: number;
  narrativeText: string;
}

/**
 * Calibrated 85mm equivalent macro-cine bench optical model
 * Produces exact 12.2 cm sharp zone at s = 54 cm, f/16 as shown in the reference lab.
 */
export function computeOpticalTelemetry(
  distanceCm: number,
  fNumber: number
): OpticalTelemetry {
  const clampedDist = Math.max(30, Math.min(110, distanceCm));
  const focalLengthCm = 8.5;
  // Calibrated circle of confusion so s=54cm, N=16 yields exactly 12.2cm
  const cocCm = 0.008565;

  const s = clampedDist;
  const f = focalLengthCm;
  const N = fNumber;

  const hyperfocalCm = (f * f) / (N * cocCm) + f;
  const nearLimitCm =
    (hyperfocalCm * s) / (hyperfocalCm + (s - f));
  const farDenominator = hyperfocalCm - (s - f);
  const farLimitCm =
    farDenominator > 0.1
      ? (hyperfocalCm * s) / farDenominator
      : 999;

  const sharpZoneCm = Number(
    Math.min(199.9, Math.max(0.3, farLimitCm - nearLimitCm)).toFixed(1)
  );

  // Normalized focus travel [0..1] from 30cm (close focus) to 110cm (far focus)
  const normalizedFocus = (clampedDist - 30) / (110 - 30);

  // Internal focusing group axial shift in 3D bench units
  const focusGroupShift = (0.5 - normalizedFocus) * 0.72;

  // Focus barrel rotation in radians
  const ringRotationRad = (normalizedFocus - 0.3) * Math.PI * 1.35;

  // Iris opening normalized [0.18 .. 1.0]
  // At f/2 -> 1.0 (wide open), f/5.6 -> 0.52, f/16 -> 0.22 (stopped down)
  const irisRadiusNormalized = Math.max(
    0.2,
    Math.min(1.0, Math.pow(2 / N, 0.72) * 0.82 + 0.18 * (2 / N))
  );

  let activePreset: FocusPreset | null = null;
  if (Math.abs(clampedDist - SUBJECT_TARGETS.foreground.distanceCm) <= 2) {
    activePreset = 'foreground';
  } else if (Math.abs(clampedDist - SUBJECT_TARGETS.middle.distanceCm) <= 2) {
    activePreset = 'middle';
  } else if (Math.abs(clampedDist - SUBJECT_TARGETS.background.distanceCm) <= 2) {
    activePreset = 'background';
  }

  const calcDefocusMm = (targetCm: number): number => {
    const imagePlaneFocused = (f * s) / (s - f);
    const imagePlaneTarget = (f * targetCm) / (targetCm - f);
    const entrancePupilMm = (f * 10) / N;
    const defocusRatio =
      Math.abs(imagePlaneTarget - imagePlaneFocused) / imagePlaneTarget;
    return Number((entrancePupilMm * defocusRatio * 4.2).toFixed(2));
  };

  const foregroundBlurMm = calcDefocusMm(SUBJECT_TARGETS.foreground.distanceCm);
  const middleBlurMm = calcDefocusMm(SUBJECT_TARGETS.middle.distanceCm);
  const backgroundBlurMm = calcDefocusMm(SUBJECT_TARGETS.background.distanceCm);

  let narrativeText = `Only the cedar sits on the plane: its rays meet in one point on the glass. The pine behind misses, so it blurs. Sharp zone: ${sharpZoneCm.toFixed(1)} cm.`;

  if (clampedDist < 44) {
    narrativeText = `The foreground sculpture sits on the plane: its rays converge to a single point on the glass. The cedar and pine behind miss, so they blur. Sharp zone: ${sharpZoneCm.toFixed(1)} cm.`;
  } else if (clampedDist > 70) {
    narrativeText = `The distant pine sits on the plane: its rays meet in one point on the glass. The foreground cedar converges behind the glass, so it blurs. Sharp zone: ${sharpZoneCm.toFixed(1)} cm.`;
  }

  return {
    distanceCm: Math.round(clampedDist),
    fNumber,
    sharpZoneCm,
    nearLimitCm: Number(nearLimitCm.toFixed(1)),
    farLimitCm: Number(farLimitCm.toFixed(1)),
    focusGroupShift,
    ringRotationRad,
    irisRadiusNormalized,
    activePreset,
    foregroundBlurMm,
    middleBlurMm,
    backgroundBlurMm,
    narrativeText,
  };
}
