import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function createSeededRandom(seed = 7): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvasTexture(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  isSRGB = true
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildStudioEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();

  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        vec3 col = mix(vec3(0.10, 0.085, 0.07), vec3(0.16, 0.19, 0.26), smoothstep(-0.4, 0.1, vDir.y));
        col = mix(col, vec3(0.06, 0.08, 0.13), smoothstep(0.2, 0.9, vDir.y));
        col += vec3(1.55, 0.88, 0.45) * smoothstep(0.55, 0.95, vDir.x) * smoothstep(-0.1, 0.25, vDir.y) * (1.0 - smoothstep(0.3, 0.7, vDir.y));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), domeMat));

  const softboxColors: [number, number, number][] = [
    [5.8, 4.4, 3.1],
    [1.9, 3.8, 5.4],
    [4.8, 3.1, 1.6],
    [2.7, 3.0, 3.5],
    [1.6, 4.4, 5.6],
    [3.6, 3.6, 3.6],
  ];

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.4;
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.4, 0.4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(...softboxColors[i]) })
    );
    panel.position.set(Math.sin(angle) * 28, 12 + (i % 2) * 9, Math.cos(angle) * 28);
    panel.lookAt(0, 0, 0);
    envScene.add(panel);
  }

  const warmBar = new THREE.Mesh(
    new THREE.BoxGeometry(40, 1.2, 1.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(6.2, 3.5, 1.3) })
  );
  warmBar.position.set(0, -6, -30);
  envScene.add(warmBar);

  scene.environment = pmrem.fromScene(envScene, 0.03).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();
}

export const MATS = {
  consoleSlate: new THREE.MeshPhysicalMaterial({
    color: '#3f4652',
    metalness: 0.82,
    roughness: 0.36,
    envMapIntensity: 1.2,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
  }),
  consoleDark: new THREE.MeshPhysicalMaterial({
    color: '#22262e',
    metalness: 0.72,
    roughness: 0.42,
    envMapIntensity: 1.1,
    clearcoat: 0.25,
  }),
  anodizedBlack: new THREE.MeshPhysicalMaterial({
    color: '#15171c',
    metalness: 0.62,
    roughness: 0.4,
    envMapIntensity: 1.2,
    clearcoat: 0.32,
    clearcoatRoughness: 0.28,
  }),
  matteRubber: new THREE.MeshStandardMaterial({
    color: '#111216',
    roughness: 0.72,
    metalness: 0.18,
    envMapIntensity: 0.5,
  }),
  brushedBrass: new THREE.MeshPhysicalMaterial({
    color: '#cd9442',
    metalness: 1.0,
    roughness: 0.24,
    envMapIntensity: 1.48,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
  }),
  brushedSteel: new THREE.MeshPhysicalMaterial({
    color: '#b8c0cc',
    metalness: 0.95,
    roughness: 0.22,
    envMapIntensity: 1.3,
  }),
  gunmetal: new THREE.MeshPhysicalMaterial({
    color: '#8e96a3',
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 1.2,
  }),
};

/**
 * Multi-Coated Crystal Optical Glass Shader:
 * - Crystal-clear center so internal rays and brass iris are 100% sharp
 * - Grazing ice-cyan & sapphire polar crescents + warm brass reflection arc + 45-deg diamond chamfer rim
 */
