import * as THREE from 'three';

export interface StudioMaterials {
  envMap: THREE.Texture;
  machinedBrass: THREE.MeshStandardMaterial;
  agedBrassDark: THREE.MeshStandardMaterial;
  copperGoldIris: THREE.MeshStandardMaterial;
  anodizedBlack: THREE.MeshStandardMaterial;
  ribbedGripBlack: THREE.MeshStandardMaterial;
  cutawayInteriorBlack: THREE.MeshStandardMaterial;
  steelRail: THREE.MeshStandardMaterial;
  opticalGlassCyan: THREE.MeshPhysicalMaterial;
  opticalGlassWarm: THREE.MeshPhysicalMaterial;
  opticalGlassCrystal: THREE.MeshPhysicalMaterial;
  frostedGlassEdge: THREE.MeshStandardMaterial;
  causticDiscCyan: THREE.MeshBasicMaterial;
  causticDiscWarm: THREE.MeshBasicMaterial;
  groundGlassScreen: THREE.MeshPhysicalMaterial;
  plaqueMaterial: THREE.MeshStandardMaterial;
  rulerTopMaterial: THREE.MeshStandardMaterial;
  focusScaleMaterial: THREE.MeshStandardMaterial;
}

export function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const baseGrad = ctx.createLinearGradient(0, 0, 0, 512);
  baseGrad.addColorStop(0.0, '#0d131c');
  baseGrad.addColorStop(0.32, '#1a2535');
  baseGrad.addColorStop(0.5, '#0e131b');
  baseGrad.addColorStop(0.75, '#16110b');
  baseGrad.addColorStop(1.0, '#050608');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Warm overhead softbox for rich gold/brass reflections
  const warmSoftbox = ctx.createRadialGradient(460, 90, 12, 460, 90, 310);
  warmSoftbox.addColorStop(0.0, 'rgba(255, 240, 200, 1.0)');
  warmSoftbox.addColorStop(0.3, 'rgba(245, 195, 110, 0.65)');
  warmSoftbox.addColorStop(0.7, 'rgba(185, 128, 52, 0.18)');
  warmSoftbox.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = warmSoftbox;
  ctx.fillRect(0, 0, 1024, 512);

  // Bright daylight window softbox on the right
  const rightWindowLight = ctx.createRadialGradient(860, 210, 15, 860, 210, 260);
  rightWindowLight.addColorStop(0.0, 'rgba(230, 250, 255, 1.0)');
  rightWindowLight.addColorStop(0.35, 'rgba(135, 215, 255, 0.55)');
  rightWindowLight.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rightWindowLight;
  ctx.fillRect(0, 0, 1024, 512);

  // High-contrast studio specular strips
  ctx.fillStyle = 'rgba(255, 250, 235, 0.92)';
  ctx.fillRect(160, 52, 320, 16);
  ctx.fillStyle = 'rgba(175, 235, 255, 0.85)';
  ctx.fillRect(610, 105, 240, 12);
  ctx.fillStyle = 'rgba(250, 195, 100, 0.72)';
  ctx.fillRect(280, 330, 410, 10);

  const equirectTex = new THREE.CanvasTexture(canvas);
  equirectTex.mapping = THREE.EquirectangularReflectionMapping;
  equirectTex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(equirectTex).texture;
  equirectTex.dispose();
  pmrem.dispose();

  return envMap;
}

