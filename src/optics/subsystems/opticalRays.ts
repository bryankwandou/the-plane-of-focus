import * as THREE from 'three';
import {
  OPTICAL_AXIS_Y,
  IMAGE_PLANE_X,
  SUBJECTS,
  computeCoc,
  clamp,
} from '../opticalPhysics';

export const SUBJECT_GLASS_COORDS = [
  { id: 'pine', zOff: -0.68, yOff: -0.04 },
  { id: 'cabin', zOff: -0.04, yOff: 0.15 },
  { id: 'peak', zOff: 0.04, yOff: -0.34 },
];

export interface OpticalRaysController {
  group: THREE.Group;
  update: (
    focusD: number,
    apertureN: number,
    focusGroupX?: number,
    frontElementX?: number
  ) => void;
}

export function buildOpticalRays(scene: THREE.Scene): OpticalRaysController {
  const raysRoot = new THREE.Group();
  raysRoot.name = 'OpticalRays';
  scene.add(raysRoot);

  const numRaysPerBundle = 6;
  const bundles: {
    subj: (typeof SUBJECTS)[number];
    idx: number;
    positions: Float32Array;
    geo: THREE.BufferGeometry;
    mat: THREE.LineBasicMaterial;
    landPositions: Float32Array;
    landGeo: THREE.BufferGeometry;
    landMat: THREE.LineBasicMaterial;
    ringPos: Float32Array;
    ringGeo: THREE.BufferGeometry;
    ringMat: THREE.LineBasicMaterial;
    discFillMesh: THREE.Mesh;
    discFillMat: THREE.MeshBasicMaterial;
    originDot: THREE.Mesh;
    waistDot: THREE.Mesh;
    waistDotMat: THREE.MeshBasicMaterial;
  }[] = [];

  SUBJECTS.forEach((subj, idx) => {
    const maxVerts = numRaysPerBundle * 12;
    const positions = new Float32Array(maxVerts * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#e2f7ff'),
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lineSegments = new THREE.LineSegments(geo, mat);
    raysRoot.add(lineSegments);

    const landVerts = numRaysPerBundle * 2;
    const landPositions = new Float32Array(landVerts * 3);
    const landGeo = new THREE.BufferGeometry();
    landGeo.setAttribute('position', new THREE.BufferAttribute(landPositions, 3));
    const landMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const landSegments = new THREE.LineSegments(landGeo, landMat);
    landSegments.renderOrder = 10;
    raysRoot.add(landSegments);

    const ringPts = 56;
    const ringPos = new Float32Array(ringPts * 3);
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
    const ringMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const ringLoop = new THREE.LineLoop(ringGeo, ringMat);
    ringLoop.renderOrder = 12;
    raysRoot.add(ringLoop);

    const discFillGeo = new THREE.CircleGeometry(1, 48);
    const discFillMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#d8f8f2'),
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const discFillMesh = new THREE.Mesh(discFillGeo, discFillMat);
    discFillMesh.rotation.y = -Math.PI / 2;
    discFillMesh.renderOrder = 11;
    raysRoot.add(discFillMesh);

    const originDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 12, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff') })
    );
    originDot.position.set(...subj.rayOrigin);
    raysRoot.add(originDot);

    const waistDotMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#8eeeff'),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const waistDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 12),
      waistDotMat
    );
    waistDot.renderOrder = 13;
    raysRoot.add(waistDot);

    bundles.push({
      subj,
      idx,
      positions,
      geo,
      mat,
      landPositions,
      landGeo,
      landMat,
      ringPos,
      ringGeo,
      ringMat,
      discFillMesh,
      discFillMat,
      originDot,
      waistDot,
      waistDotMat,
    });
  });

  // Central braided harmonic axial wavefront beam inside the cutaway barrel (visible at f/16 & f/5.6)
  const axialStrands = 4;
  const axialPts = 64;
  const axialWaveLines: THREE.Line[] = [];
  for (let s = 0; s < axialStrands; s++) {
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(axialPts * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({
      color: s % 2 === 0 ? 0xf2fbff : 0x99dcff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geom, mat);
    raysRoot.add(line);
    axialWaveLines.push(line);
  }

  function update(
    focusD: number,
    apertureN: number,
    focusGroupX = -1.14,
    frontElementX = 0.45
  ) {
    const apNorm = Math.pow(2 / apertureN, 0.88);
    const maxLensR = 0.38;
    const beamR = 0.032 + apNorm * (maxLensR - 0.032);

    const xFront = frontElementX;
    const xFocusGrp = focusGroupX;
    const xIris = -1.58;
    const xRear1 = -1.89;
    const xRear2 = -2.22;
    const xGlass = IMAGE_PLANE_X;

    const focusVergence = 1 / focusD;

    bundles.forEach((b) => {
      const {
        subj,
        idx,
        positions,
        geo,
        mat,
        landPositions,
        landGeo,
        landMat,
        ringPos,
        ringGeo,
        ringMat,
        discFillMesh,
        discFillMat,
        waistDot,
        waistDotMat,
      } = b;
      const [ox, oy, oz] = subj.rayOrigin;
      const glassCoord = SUBJECT_GLASS_COORDS[idx];
      const gx = xGlass;
      const gy = OPTICAL_AXIS_Y + glassCoord.yOff;
      const gz = glassCoord.zOff;

      const objVergence = 1 / subj.d;
      const invDiff = objVergence - focusVergence;
      const cocUnsigned = computeCoc(subj.d, focusD, apertureN);
      const isFocused = cocUnsigned < 0.015;

      mat.opacity = isFocused ? 0.82 : 0.38;
      mat.color.set(isFocused ? '#eefbff' : '#bfe8f8');
      landMat.opacity = isFocused ? 0.68 : 0.42;
      ringMat.opacity = isFocused ? 0.98 : 0.84;

      const signedDiscR = clamp(invDiff * (1 / apertureN) * 0.94, -0.175, 0.175);
      const absDiscR = Math.max(Math.abs(signedDiscR), 0.012);

      discFillMesh.position.set(gx - 0.004, gy, gz);
      discFillMesh.scale.set(absDiscR, absDiscR, 1);
      discFillMat.opacity = isFocused ? 0.92 : 0.22;
      discFillMat.color.set(isFocused ? '#ffffff' : '#d2f6ee');

      const ringPts = 56;
      for (let p = 0; p < ringPts; p++) {
        const ang = (p / ringPts) * Math.PI * 2;
        const pBase = p * 3;
        ringPos[pBase] = gx - 0.005;
        ringPos[pBase + 1] = gy + Math.sin(ang) * absDiscR;
        ringPos[pBase + 2] = gz + Math.cos(ang) * absDiscR;
      }
      ringGeo.attributes.position.needsUpdate = true;

      const dyObj = oy - OPTICAL_AXIS_Y;
      const dzObj = oz;
      const chiefFrontY = OPTICAL_AXIS_Y + dyObj * 0.075;
      const chiefFrontZ = dzObj * 0.075;

      const fgFrac = clamp((xFocusGrp - xIris) / (xFront - xIris), 0.1, 0.9);
      const chiefFgY = OPTICAL_AXIS_Y + dyObj * 0.075 * fgFrac * 0.72;
      const chiefFgZ = dzObj * 0.075 * fgFrac * 0.72;

      const chiefIrisY = OPTICAL_AXIS_Y + (idx - 1) * 0.006;
      const chiefIrisZ = (idx - 1) * 0.006;

      const rear1Frac = (xIris - xRear1) / (xIris - xGlass);
      const chiefRear1Y = chiefIrisY + (gy - chiefIrisY) * rear1Frac * 0.65;
      const chiefRear1Z = chiefIrisZ + (gz - chiefIrisZ) * rear1Frac * 0.65;

      const rear2Frac = (xIris - xRear2) / (xIris - xGlass);
      const chiefRear2Y = chiefIrisY + (gy - chiefIrisY) * rear2Frac * 0.82;
      const chiefRear2Z = chiefIrisZ + (gz - chiefIrisZ) * rear2Frac * 0.82;

      const focusT = clamp((-0.92 - xFocusGrp) / 0.42, 0.0, 1.0);

      const frontR = beamR * clamp(1.04 + (objVergence - 0.45) * 0.12, 0.84, 1.14);
      const fgR = beamR * clamp(1.08 - focusT * 0.46 + (objVergence - 0.45) * 0.1, 0.52, 1.15);
      const irisR = beamR * clamp(0.7 + focusT * 0.2 + invDiff * 0.16, 0.5, 0.98);
      const rear1R = beamR * clamp(0.56 + focusT * 0.38 + invDiff * 0.24, 0.4, 1.08);
      const rear2R = beamR * clamp(0.44 + focusT * 0.5 + invDiff * 0.34, 0.32, 1.14);

      const tWaist = rear2R / Math.max(0.001, rear2R - signedDiscR);
      if (tWaist <= 1.02) {
        const tClamped = Math.min(1.0, tWaist);
        const xWaist = xRear2 + tClamped * (xGlass - xRear2);
        const yWaist = chiefRear2Y + tClamped * (gy - chiefRear2Y);
        const zWaist = chiefRear2Z + tClamped * (gz - chiefRear2Z);
        waistDot.position.set(xWaist, yWaist, zWaist);
        waistDot.visible = true;
        waistDot.scale.setScalar(isFocused ? 1.25 : 0.85);
        waistDotMat.color.set(isFocused ? '#ffffff' : '#7fe3ff');
        waistDotMat.opacity = isFocused ? 0.95 : 0.65;
      } else {
        waistDot.visible = false;
      }

      let vPtr = 0;
      let lPtr = 0;
      const pushSeg = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
        positions[vPtr++] = x1;
        positions[vPtr++] = y1;
        positions[vPtr++] = z1;
        positions[vPtr++] = x2;
        positions[vPtr++] = y2;
        positions[vPtr++] = z2;
      };

      for (let r = 0; r < numRaysPerBundle; r++) {
        const angle = (r / numRaysPerBundle) * Math.PI * 2 + 0.15;
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);

        const yFront = chiefFrontY + sinA * frontR;
        const zFront = chiefFrontZ + cosA * frontR;

        const yFg = chiefFgY + sinA * fgR;
        const zFg = chiefFgZ + cosA * fgR;

        const yIris = chiefIrisY + sinA * irisR;
        const zIris = chiefIrisZ + cosA * irisR;

        const yRear1 = chiefRear1Y + sinA * rear1R;
        const zRear1 = chiefRear1Z + cosA * rear1R;

        const yRear2 = chiefRear2Y + sinA * rear2R;
        const zRear2 = chiefRear2Z + cosA * rear2R;

        const yGlassHit = gy + sinA * signedDiscR;
        const zGlassHit = gz + cosA * signedDiscR;

        pushSeg(ox, oy, oz, xFront, yFront, zFront);
        pushSeg(xFront, yFront, zFront, xFocusGrp, yFg, zFg);
        pushSeg(xFocusGrp, yFg, zFg, xIris, yIris, zIris);
        pushSeg(xIris, yIris, zIris, xRear1, yRear1, zRear1);
        pushSeg(xRear1, yRear1, zRear1, xRear2, yRear2, zRear2);
        pushSeg(xRear2, yRear2, zRear2, xGlass, yGlassHit, zGlassHit);

        const frac = 0.18;
        const xLandStart = xGlass + (xRear2 - xGlass) * frac;
        const yLandStart = yGlassHit + (yRear2 - yGlassHit) * frac;
        const zLandStart = zGlassHit + (zRear2 - zGlassHit) * frac;
        landPositions[lPtr++] = xLandStart;
        landPositions[lPtr++] = yLandStart;
        landPositions[lPtr++] = zLandStart;
        landPositions[lPtr++] = xGlass;
        landPositions[lPtr++] = yGlassHit;
        landPositions[lPtr++] = zGlassHit;
      }

      geo.attributes.position.needsUpdate = true;
      landGeo.attributes.position.needsUpdate = true;
    });

    // Update central braided axial wavefront inside the cutaway barrel
    for (let s = 0; s < axialStrands; s++) {
      const line = axialWaveLines[s];
      const posAttr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const phase = (s / axialStrands) * Math.PI * 2;
      const amp = 0.018 + apNorm * 0.022;

      for (let p = 0; p < axialPts; p++) {
        const t = p / (axialPts - 1);
        const x = xFront + (xRear2 - xFront) * t;
        const env = Math.sin(t * Math.PI) * 0.85 + 0.15;
        const wy = OPTICAL_AXIS_Y + Math.sin(t * 14 + phase) * amp * env;
        const wz = Math.cos(t * 14 + phase) * amp * 0.55 * env;
        posAttr.setXYZ(p, x, wy, wz);
      }
      posAttr.needsUpdate = true;
    }
  }

  update(2.35, 16, -1.16, 0.45);

  return {
    group: raysRoot,
    update,
  };
}