export function createOpticalGlassMaterial(
  tint = '#8ce6ff',
  rimStrength = 1.0,
  glassRadius = 0.78,
  coatingShift = 0.0
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0c2230'),
    emissive: new THREE.Color('#020a10'),
    emissiveIntensity: 0.05,
    metalness: 0.0,
    roughness: 0.035,
    ior: 1.54,
    reflectivity: 0.55,
    clearcoat: 0.45,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.5,
    transparent: true,
    opacity: 0.03,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const tintCol = new THREE.Color(tint);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimStrength = { value: rimStrength };
    shader.uniforms.uGlassRadius = { value: glassRadius };
    shader.uniforms.uTintColor = { value: tintCol };
    shader.uniforms.uCoatingShift = { value: coatingShift };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vGlassPos;
         varying vec3 vGlassLocalNormal;
         varying vec3 vGlassWorldPos;
         varying vec3 vGlassWorldNormal;
         varying vec3 vGlassRadialWorld;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vGlassPos = position;
         vGlassLocalNormal = normal;
         vec4 wp = modelMatrix * vec4(position, 1.0);
         vGlassWorldPos = wp.xyz;
         vGlassWorldNormal = normalize(mat3(modelMatrix) * normal);
         vGlassRadialWorld = mat3(modelMatrix) * vec3(0.0, position.y, position.z);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uRimStrength;
         uniform float uGlassRadius;
         uniform vec3 uTintColor;
         uniform float uCoatingShift;
         varying vec3 vGlassPos;
         varying vec3 vGlassLocalNormal;
         varying vec3 vGlassWorldPos;
         varying vec3 vGlassWorldNormal;
         varying vec3 vGlassRadialWorld;`
      )
      .replace(
        '#include <dithering_fragment>',
        `{
           vec3 V = normalize(cameraPosition - vGlassWorldPos);
           vec3 N = normalize(vGlassWorldNormal);
           if (!gl_FrontFacing) N = -N;

           float rLen = length(vGlassPos.yz);
           float rNorm = clamp(rLen / max(uGlassRadius, 0.1), 0.0, 1.0);
           vec3 radialWorld = length(vGlassRadialWorld) > 1e-4
             ? normalize(vGlassRadialWorld)
             : vec3(0.0, 1.0, 0.0);

           float radialViewDot = abs(dot(radialWorld, V));
           float silhouette = pow(clamp(1.0 - radialViewDot, 0.0, 1.0), 2.1) * smoothstep(0.35, 0.99, rNorm);
           float tightPolarTip = pow(clamp(1.0 - radialViewDot, 0.0, 1.0), 3.8) * smoothstep(0.72, 0.995, rNorm);

           float axialView = smoothstep(0.16, 0.70, abs(V.x));
           float circularRim = smoothstep(0.65, 0.99, rNorm) * pow(rNorm, 1.7) * axialView;

           float isFace = smoothstep(0.25, 0.58, abs(vGlassLocalNormal.x));
           float isGroundRim = 1.0 - isFace;
           float isRightFace = step(0.0, vGlassLocalNormal.x);

           float zFront = clamp(vGlassPos.z / max(uGlassRadius, 0.1), -1.0, 1.0);
           float frontHemi = smoothstep(-0.14, 0.24, zFront);

           float primaryArc = exp(-pow((zFront - 0.25) * 3.6, 2.0)) * frontHemi * isFace;
           float meridianArc = exp(-pow((zFront - 0.02) * 5.4, 2.0)) * isFace * (0.48 + 0.52 * isRightFace);

           vec3 R = reflect(-V, N);
           float studioSpec1 = pow(max(0.0, dot(R, normalize(vec3(0.35, 0.78, 0.52)))), 14.0) * isFace;
           float studioSpec2 = pow(max(0.0, dot(R, normalize(vec3(-0.45, 0.62, 0.64)))), 18.0) * isFace;
           float orbitDomeSheen = (studioSpec1 * 0.58 + studioSpec2 * 0.45) * (0.28 + 0.72 * axialView);

           float warmBrass = exp(-pow((zFront - 0.15) * 3.0, 2.0)) * frontHemi * (1.0 - silhouette * 0.65) * 0.28 * isFace;
           float bevelRing = smoothstep(0.92, 0.995, rNorm) * (silhouette * 0.88 + frontHemi * 0.26 + axialView * 0.68);

           vec3 coatCol = mix(uTintColor, vec3(0.58, 0.93, 1.0), 0.35 + 0.3 * uCoatingShift);

           vec3 glassCol = coatCol * (
             silhouette * 0.82 +
             circularRim * 0.56 +
             isGroundRim * (0.18 * frontHemi + 0.76 * silhouette + 0.48 * axialView) +
             meridianArc * 0.36 +
             axialView * 0.16 * isFace
           ) * uRimStrength;

           glassCol += vec3(0.94, 0.99, 1.0) * (
             primaryArc * 0.46 +
             orbitDomeSheen +
             tightPolarTip * 0.84 * uRimStrength +
             bevelRing * 0.62 * uRimStrength
           );
           glassCol += vec3(0.98, 0.70, 0.32) * warmBrass;

           gl_FragColor.rgb = min(glassCol, vec3(0.97));

           float alpha = 0.025
             + primaryArc * 0.18
             + meridianArc * 0.13
             + orbitDomeSheen * 0.44
             + warmBrass * 0.13
             + silhouette * 0.52 * uRimStrength
             + circularRim * 0.36 * uRimStrength
             + tightPolarTip * 0.38 * uRimStrength
             + bevelRing * 0.36 * uRimStrength
             + axialView * 0.09 * isFace
             + isGroundRim * (0.06 * frontHemi + 0.48 * silhouette + 0.30 * axialView);
           gl_FragColor.a = clamp(alpha, 0.025, 0.84);
         }
         #include <dithering_fragment>`
      );
  };
  return mat;
}