function createRadialCausticTexture(mode: 'cyan' | 'warm'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(256, 256, 4, 256, 256, 250);
  if (mode === 'cyan') {
    grad.addColorStop(0.0, 'rgba(245, 253, 255, 0.72)');
    grad.addColorStop(0.18, 'rgba(175, 232, 255, 0.38)');
    grad.addColorStop(0.55, 'rgba(95, 175, 225, 0.10)');
    grad.addColorStop(0.86, 'rgba(130, 205, 245, 0.08)');
    grad.addColorStop(0.96, 'rgba(220, 248, 255, 0.55)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  } else {
    grad.addColorStop(0.0, 'rgba(255, 242, 210, 0.58)');
    grad.addColorStop(0.22, 'rgba(255, 195, 105, 0.34)');
    grad.addColorStop(0.65, 'rgba(180, 115, 38, 0.08)');
    grad.addColorStop(0.94, 'rgba(255, 215, 140, 0.48)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBrushedMetalBumpMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 1800; i++) {
    const y = Math.random() * 512;
    const lum = 104 + Math.floor(Math.random() * 50);
    ctx.strokeStyle = `rgb(${lum},${lum},${lum})`;
    ctx.lineWidth = Math.random() * 1.3 + 0.3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (Math.random() - 0.5) * 1.8);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function createPlaqueTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 220;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 220);
  grad.addColorStop(0.0, '#cfa044');
  grad.addColorStop(0.5, '#ecc570');
  grad.addColorStop(1.0, '#a87b27');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 220);

  ctx.strokeStyle = '#241a08';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 484, 192);

  ctx.fillStyle = '#161004';
  ctx.font = '700 46px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('@RYANSAEL', 256, 92);

  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#2d200a';
  ctx.fillText('FIG. II  ·  50MM F/2', 256, 148);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createOpticalRailScaleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#12151b';
  ctx.fillRect(0, 0, 2048, 256);

  const totalTicks = 180;
  const margin = 36;
  const usableWidth = 2048 - margin * 2;

  ctx.strokeStyle = 'rgba(235, 242, 252, 0.85)';
  ctx.fillStyle = 'rgba(220, 230, 242, 0.78)';
  ctx.font = '600 19px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';

  for (let i = 0; i <= totalTicks; i++) {
    const x = margin + (i / totalTicks) * usableWidth;
    const isMajor = i % 10 === 0;
    const isMedium = i % 5 === 0 && !isMajor;

    const tickHeight = isMajor ? 62 : isMedium ? 40 : 24;
    ctx.lineWidth = isMajor ? 2.6 : 1.4;

    ctx.beginPath();
    ctx.moveTo(x, 256);
    ctx.lineTo(x, 256 - tickHeight);
    ctx.stroke();

    if (isMajor) {
      const cmValue = i / 2;
      ctx.fillText(`${cmValue}`, x, 256 - tickHeight - 16);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createFocusRingScaleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#14171c';
  ctx.fillRect(0, 0, 1024, 256);

  const stops = ['0.35', '0.4', '0.5', '0.54', '0.7', '0.9', '1.2', '2.0', '∞'];
  ctx.font = '600 24px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';

  stops.forEach((label, idx) => {
    const x = 80 + (idx / (stops.length - 1)) * 864;
    ctx.fillStyle = label === '0.54' ? '#d4a853' : '#d8e0ec';
    ctx.fillText(label, x, 110);

    ctx.strokeStyle = label === '0.54' ? '#d4a853' : 'rgba(216, 224, 236, 0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 140);
    ctx.lineTo(x, 195);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createStudioMaterials(renderer: THREE.WebGLRenderer): StudioMaterials {
  const envMap = createStudioEnvironment(renderer);
  const bumpMap = createBrushedMetalBumpMap();

  const machinedBrass = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dba94c'),
    metalness: 0.92,
    roughness: 0.2,
    bumpMap,
    bumpScale: 0.004,
    envMap,
    envMapIntensity: 1.65,
  });

  const agedBrassDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9e7327'),
    metalness: 0.88,
    roughness: 0.3,
    bumpMap,
    bumpScale: 0.005,
    envMap,
    envMapIntensity: 1.3,
  });

  const copperGoldIris = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e8a33e'),
    metalness: 0.9,
    roughness: 0.2,
    emissive: new THREE.Color('#784508'),
    emissiveIntensity: 0.42,
    envMap,
    envMapIntensity: 1.8,
  });

  const anodizedBlack = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#171a20'),
    metalness: 0.76,
    roughness: 0.3,
    bumpMap,
    bumpScale: 0.003,
    envMap,
    envMapIntensity: 1.2,
  });

  const ribbedGripBlack = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0f1115'),
    metalness: 0.45,
    roughness: 0.44,
    envMap,
    envMapIntensity: 0.95,
  });

  const cutawayInteriorBlack = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#191d25'),
    metalness: 0.58,
    roughness: 0.4,
    side: THREE.DoubleSide,
    envMap,
    envMapIntensity: 1.0,
  });

  const steelRail = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#15181f'),
    metalness: 0.82,
    roughness: 0.28,
    envMap,
    envMapIntensity: 1.15,
  });

  const opticalGlassCyan = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d4f0ff'),
    emissive: new THREE.Color('#2c6d91'),
    emissiveIntensity: 0.26,
    metalness: 0.0,
    roughness: 0.03,
    transmission: 0.93,
    ior: 1.62,
    thickness: 0.9,
    specularIntensity: 1.0,
    specularColor: new THREE.Color('#a8ecff'),
    envMap,
    envMapIntensity: 2.0,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
  });

  const opticalGlassWarm = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffebd0'),
    emissive: new THREE.Color('#754a12'),
    emissiveIntensity: 0.26,
    metalness: 0.0,
    roughness: 0.04,
    transmission: 0.91,
    ior: 1.68,
    thickness: 0.75,
    specularIntensity: 1.0,
    specularColor: new THREE.Color('#ffd694'),
    envMap,
    envMapIntensity: 1.85,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });

  const opticalGlassCrystal = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e8f8ff'),
    emissive: new THREE.Color('#66b5e3'),
    emissiveIntensity: 0.38,
    metalness: 0.0,
    roughness: 0.025,
    transmission: 0.95,
    ior: 1.58,
    thickness: 1.0,
    specularIntensity: 1.0,
    specularColor: new THREE.Color('#ffffff'),
    envMap,
    envMapIntensity: 2.2,
    transparent: true,
    opacity: 0.97,
    side: THREE.DoubleSide,
  });

  const frostedGlassEdge = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8ecff'),
    emissive: new THREE.Color('#62b3e0'),
    emissiveIntensity: 0.58,
    metalness: 0.1,
    roughness: 0.38,
    transparent: true,
    opacity: 0.88,
  });

  const causticDiscCyan = new THREE.MeshBasicMaterial({
    map: createRadialCausticTexture('cyan'),
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const causticDiscWarm = new THREE.MeshBasicMaterial({
    map: createRadialCausticTexture('warm'),
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const groundGlassScreen = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d2e4f4'),
    emissive: new THREE.Color('#273b4f'),
    emissiveIntensity: 0.28,
    metalness: 0.0,
    roughness: 0.36,
    transmission: 0.68,
    thickness: 0.2,
    envMap,
    envMapIntensity: 1.1,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });

  const plaqueMaterial = new THREE.MeshStandardMaterial({
    map: createPlaqueTexture(),
    metalness: 0.85,
    roughness: 0.25,
    envMap,
    envMapIntensity: 1.4,
  });

  const rulerTopMaterial = new THREE.MeshStandardMaterial({
    map: createOpticalRailScaleTexture(),
    metalness: 0.74,
    roughness: 0.3,
    envMap,
    envMapIntensity: 1.15,
  });

  const focusScaleMaterial = new THREE.MeshStandardMaterial({
    map: createFocusRingScaleTexture(),
    metalness: 0.68,
    roughness: 0.34,
    envMap,
    envMapIntensity: 1.15,
  });

  return {
    envMap,
    machinedBrass,
    agedBrassDark,
    copperGoldIris,
    anodizedBlack,
    ribbedGripBlack,
    cutawayInteriorBlack,
    steelRail,
    opticalGlassCyan,
    opticalGlassWarm,
    opticalGlassCrystal,
    frostedGlassEdge,
    causticDiscCyan,
    causticDiscWarm,
    groundGlassScreen,
    plaqueMaterial,
    rulerTopMaterial,
    focusScaleMaterial,
  };
}
