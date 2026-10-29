import * as THREE from 'three';

export const OPTICAL_AXIS_Y = 3.55;
export const OPTICAL_AXIS_Z = 0;

export const IMAGE_PLANE_X = -4.85;
export const LENS_REAR_X = -2.65;
export const LENS_IRIS_X = -1.58;
export const LENS_FRONT_X = 0.50;

export const VALLEY_MIN_X = 1.18;
export const VALLEY_MAX_X = 4.65;
export const VALLEY_HALF_Z = 1.65;
export const VALLEY_BASE_Y = 2.52;

export const CM_PER_UNIT = 23;
export const MIN_FOCUS_D = 1.08; // ~25 cm
export const MAX_FOCUS_D = 7.00; // ~161 cm

export interface ValleySubject {
  id: 'pine' | 'cabin' | 'peak';
  name: string;
  shortName: 'Foreground' | 'Middle' | 'Background';
  index: number;
  d: number;
  worldPos: [number, number, number];
  rayOrigin: [number, number, number];
  color: string;
}

export const SUBJECTS: ValleySubject[] = [
  {
    id: 'pine',
    name: 'the cedar',
    shortName: 'Foreground',
    index: 0,
    d: 1.61, // 37 cm
    worldPos: [LENS_FRONT_X + 1.12, VALLEY_BASE_Y + 0.55, 0.52],
    rayOrigin: [LENS_FRONT_X + 1.12, 3.68, 0.42],
    color: '#98f5b8',
  },
  {
    id: 'cabin',
    name: 'the cedar',
    shortName: 'Middle',
    index: 1,
    d: 2.35, // 54 cm
    worldPos: [LENS_FRONT_X + 1.85, VALLEY_BASE_Y + 0.42, -0.12],
    rayOrigin: [LENS_FRONT_X + 1.85, 3.52, -0.05],
    color: '#ffd089',
  },
  {
    id: 'peak',
    name: 'the pine',
    shortName: 'Background',
    index: 2,
    d: 3.65, // 84 cm
    worldPos: [LENS_FRONT_X + 3.15, VALLEY_BASE_Y + 0.95, -0.35],
    rayOrigin: [LENS_FRONT_X + 3.15, 3.92, -0.32],
    color: '#9ee6ff',
  },
];

export const APERTURE_PRESETS = [2, 5.6, 16] as const;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function distToSlider(d: number): number {
  return clamp(Math.log(d / MIN_FOCUS_D) / Math.log(MAX_FOCUS_D / MIN_FOCUS_D), 0, 1);
}

export function sliderToDist(t: number): number {
  return MIN_FOCUS_D * Math.pow(MAX_FOCUS_D / MIN_FOCUS_D, clamp(t, 0, 1));
}

export function formatDistCm(d: number, forceDecimal = false): string {
  const cm = d * CM_PER_UNIT;
  if (!isFinite(cm)) return '∞';
  if (forceDecimal) return cm.toFixed(1) + ' cm';
  if (cm >= 100) return (cm / 100).toFixed(2) + ' m';
  if (cm >= 20) return Math.round(cm) + ' cm';
  return cm.toFixed(1) + ' cm';
}

/**
 * Calibrated Depth of Field bounds so at focusD = 2.35 (54 cm) and f/16,
 * (farD - nearD) * 23 = 12.2 cm (matching the exact reference readout 12.2 cm),
 * and at f/2 it equals 1.5 cm.
 */
export function computeDofBounds(focusD: number, apertureN: number): [number, number] {
  const cocFactor = 0.002962 * apertureN;
  const invFocus = 1 / Math.max(focusD, 0.05);
  const nearD = 1 / (invFocus + cocFactor);
  const farD = invFocus - cocFactor > 1e-4 ? 1 / (invFocus - cocFactor) : Infinity;
  return [nearD, farD];
}

export function computeCoc(objD: number, focusD: number, apertureN: number): number {
  return (1 / apertureN) * Math.abs(1 / focusD - 1 / Math.max(objD, 0.05));
}

export function formatAperture(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.08) {
    return 'f/' + Math.round(rounded);
  }
  return 'f/' + rounded.toFixed(1);
}

export function buildExplanationParts(focusD: number, apertureN: number): {
  body: string;
  sharpZoneLabel: string;
} {
  const [nearD, farD] = computeDofBounds(focusD, apertureN);
  const dofWidthStr = formatDistCm(farD - nearD, true);

  if (Math.abs(focusD - SUBJECTS[1].d) < 0.25) {
    return {
      body: 'Only the cedar sits on the plane: its rays meet in one point on the glass. The pine behind misses, so it blurs.',
      sharpZoneLabel: `Sharp zone: ${dofWidthStr}.`,
    };
  }

  if (focusD < SUBJECTS[1].d) {
    return {
      body: 'Only the foreground cedar sits on the plane: its rays meet in one point on the glass. The cabin and pine behind miss, so they blur.',
      sharpZoneLabel: `Sharp zone: ${dofWidthStr}.`,
    };
  }

  return {
    body: 'Only the distant pine sits on the plane: its rays meet in one point on the glass. The cedar in front misses, so it blurs.',
    sharpZoneLabel: `Sharp zone: ${dofWidthStr}.`,
  };
}

export interface CameraPreset {
  name: string;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  dofDist: number;
}

/**
 * Camera Presets:
 * Index 0 is the exact Hero Cutaway Lens framing matching the user's reference post!
 */
export const CAMERA_PRESETS: CameraPreset[] = [
  {
    name: 'Cutaway Lens Hero View',
    pos: new THREE.Vector3(-0.52, 3.65, 6.88),
    target: new THREE.Vector3(-0.48, 3.48, 0.0),
    fov: 32,
    dofDist: 6.88,
  },
  {
    name: 'Optical Bench Overview',
    pos: new THREE.Vector3(-0.45, 5.15, 13.8),
    target: new THREE.Vector3(0.10, 3.10, 0.0),
    fov: 30,
    dofDist: 13.8,
  },
  {
    name: 'Plane of Focus in the Valley',
    pos: new THREE.Vector3(0.35, 4.35, 5.15),
    target: new THREE.Vector3(2.35, 3.15, -0.10),
    fov: 30,
    dofDist: 5.15,
  },
  {
    name: 'Ground Glass Image Plane',
    pos: new THREE.Vector3(-7.45, 3.82, 2.85),
    target: new THREE.Vector3(-3.95, 3.48, 0.04),
    fov: 30,
    dofDist: 3.7,
  },
];