export function createIrisMaterial(baseColor = '#1c1e24'): THREE.MeshPhysicalMaterial {
  const uniforms = {
    uAp: { value: 0.62 },
    uRot: { value: 0.0 },
    uGlow: { value: 0.0 },
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    metalness: 0.72,
    roughness: 0.38,
    side: THREE.DoubleSide,
    envMapIntensity: 1.15,
    clearcoat: 0.4,
    alphaTest: 0.5,
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec2 vIr;`
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
         vIr = uv * 2.0 - 1.0;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec2 vIr;
         uniform float uAp;
         uniform float uRot;
         uniform float uGlow;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           float rho = length(vIr);
           float th = atan(vIr.y, vIr.x) + uRot;
           const float n = 7.0;
           const float seg = 6.2831853 / n;
           float w = mod(th, seg) - seg * 0.5;
           float rp = uAp * cos(seg * 0.5) / cos(w) * (1.0 + 0.04 * (1.0 - abs(w) / (seg * 0.5)));
           if (rho < rp || rho > 1.0) discard;
           float sp = fract((th + (rho - uAp) * 1.9) / seg);
           float seam = smoothstep(0.0, 0.035, sp) * smoothstep(1.0, 0.965, sp);
           diffuseColor.rgb *= mix(0.32, 1.0, seam) * (0.8 + 0.2 * smoothstep(uAp, 1.0, rho));
           diffuseColor.rgb += vec3(0.95, 0.58, 0.22) * uGlow * smoothstep(0.92, 1.0, rho);
           diffuseColor.rgb += vec3(0.55, 0.85, 1.0) * 0.28 * smoothstep(rp + 0.04, rp, rho);
         }`
      );
  };

  mat.userData.uniforms = uniforms;
  return mat;
}

export function makeRoundedBox(
  w: number,
  h: number,
  d: number,
  radius = 0.05,
  segments = 2
): RoundedBoxGeometry {
  const r = Math.min(radius, Math.min(w, h, d) / 2.05);
  return new RoundedBoxGeometry(w, h, d, segments, r);
}

