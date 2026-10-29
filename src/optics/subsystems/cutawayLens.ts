import * as THREE from 'three';
import {
  MATS,
  makeCanvasTexture,
  makeRoundedBox,
  makeRingTube,
  createLensElementGeometry,
  createGearGeometry,
  createRibbedBarrelGeometry,
  createOpticalGlassMaterial,
  createIrisMaterial,
} from '../proceduralMaterials';
import { OPTICAL_AXIS_Y, distToSlider } from '../opticalPhysics';

export interface CutawayLensController {
  group: THREE.Group;
  focusGroup: THREE.Group;
  frontBarrelGroup: THREE.Group;
  irisGroup: THREE.Group;
  helicoidGroup: THREE.Group;
  focusRingGroup: THREE.Group;
  interactiveMeshes: THREE.Object3D[];
  getFocusGroupX: () => number;
  getFrontElementX: () => number;
  update: (focusD: number, apertureN: number, isExploded: boolean, dt?: number) => void;
}

export function buildCutawayLens(scene: THREE.Scene): CutawayLensController {
  const lensRoot = new THREE.Group();
  lensRoot.name = 'CutawayLens';
  lensRoot.position.set(0, OPTICAL_AXIS_Y, 0);
  scene.add(lensRoot);

  const interactiveMeshes: THREE.Object3D[] = [];

  const glassRearBiconvex = createOpticalGlassMaterial('#9be8ff', 1.08, 0.75, 0.15);
  const glassRearMeniscus = createOpticalGlassMaterial('#8ee4ff', 1.18, 0.77, 0.55);
  const glassFocusLarge = createOpticalGlassMaterial('#80e5ff', 1.24, 0.78, 0.25);
  const glassFocusDoublet = createOpticalGlassMaterial('#9ef0ff', 1.3, 0.64, 0.75);
  const glassFrontCollector = createOpticalGlassMaterial('#8ae6ff', 1.26, 0.815, 0.35);

  // 1. Mounting Pedestals on the Optical Rail
  const pedestalsGroup = new THREE.Group();
  lensRoot.add(pedestalsGroup);

  const rearPedestal = new THREE.Mesh(
    makeRoundedBox(0.56, 0.42, 0.56, 0.03),
    MATS.anodizedBlack
  );
  rearPedestal.position.set(-2.12, -1.08, 0);
  rearPedestal.castShadow = true;
  pedestalsGroup.add(rearPedestal);

  const rearFoot = new THREE.Mesh(
    makeRoundedBox(0.68, 0.1, 0.68, 0.02),
    MATS.consoleDark
  );
  rearFoot.position.set(-2.12, -1.28, 0);
  pedestalsGroup.add(rearFoot);

  // Brushed Brass Nameplate Plaque (@NAYRBRYANGAMING)
  const plaqueTex = makeCanvasTexture(512, 192, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#e4b25c');
    grad.addColorStop(0.5, '#cc9540');
    grad.addColorStop(1, '#9e6e26');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#5c3c10';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.fillStyle = '#1f1404';
    ctx.font = '800 36px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('@NAYRBRYANGAMING', w / 2, 86);

    ctx.font = '500 30px "DM Mono", monospace';
    ctx.fillText('F = 50MM · 1:2', w / 2, 144);
  });

  const plaqueMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.18),
    new THREE.MeshStandardMaterial({
      map: plaqueTex,
      metalness: 0.86,
      roughness: 0.26,
    })
  );
  plaqueMesh.position.set(-2.12, -1.1, 0.285);
  plaqueMesh.userData = { interactiveType: 'x-profile' };
  pedestalsGroup.add(plaqueMesh);
  interactiveMeshes.push(plaqueMesh);

  const frontPedestal = new THREE.Mesh(
    makeRoundedBox(0.46, 0.36, 0.56, 0.03),
    MATS.anodizedBlack
  );
  frontPedestal.position.set(-0.92, -1.12, 0);
  frontPedestal.castShadow = true;
  pedestalsGroup.add(frontPedestal);

  const frontFoot = new THREE.Mesh(
    makeRoundedBox(0.58, 0.1, 0.68, 0.02),
    MATS.consoleDark
  );
  frontFoot.position.set(-0.92, -1.28, 0);
  pedestalsGroup.add(frontFoot);

  // 2. Rear Mount & Rear Brass Spur Gear
  const rearBayonet = makeRingTube(-2.76, -2.56, 0.58, 0.74, MATS.anodizedBlack);
  lensRoot.add(rearBayonet);

  const rearBrassGear = new THREE.Mesh(
    createGearGeometry(0.86, 1.0, 0.038, 56, 0.1),
    MATS.brushedBrass
  );
  rearBrassGear.position.x = -2.52;
  rearBrassGear.castShadow = true;
  lensRoot.add(rearBrassGear);

  const rearFlange = makeRingTube(-2.5, -2.38, 0.76, 0.96, MATS.anodizedBlack);
  lensRoot.add(rearFlange);

  // 3. Cutaway Structural Housing
  const backCutawayWall = makeRingTube(
    -2.42,
    -0.96,
    0.88,
    0.95,
    MATS.anodizedBlack,
    Math.PI * 0.62,
    Math.PI * 0.76
  );
  lensRoot.add(backCutawayWall);

  const brassEndCaps: { mesh: THREE.Mesh; baseY: number; signY: number }[] = [];
  for (const signY of [1, -1]) {
    const railBar = new THREE.Mesh(
      makeRoundedBox(1.52, 0.1, 0.24, 0.02),
      MATS.anodizedBlack
    );
    railBar.position.set(-1.68, signY * 0.92, 0);
    lensRoot.add(railBar);

    const rearCap = new THREE.Mesh(
      makeRoundedBox(0.28, 0.16, 0.3, 0.03),
      MATS.brushedBrass
    );
    rearCap.position.set(-2.32, signY * 0.95, 0);
    rearCap.castShadow = true;
    lensRoot.add(rearCap);
    brassEndCaps.push({ mesh: rearCap, baseY: signY * 0.95, signY });

    const frontCap = new THREE.Mesh(
      makeRoundedBox(0.28, 0.18, 0.32, 0.03),
      MATS.brushedBrass
    );
    frontCap.position.set(-1.04, signY * 0.96, 0);
    frontCap.castShadow = true;
    lensRoot.add(frontCap);
    brassEndCaps.push({ mesh: frontCap, baseY: signY * 0.96, signY });
  }

  // Animated Clamshell Doors & Locking Collar for Assembled vs Exploded
  const upperDoorGroup = new THREE.Group();
  lensRoot.add(upperDoorGroup);

  const upperDoorShell = makeRingTube(
    -2.42,
    -0.94,
    0.89,
    0.965,
    MATS.anodizedBlack,
    Math.PI * 1.36,
    Math.PI * 0.64
  );
  upperDoorShell.castShadow = true;
  upperDoorGroup.add(upperDoorShell);

  const upperDoorBrassLip = makeRingTube(
    -2.4,
    -0.95,
    0.892,
    0.972,
    MATS.brushedBrass,
    Math.PI * 1.975,
    Math.PI * 0.025
  );
  upperDoorGroup.add(upperDoorBrassLip);

  const lowerDoorGroup = new THREE.Group();
  lensRoot.add(lowerDoorGroup);

  const lowerDoorShell = makeRingTube(
    -2.42,
    -0.94,
    0.89,
    0.965,
    MATS.anodizedBlack,
    0,
    Math.PI * 0.64
  );
  lowerDoorShell.castShadow = true;
  lowerDoorGroup.add(lowerDoorShell);

  const lowerDoorBrassLip = makeRingTube(
    -2.4,
    -0.95,
    0.892,
    0.972,
    MATS.brushedBrass,
    0,
    Math.PI * 0.025
  );
  lowerDoorGroup.add(lowerDoorBrassLip);

  const lockingSleeveGroup = new THREE.Group();
  lensRoot.add(lockingSleeveGroup);

  const lockingCollarRing = makeRingTube(
    -1.74,
    -0.94,
    0.962,
    1.005,
    MATS.anodizedBlack,
    -Math.PI * 0.56,
    Math.PI * 1.12
  );
  lockingCollarRing.castShadow = true;
  lockingSleeveGroup.add(lockingCollarRing);

  const lockingBrassTrim = makeRingTube(
    -1.75,
    -1.71,
    0.964,
    1.012,
    MATS.brushedBrass,
    -Math.PI * 0.56,
    Math.PI * 1.12
  );
  lockingSleeveGroup.add(lockingBrassTrim);

  // 4. Rear Optical Glass Group
  const rearGroup = new THREE.Group();
  lensRoot.add(rearGroup);

  const el1Geo = createLensElementGeometry(0.75, 0.16, 2.8, 1.65);
  const el1Mesh = new THREE.Mesh(el1Geo, glassRearBiconvex);
  el1Mesh.position.x = -2.28;
  rearGroup.add(el1Mesh);

  const el1Holder = makeRingTube(-2.4, -2.2, 0.755, 0.865, MATS.anodizedBlack);
  rearGroup.add(el1Holder);

  const el2Geo = createLensElementGeometry(0.77, 0.18, 2.15, 3.2);
  const el2Mesh = new THREE.Mesh(el2Geo, glassRearMeniscus);
  el2Mesh.position.x = -1.87;
  rearGroup.add(el2Mesh);

  const el2Holder = makeRingTube(-1.97, -1.88, 0.775, 0.87, MATS.anodizedBlack);
  rearGroup.add(el2Holder);

  // 5. Central Brass Iris Ring & 7-Blade Polygon Aperture (x = -1.58)
  const irisX = -1.58;
  const irisGroup = new THREE.Group();
  irisGroup.position.x = irisX;
  lensRoot.add(irisGroup);

  const irisBrassRing = makeRingTube(-0.055, 0.055, 0.78, 0.875, MATS.brushedBrass);
  irisGroup.add(irisBrassRing);

  const lensIrisMat = createIrisMaterial('#1e222a');
  const lensIrisMesh = new THREE.Mesh(new THREE.CircleGeometry(0.79, 64), lensIrisMat);
  lensIrisMesh.rotation.y = Math.PI / 2;
  lensIrisMesh.userData = { interactiveType: 'lens-iris' };
  irisGroup.add(lensIrisMesh);
  interactiveMeshes.push(lensIrisMesh);

  // Warm internal golden point light near the brass aperture ring
  const irisWarmLight = new THREE.PointLight('#ffaa44', 1.4, 2.2, 1.5);
  irisWarmLight.position.set(0.08, 0.0, 0.35);
  irisGroup.add(irisWarmLight);

  // 6. Movable Internal Focus Group
  const focusGroup = new THREE.Group();
  focusGroup.position.x = -1.14;
  lensRoot.add(focusGroup);

  const el3Geo = createLensElementGeometry(0.78, 0.17, 1.48, -2.8);
  const el3Mesh = new THREE.Mesh(el3Geo, glassFocusLarge);
  el3Mesh.position.x = -0.105;
  focusGroup.add(el3Mesh);

  const el3Cell = makeRingTube(-0.2, -0.01, 0.785, 0.875, MATS.anodizedBlack);
  focusGroup.add(el3Cell);

  const el4Geo = createLensElementGeometry(0.64, 0.16, 2.8, 1.65);
  const el4Mesh = new THREE.Mesh(el4Geo, glassFocusDoublet);
  el4Mesh.position.x = 0.07;
  focusGroup.add(el4Mesh);

  for (const signY of [1, -1]) {
    const lug = new THREE.Mesh(
      makeRoundedBox(0.075, 0.055, 0.055, 0.014),
      MATS.gunmetal
    );
    lug.position.set(0.12, signY * 0.655, 0);
    focusGroup.add(lug);
  }

  const followerLug = new THREE.Mesh(
    makeRoundedBox(0.14, 0.12, 0.12, 0.02),
    MATS.gunmetal
  );
  followerLug.position.set(-0.1, 0.88, 0);
  focusGroup.add(followerLug);

  // 7. Main Brass Spur Gear Ring & Upper Helicoid Dual Pinion Gear Assembly
  const mainGearX = -0.82;
  const mainBrassGear = new THREE.Mesh(
    createGearGeometry(0.87, 1.01, 0.052, 60, 0.18),
    MATS.brushedBrass
  );
  mainBrassGear.position.x = mainGearX;
  mainBrassGear.castShadow = true;
  mainBrassGear.userData = { interactiveType: 'focus-ring' };
  lensRoot.add(mainBrassGear);
  interactiveMeshes.push(mainBrassGear);

  const mainGearCollar = makeRingTube(
    mainGearX - 0.11,
    mainGearX + 0.1,
    0.87,
    0.99,
    MATS.brushedBrass
  );
  lensRoot.add(mainGearCollar);

  const helicoidGroup = new THREE.Group();
  helicoidGroup.position.set(mainGearX - 0.04, 1.26, 0);
  lensRoot.add(helicoidGroup);

  const pinionGear = new THREE.Mesh(
    createGearGeometry(0.045, 0.185, 0.052, 14, 0.24),
    MATS.brushedBrass
  );
  pinionGear.castShadow = true;
  pinionGear.userData = { interactiveType: 'focus-ring' };
  helicoidGroup.add(pinionGear);
  interactiveMeshes.push(pinionGear);

  const pinionShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.48, 24),
    MATS.brushedSteel
  );
  pinionShaft.rotation.z = Math.PI / 2;
  helicoidGroup.add(pinionShaft);

  const pinionBracket = new THREE.Mesh(
    makeRoundedBox(0.065, 0.24, 0.09, 0.018),
    MATS.brushedBrass
  );
  pinionBracket.position.set(-0.17, 0.02, 0.04);
  pinionBracket.rotation.z = 0.22;
  helicoidGroup.add(pinionBracket);

  // 8. Wide Black Ribbed / Knurled Focus Ring Barrel
  const focusRingGroup = new THREE.Group();
  lensRoot.add(focusRingGroup);

  const focusRingBarrel = new THREE.Mesh(
    createRibbedBarrelGeometry(-0.72, 0.04, 0.88, 1.04, 58, 0.052),
    MATS.matteRubber
  );
  focusRingBarrel.castShadow = true;
  focusRingBarrel.receiveShadow = true;
  focusRingBarrel.userData = { interactiveType: 'focus-ring' };
  focusRingGroup.add(focusRingBarrel);
  interactiveMeshes.push(focusRingBarrel);

  const focusRingHitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.12, 1.12, 0.92, 24),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  focusRingHitMesh.rotation.z = Math.PI / 2;
  focusRingHitMesh.position.x = -0.34;
  focusRingHitMesh.userData = { interactiveType: 'focus-ring' };
  lensRoot.add(focusRingHitMesh);
  interactiveMeshes.push(focusRingHitMesh);

  // 9. Telescoping Front Barrel Nose & Front Collector Glass Element
  const frontBarrelGroup = new THREE.Group();
  lensRoot.add(frontBarrelGroup);

  const innerTelescopingTube = makeRingTube(-0.22, 0.05, 0.78, 0.875, MATS.anodizedBlack);
  frontBarrelGroup.add(innerTelescopingTube);

  const frontShoulder = makeRingTube(0.04, 0.17, 0.78, 0.935, MATS.anodizedBlack);
  frontShoulder.castShadow = true;
  frontBarrelGroup.add(frontShoulder);

  const indexMark = new THREE.Mesh(
    makeRoundedBox(0.032, 0.105, 0.02, 0.006),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.65) })
  );
  indexMark.position.set(0.115, -0.05, 0.938);
  frontBarrelGroup.add(indexMark);

  const frontNoseBarrel = makeRingTube(0.17, 0.37, 0.76, 0.855, MATS.anodizedBlack);
  frontNoseBarrel.castShadow = true;
  frontBarrelGroup.add(frontNoseBarrel);

  const frontInnerSeat = makeRingTube(0.36, 0.47, 0.7, 0.765, MATS.anodizedBlack);
  frontBarrelGroup.add(frontInnerSeat);

  const frontGlassGeo = createLensElementGeometry(0.815, 0.09, 2.8, 1.35);
  const frontGlassMesh = new THREE.Mesh(frontGlassGeo, glassFrontCollector);
  frontGlassMesh.position.x = 0.41;
  frontBarrelGroup.add(frontGlassMesh);

  let currentExploded = 1.0;
  let irisGlowPulse = 0;
  let prevAperture = 16;

  function update(focusD: number, apertureN: number, isExploded: boolean, dt = 0.016) {
    const sliderT = distToSlider(focusD);

    const targetFocusGroupX = -0.92 - sliderT * 0.4;
    focusGroup.position.x += (targetFocusGroupX - focusGroup.position.x) * 0.28;

    const targetFrontBarrelX = (0.5 - sliderT) * 0.22;
    frontBarrelGroup.position.x += (targetFrontBarrelX - frontBarrelGroup.position.x) * 0.28;

    const ringAngle = (sliderT - 0.5) * Math.PI * 1.45;
    focusRingGroup.rotation.x = ringAngle;
    mainBrassGear.rotation.x = ringAngle;
    rearBrassGear.rotation.x = ringAngle * 0.6;
    pinionGear.rotation.x = -ringAngle * (64 / 16);

    if (Math.abs(apertureN - prevAperture) > 0.01) {
      irisGlowPulse = 1.0;
      prevAperture = apertureN;
    }
    irisGlowPulse = Math.max(0, irisGlowPulse - dt * 2.2);

    const apNorm = Math.pow(2 / apertureN, 0.82);
    const openRadius = 0.13 + apNorm * 0.64;
    lensIrisMat.userData.uniforms.uAp.value = openRadius;
    lensIrisMat.userData.uniforms.uRot.value = (1 - apNorm) * 0.62;
    lensIrisMat.userData.uniforms.uGlow.value = irisGlowPulse;

    const targetExploded = isExploded ? 1.0 : 0.0;
    const step = Math.min(1, dt * 8.5);
    currentExploded += (targetExploded - currentExploded) * step;

    const doorOpenT = Math.min(1, currentExploded * 1.22);
    const doorEase = doorOpenT * doorOpenT * (3 - 2 * doorOpenT);
    upperDoorGroup.rotation.x = -doorEase * Math.PI * 0.74;
    lowerDoorGroup.rotation.x = doorEase * Math.PI * 0.74;
    upperDoorGroup.visible = currentExploded < 0.985;
    lowerDoorGroup.visible = currentExploded < 0.985;

    const sleeveT = Math.max(0, Math.min(1, (currentExploded - 0.08) / 0.78));
    const sleeveEase = sleeveT * sleeveT * (3 - 2 * sleeveT);
    lockingSleeveGroup.position.x = sleeveEase * 0.56;
    const radialTuck = 1.0 - sleeveEase * 0.08;
    lockingSleeveGroup.scale.set(1, radialTuck, radialTuck);
    lockingSleeveGroup.visible = currentExploded < 0.94;

    helicoidGroup.position.y = 1.13 + currentExploded * 0.13;
    const clampOffset = (1.0 - currentExploded) * 0.032;
    for (const cap of brassEndCaps) {
      cap.mesh.position.y = cap.baseY - cap.signY * clampOffset;
    }
  }

  return {
    group: lensRoot,
    focusGroup,
    frontBarrelGroup,
    irisGroup,
    helicoidGroup,
    focusRingGroup,
    interactiveMeshes,
    getFocusGroupX: () => focusGroup.position.x,
    getFrontElementX: () => 0.45 + frontBarrelGroup.position.x,
    update,
  };
}
