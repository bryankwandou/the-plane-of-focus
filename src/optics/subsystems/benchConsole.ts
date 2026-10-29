import * as THREE from 'three';
import {
  APERTURE_PRESETS,
  SUBJECTS,
  distToSlider,
  lerp,
  clamp,
} from '../opticalPhysics';
import {
  createGearGeometry,
  createIrisMaterial,
} from '../proceduralMaterials';

export interface BenchConsoleSubsystem {
  group: THREE.Group;
  railThumbGear: THREE.Mesh;
  sliderKnob: THREE.Mesh;
  sliderTrackCollider: THREE.Mesh;
  filmstripThumbs: THREE.Mesh[];
  apertureDials: THREE.Mesh[];
  irisClickTarget: THREE.Mesh;
  updateConsole: (focusD: number, apertureN: number) => void;
}

function createRulerStripTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#15181e';
  ctx.fillRect(0, 0, 2048, 128);

  // Subtle metallic top & bottom rule lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(2048, 12);
  ctx.stroke();

  // High-contrast millimeter & centimeter tick marks matching the bottom ruler in the screenshot
  const totalTicks = 240;
  for (let i = 0; i <= totalTicks; i++) {
    const x = (i / totalTicks) * 2048;
    const isMajor = i % 10 === 0;
    const isMid = i % 5 === 0 && !isMajor;
    const h = isMajor ? 56 : isMid ? 38 : 22;

    ctx.strokeStyle = isMajor
      ? 'rgba(248, 250, 255, 0.92)'
      : isMid
      ? 'rgba(220, 228, 240, 0.72)'
      : 'rgba(180, 190, 208, 0.48)';
    ctx.lineWidth = isMajor ? 3 : 1.8;
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, 12 + h);
    ctx.stroke();

    if (isMajor && i > 0 && i < totalTicks) {
      ctx.fillStyle = 'rgba(235, 240, 248, 0.85)';
      ctx.font = '600 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${i}`, x, 96);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createFilmstripThumbnailTexture(index: number, total: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 110;
  const ctx = c.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, 110);
  g.addColorStop(0, '#2a4663');
  g.addColorStop(0.65, '#3b6742');
  g.addColorStop(1, '#263f28');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 160, 110);

  // Mountain silhouette
  ctx.fillStyle = '#536778';
  ctx.beginPath();
  ctx.moveTo(75, 82);
  ctx.lineTo(118, 26);
  ctx.lineTo(155, 82);
  ctx.closePath();
  ctx.fill();

  // Cabin
  ctx.fillStyle = '#9e6b3b';
  ctx.fillRect(62, 56, 32, 24);
  ctx.fillStyle = '#ffda78';
  ctx.fillRect(72, 62, 8, 8);

  // Foreground Pine
  ctx.fillStyle = '#2d7536';
  ctx.beginPath();
  ctx.moveTo(32, 34);
  ctx.lineTo(14, 82);
  ctx.lineTo(50, 82);
  ctx.closePath();
  ctx.fill();

  // Highlight bar showing which depth plane this preset corresponds to
  const t = index / (total - 1);
  ctx.fillStyle = 'rgba(130, 242, 255, 0.85)';
  ctx.fillRect(10 + t * 120, 96, 20, 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildBenchConsole(mats: {
  darkAnodized: THREE.Material;
  gunmetal: THREE.Material;
  brushedBrass: THREE.Material;
  brightBrass: THREE.Material;
  chrome: THREE.Material;
}): BenchConsoleSubsystem {
  const group = new THREE.Group();

  // 1. Main Heavy Optical Bench Bed (X = -5.6 to +5.6, Y = 1.92, Z = -1.9 to +1.9)
  const bedWidthX = 11.4;
  const bedHeightY = 0.24;
  const bedDepthZ = 2.65;

  const benchBed = new THREE.Mesh(
    new THREE.BoxGeometry(bedWidthX, bedHeightY, bedDepthZ),
    mats.darkAnodized
  );
  benchBed.position.set(0.1, 1.94, 0.0);
  benchBed.receiveShadow = true;
  benchBed.castShadow = true;
  group.add(benchBed);

  // Precision steel dovetail guideways along the bench top
  const railGeo = new THREE.BoxGeometry(bedWidthX - 0.3, 0.05, 0.14);
  [-0.56, 0.56].forEach((rz) => {
    const rail = new THREE.Mesh(railGeo, mats.gunmetal);
    rail.position.set(0.1, 2.08, rz);
    rail.receiveShadow = true;
    group.add(rail);
  });

  // 2. Front Metric Ruler Strip (prominently visible across the bottom of the Hero Lens view!)
  const rulerTex = createRulerStripTexture();
  const rulerMat = new THREE.MeshStandardMaterial({
    map: rulerTex,
    roughness: 0.42,
    metalness: 0.25,
  });

  // Slightly angled beveled ruler plate at z = 1.15, y = 2.04 so it faces the Hero Camera cleanly
  const rulerPlate = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, 0.06, 0.24),
    rulerMat
  );
  rulerPlate.position.set(0.1, 2.055, 1.12);
  rulerPlate.rotation.x = 0.32;
  rulerPlate.receiveShadow = true;
  group.add(rulerPlate);

  // 3. Interactive Brass Rail Focus Thumbwheel Knob at the bottom center of the Hero Lens view!
  const thumbGroup = new THREE.Group();
  thumbGroup.position.set(-0.82, 1.98, 1.26);

  const thumbBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.18, 0.22),
    mats.darkAnodized
  );
  thumbBracket.position.set(0, 0.02, -0.08);
  thumbGroup.add(thumbBracket);

  const thumbGearGeo = createGearGeometry(0.18, 0.22, 0.14, 40, 0.16);
  const railThumbGear = new THREE.Mesh(thumbGearGeo, mats.brightBrass);
  railThumbGear.rotation.y = Math.PI / 2;
  railThumbGear.position.set(0, 0.02, 0.06);
  railThumbGear.castShadow = true;
  railThumbGear.userData = { type: 'focusRing' };
  thumbGroup.add(railThumbGear);

  // Inner beveled spun-brass knob face facing the viewer
  const thumbCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.185, 0.15, 36),
    mats.brushedBrass
  );
  thumbCap.rotation.x = Math.PI / 2;
  thumbCap.position.copy(railThumbGear.position);
  thumbCap.userData = { type: 'focusRing' };
  thumbGroup.add(thumbCap);

  group.add(thumbGroup);

  // 4. Lower Optical Bench Pedestal Console (visible in Overview camera preset)
  const consoleBase = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 1.72, 2.45),
    mats.gunmetal
  );
  consoleBase.position.set(0.1, 0.96, 0.0);
  consoleBase.receiveShadow = true;
  consoleBase.castShadow = true;
  group.add(consoleBase);

  // Sloped front control deck on the console
  const deckGroup = new THREE.Group();
  deckGroup.position.set(0.1, 1.42, 1.26);
  deckGroup.rotation.x = -0.35;
  group.add(deckGroup);

  const deckPlate = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 0.72, 0.12),
    mats.darkAnodized
  );
  deckGroup.add(deckPlate);

  // Left: Live 7-blade Iris Gauge on the console
  const consoleIrisMat = createIrisMaterial();
  const consoleIrisMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.48),
    consoleIrisMat
  );
  consoleIrisMesh.position.set(-2.65, 0.02, 0.07);
  consoleIrisMesh.userData = { type: 'irisToggle' };
  deckGroup.add(consoleIrisMesh);

  const irisClickTarget = consoleIrisMesh;

  // Center: 5 Interactive Filmstrip Screens + 3D Slider Bar
  const filmstripThumbs: THREE.Mesh[] = [];
  const sampleDistances = [
    1.35,
    SUBJECTS[0].d,
    SUBJECTS[1].d,
    3.0,
    SUBJECTS[2].d,
  ];
  sampleDistances.forEach((dVal, idx) => {
    const tex = createFilmstripThumbnailTexture(idx, sampleDistances.length);
    const thumbMat = new THREE.MeshBasicMaterial({ map: tex });
    const thumbMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), thumbMat);
    thumbMesh.position.set(-1.35 + idx * 0.68, 0.10, 0.07);
    thumbMesh.userData = { type: 'filmstrip', focusD: dVal };
    deckGroup.add(thumbMesh);
    filmstripThumbs.push(thumbMesh);
  });

  // 3D Slider Track below the filmstrip
  const sliderTrack = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.04, 0.04),
    mats.chrome
  );
  sliderTrack.position.set(0.0, -0.20, 0.07);
  deckGroup.add(sliderTrack);

  const sliderTrackCollider = new THREE.Mesh(
    new THREE.BoxGeometry(3.3, 0.24, 0.15),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  sliderTrackCollider.position.copy(sliderTrack.position);
  sliderTrackCollider.userData = { type: 'consoleSlider' };
  deckGroup.add(sliderTrackCollider);

  const sliderKnob = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.16, 0.10),
    mats.brightBrass
  );
  sliderKnob.position.set(0.0, -0.20, 0.10);
  sliderKnob.userData = { type: 'consoleSlider' };
  deckGroup.add(sliderKnob);

  // Right: 3 Interactive Aperture Dials (f/2, f/5.6, f/16)
  const apertureDials: THREE.Mesh[] = [];
  APERTURE_PRESETS.forEach((apVal, idx) => {
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.08, 28),
      mats.brushedBrass
    );
    dial.rotation.x = Math.PI / 2;
    dial.position.set(2.15 + idx * 0.52, 0.02, 0.08);
    dial.userData = { type: 'apertureDial', apertureN: apVal };
    deckGroup.add(dial);
    apertureDials.push(dial);
  });

  const updateConsole = (focusD: number, apertureN: number) => {
    const t = distToSlider(focusD);
    sliderKnob.position.x = lerp(-1.55, 1.55, t);
    railThumbGear.rotation.x = t * Math.PI * 3.2;

    const openFrac = clamp(Math.pow(2.0 / apertureN, 0.72), 0.16, 0.92);
    if (consoleIrisMat.userData.uniforms) {
      consoleIrisMat.userData.uniforms.uAp.value = openFrac * 0.65;
    }
  };

  return {
    group,
    railThumbGear,
    sliderKnob,
    sliderTrackCollider,
    filmstripThumbs,
    apertureDials,
    irisClickTarget,
    updateConsole,
  };
}