export function makeRingTube(
  xStart: number,
  xEnd: number,
  innerR: number,
  outerR: number,
  mat: THREE.Material,
  phiStart = 0,
  phiLength = Math.PI * 2
): THREE.Mesh {
  const radialSegments = 72;
  const ch = Math.min(0.01, (xEnd - xStart) * 0.16, (outerR - innerR) * 0.22);
  const invSqrt2 = 0.70710678;

  const faces: [number, number, number, number, number, number][] = [
    [xStart, innerR, xStart, outerR - ch, -1, 0],
    [xStart, outerR - ch, xStart + ch, outerR, -invSqrt2, invSqrt2],
    [xStart + ch, outerR, xEnd - ch, outerR, 0, 1],
    [xEnd - ch, outerR, xEnd, outerR - ch, invSqrt2, invSqrt2],
    [xEnd, outerR - ch, xEnd, innerR, 1, 0],
    [xEnd, innerR, xStart, innerR, 0, -1],
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (const [x1, r1, x2, r2, nx, nr] of faces) {
    const base = positions.length / 3;
    for (let row = 0; row < 2; row++) {
      const x = row === 0 ? x1 : x2;
      const r = row === 0 ? r1 : r2;
      for (let s = 0; s <= radialSegments; s++) {
        const phi = phiStart + (s / radialSegments) * phiLength;
        const sinP = Math.sin(phi);
        const cosP = Math.cos(phi);
        positions.push(x, -sinP * r, cosP * r);
        normals.push(nx, -sinP * nr, cosP * nr);
      }
    }
    const stride = radialSegments + 1;
    for (let s = 0; s < radialSegments; s++) {
      const a = base + s;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return new THREE.Mesh(geo, mat);
}

export function createLensElementGeometry(
  radius: number,
  rimThickness: number,
  r1: number,
  r2: number,
  radialSegments = 96
): THREE.BufferGeometry {
  const steps = 28;
  const chamfer = Math.min(0.011, rimThickness * 0.18);
  const faceRadius = Math.max(0.05, radius - chamfer);

  function computeSag(R: number, y: number): number {
    if (!R || R === 0) return 0;
    const absR = Math.abs(R);
    const clampedY = Math.min(y, absR * 0.96);
    return Math.sign(R) * (absR - Math.sqrt(Math.max(absR * absR - clampedY * clampedY, 0)));
  }

  const xRim1 = -rimThickness * 0.5;
  const xRim2 = rimThickness * 0.5;
  const xEdge1 = xRim1 + chamfer;
  const xEdge2 = xRim2 - chamfer;

  const rimSag1 = computeSag(r1, faceRadius);
  const rimSag2 = computeSag(r2, faceRadius);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  function addLatheSurface(ringPts: [number, number, number, number][]) {
    const baseVertex = positions.length / 3;
    const numRings = ringPts.length;
    for (let i = 0; i < numRings; i++) {
      const [x, r, nx, nr] = ringPts[i];
      const vCoord = i / Math.max(1, numRings - 1);
      for (let s = 0; s <= radialSegments; s++) {
        const uCoord = s / radialSegments;
        const phi = uCoord * Math.PI * 2;
        const sinP = Math.sin(phi);
        const cosP = Math.cos(phi);

        positions.push(x, -sinP * r, cosP * r);
        normals.push(nx, -sinP * nr, cosP * nr);
        uvs.push(uCoord, vCoord);
      }
    }

    const stride = radialSegments + 1;
    for (let i = 0; i < numRings - 1; i++) {
      for (let s = 0; s < radialSegments; s++) {
        const a = baseVertex + i * stride + s;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const face1Pts: [number, number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const y = (faceRadius * i) / steps;
    const sag = computeSag(r1, y);
    const x = xEdge1 - (rimSag1 - sag);
    let nx = -1;
    let nr = 0;
    if (r1 !== 0) {
      const absR = Math.abs(r1);
      const clampedY = Math.min(y, absR * 0.96);
      const root = Math.sqrt(Math.max(absR * absR - clampedY * clampedY, 1e-5));
      const slope = (Math.sign(r1) * clampedY) / root;
      const len = Math.hypot(1, slope);
      nx = -1 / len;
      nr = slope / len;
    }
    face1Pts.push([x, y, nx, nr]);
  }
  addLatheSurface(face1Pts);

  const face2Pts: [number, number, number, number][] = [];
  for (let i = steps; i >= 0; i--) {
    const y = (faceRadius * i) / steps;
    const sag = computeSag(r2, y);
    const x = xEdge2 + (rimSag2 - sag);
    let nx = 1;
    let nr = 0;
    if (r2 !== 0) {
      const absR = Math.abs(r2);
      const clampedY = Math.min(y, absR * 0.96);
      const root = Math.sqrt(Math.max(absR * absR - clampedY * clampedY, 1e-5));
      const slope = (Math.sign(r2) * clampedY) / root;
      const len = Math.hypot(1, slope);
      nx = 1 / len;
      nr = slope / len;
    }
    face2Pts.push([x, y, nx, nr]);
  }
  addLatheSurface(face2Pts);

  const invSqrt2 = 0.70710678;
  addLatheSurface([
    [xEdge1, faceRadius, -invSqrt2, invSqrt2],
    [xRim1, radius, -invSqrt2, invSqrt2],
  ]);
  addLatheSurface([
    [xRim1, radius, 0, 1],
    [xRim2, radius, 0, 1],
  ]);
  addLatheSurface([
    [xRim2, radius, invSqrt2, invSqrt2],
    [xEdge2, faceRadius, invSqrt2, invSqrt2],
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function createGearGeometry(
  innerRadius: number,
  outerRadius: number,
  toothHeight: number,
  numTeeth: number,
  thickness: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const pitch = (Math.PI * 2) / numTeeth;
  const rRoot = outerRadius;
  const rTip = outerRadius + toothHeight;

  for (let t = 0; t < numTeeth; t++) {
    const a0 = t * pitch;
    const a1 = a0 + pitch * 0.14;
    const a2 = a0 + pitch * 0.24;
    const a3 = a0 + pitch * 0.54;
    const a4 = a0 + pitch * 0.64;

    const p0x = Math.cos(a0) * rRoot;
    const p0y = Math.sin(a0) * rRoot;
    if (t === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * rRoot, Math.sin(a1) * rRoot);
    shape.lineTo(Math.cos(a2) * rTip, Math.sin(a2) * rTip);
    shape.lineTo(Math.cos(a3) * rTip, Math.sin(a3) * rTip);
    shape.lineTo(Math.cos(a4) * rRoot, Math.sin(a4) * rRoot);
  }
  shape.closePath();

  if (innerRadius > 0.001) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const bevel = Math.min(0.009, thickness * 0.08, toothHeight * 0.18);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 48,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function createRibbedBarrelGeometry(
  xStart: number,
  xEnd: number,
  innerR: number,
  outerR: number,
  numRibs = 60,
  ribDepth = 0.055
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const radialSteps = numRibs * 6;
  const bevel = 0.035;

  const rings: [number, number][] = [
    [xStart, innerR],
    [xStart, outerR - ribDepth],
    [xStart + bevel, outerR],
    [xEnd - bevel, outerR],
    [xEnd, outerR - ribDepth],
    [xEnd, innerR],
  ];

  for (let rIdx = 0; rIdx < rings.length; rIdx++) {
    for (let u = 0; u <= radialSteps; u++) {
      const angle = (u / radialSteps) * Math.PI * 2;
      const frac = (u % 6) / 6;
      const isRaised = frac >= 0.17 && frac < 0.67;
      const rad =
        rIdx === 2 || rIdx === 3
          ? isRaised
            ? outerR
            : outerR - ribDepth
          : rings[rIdx][1];
      positions.push(rings[rIdx][0], -Math.sin(angle) * rad, Math.cos(angle) * rad);
    }
  }

  for (let rIdx = 0; rIdx < rings.length - 1; rIdx++) {
    for (let u = 0; u < radialSteps; u++) {
      const a = rIdx * (radialSteps + 1) + u;
      const b = a + 1;
      const c = a + radialSteps + 1;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const nonIndexed = geo.toNonIndexed();
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}
