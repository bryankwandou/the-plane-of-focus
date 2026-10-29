import * as THREE from 'three';
import { StudioMaterials } from './proceduralMaterials';
import { OpticalTelemetry } from './opticalPhysics';

export interface CalloutAnchor {
  id: string;
  label: string;
  anchorWorld: THREE.Vector3;
  offsetScreen: { dx: number; dy: number };
  align: 'left' | 'right';
}

export interface OpticalBenchSceneController {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  focusRingGroup: THREE.Group;
  VernierKnobGroup: THREE.Group;
  updateFromTelemetry: (
    telemetry: OpticalTelemetry,
    assemblyMode: 'assembled' | 'exploded',
    dt: number
  ) => void;
  getCalloutAnchors: () => CalloutAnchor[];
  dispose: () => void;
}

function createOpticalLensMesh(
  radius: number,
  edgeThickness: number,
  frontBulge: number,
  backBulge: number,
  glassMaterial: THREE.Material,
  edgeMaterial: THREE.Material,
  causticMaterial: THREE.Material
): THREE.Group {
  const group = new THREE.Group();

  const radialSteps = 28;
  const points: THREE.Vector2[] = [];

  for (let i = 0; i <= radialSteps; i++) {
    const t = i / radialSteps;
    const r = t * radius;
    const sagFront = frontBulge * (1 - t * t);
    const axialPos = edgeThickness * 0.5 + sagFront;
    points.push(new THREE.Vector2(r, axialPos));
  }

  points.push(new THREE.Vector2(radius, -edgeThickness * 0.5));

  for (let i = radialSteps; i >= 0; i--) {
    const t = i / radialSteps;
    const r = t * radius;
    const sagBack = backBulge * (1 - t * t);
    const axialPos = -edgeThickness * 0.5 - sagBack;
    points.push(new THREE.Vector2(r, axialPos));
  }

  const latheGeo = new THREE.LatheGeometry(points, 72);
  latheGeo.rotateZ(-Math.PI / 2);
  latheGeo.computeVertexNormals();

  const lensMesh = new THREE.Mesh(latheGeo, glassMaterial);
  group.add(lensMesh);

  // Frosted ground-glass outer edge cylinder
  const rimGeo = new THREE.CylinderGeometry(
    radius * 1.002,
    radius * 1.002,
    edgeThickness,
    72,
    1,
    true
  );
  rimGeo.rotateZ(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, edgeMaterial);
  group.add(rimMesh);

  // Internal radial caustic glow disc (gives the unmistakable glowing optical glass look in the screenshot)
  const causticGeo = new THREE.CircleGeometry(radius * 0.98, 64);
  causticGeo.rotateY(Math.PI / 2);
  const causticDisc = new THREE.Mesh(causticGeo, causticMaterial);
  group.add(causticDisc);

  // Crisp glowing front & rear rim arcs
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xe6f8ff,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
  });
  const frontRingGeo = new THREE.TorusGeometry(radius * 0.985, 0.013, 12, 72);
  frontRingGeo.rotateY(Math.PI / 2);
  const frontRing = new THREE.Mesh(frontRingGeo, ringMat);
  frontRing.position.x = edgeThickness * 0.48;
  group.add(frontRing);

  const backRing = new THREE.Mesh(frontRingGeo, ringMat);
  backRing.position.x = -edgeThickness * 0.48;
  group.add(backRing);

  return group;
}

function createBrassGearRing(
  outerRadius: number,
  innerRadius: number,
  width: number,
  toothCount: number,
  toothHeight: number,
  brassMat: THREE.Material,
  darkBrassMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();

  const ringShape = new THREE.Shape();
  ringShape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  ringShape.holes.push(holePath);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: width,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.015,
    bevelThickness: 0.015,
    curveSegments: 72,
  };

  const bodyGeo = new THREE.ExtrudeGeometry(ringShape, extrudeSettings);
  bodyGeo.translate(0, 0, -width * 0.5);
  bodyGeo.rotateY(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, brassMat);
  group.add(bodyMesh);

  const toothDepth = (Math.PI * outerRadius) / toothCount;
  const toothGeo = new THREE.BoxGeometry(width * 0.92, toothHeight, toothDepth * 0.85);
  const teethInstanced = new THREE.InstancedMesh(toothGeo, brassMat, toothCount);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < toothCount; i++) {
    const angle = (i / toothCount) * Math.PI * 2;
    const r = outerRadius + toothHeight * 0.42;
    dummy.position.set(0, Math.cos(angle) * r, Math.sin(angle) * r);
    dummy.rotation.set(-angle, 0, 0);
    dummy.updateMatrix();
    teethInstanced.setMatrixAt(i, dummy.matrix);
  }
  teethInstanced.instanceMatrix.needsUpdate = true;
  group.add(teethInstanced);

  const grooveGeo = new THREE.CylinderGeometry(
    outerRadius * 0.97,
    outerRadius * 0.97,
    width * 1.03,
    64,
    1,
    true
  );
  grooveGeo.rotateZ(Math.PI / 2);
  const grooveMesh = new THREE.Mesh(grooveGeo, darkBrassMat);
  group.add(grooveMesh);

  return group;
}

export function buildOpticalBenchScene(
  renderer: THREE.WebGLRenderer,
  materials: StudioMaterials
): OpticalBenchSceneController {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#090b0f');
  scene.environment = materials.envMap;
  scene.fog = new THREE.FogExp2('#090b0f', 0.028);

  const camera = new THREE.PerspectiveCamera(26.5, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(-0.12, 0.3, 9.05);
  camera.lookAt(0.06, -0.06, 0);

  // --- STUDIO LIGHTING SETUP ---
  const ambientLight = new THREE.AmbientLight(0xd6e4f5, 0.72);
  scene.add(ambientLight);

  const warmKeyLight = new THREE.DirectionalLight(0xffe1ad, 3.4);
  warmKeyLight.position.set(1.5, 6.5, 4.8);
  scene.add(warmKeyLight);

  const coolRimLight = new THREE.DirectionalLight(0x90d8ff, 2.8);
  coolRimLight.position.set(5.5, 3.0, -3.5);
  scene.add(coolRimLight);

  // Warm golden amber glow right at the central brass aperture ring
  const internalAmberLight = new THREE.PointLight(0xffa838, 4.2, 3.6, 1.5);
  internalAmberLight.position.set(-0.58, 0.05, 0.42);
  scene.add(internalAmberLight);

  // Intense ice-white optical caustic core light inside the right glass elements
  const internalCyanLight = new THREE.PointLight(0xc8f2ff, 4.8, 3.4, 1.4);
  internalCyanLight.position.set(0.22, 0.0, 0.32);
  scene.add(internalCyanLight);

  const frontFillLight = new THREE.DirectionalLight(0xffebd2, 1.45);
  frontFillLight.position.set(-2.5, -1.2, 6.2);
  scene.add(frontFillLight);

  // --- OPTICAL BENCH RAIL, RULER & BRASS VERNIER KNOB ---
  const benchGroup = new THREE.Group();
  scene.add(benchGroup);

  const benchSlabGeo = new THREE.BoxGeometry(16, 0.55, 4.8);
  const benchSlab = new THREE.Mesh(benchSlabGeo, materials.steelRail);
  benchSlab.position.set(0, -2.08, -0.35);
  benchGroup.add(benchSlab);

  const rulerStripGeo = new THREE.BoxGeometry(12.2, 0.06, 0.58);
  const rulerStrip = new THREE.Mesh(rulerStripGeo, materials.rulerTopMaterial);
  rulerStrip.position.set(0.1, -1.77, 1.26);
  rulerStrip.rotation.x = 0.22;
  benchGroup.add(rulerStrip);

  const brassTrimGeo = new THREE.BoxGeometry(12.2, 0.038, 0.055);
  const brassTrim = new THREE.Mesh(brassTrimGeo, materials.machinedBrass);
  brassTrim.position.set(0.1, -1.85, 1.54);
  benchGroup.add(brassTrim);

  // Foreground Knurled Brass Vernier Focus Knob
  const vernierKnobGroup = new THREE.Group();
  vernierKnobGroup.position.set(-0.28, -1.84, 1.65);
  benchGroup.add(vernierKnobGroup);

  const knobMain = createBrassGearRing(
    0.27,
    0.05,
    0.35,
    40,
    0.016,
    materials.machinedBrass,
    materials.agedBrassDark
  );
  knobMain.rotation.z = Math.PI / 2;
  vernierKnobGroup.add(knobMain);

  const knobCapGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.37, 48);
  const knobCap = new THREE.Mesh(knobCapGeo, materials.machinedBrass);
  vernierKnobGroup.add(knobCap);

  // --- LEFT SIDE: GROUND GLASS SENSOR PLANE ---
  const sensorPlaneGroup = new THREE.Group();
  sensorPlaneGroup.position.set(-3.85, 0.0, 0);
  scene.add(sensorPlaneGroup);

  const glassSheetGeo = new THREE.BoxGeometry(0.04, 2.4, 2.6);
  const glassSheet = new THREE.Mesh(glassSheetGeo, materials.groundGlassScreen);
  sensorPlaneGroup.add(glassSheet);

  // --- PEDESTALS & @RYANSAEL ENGRAVED BRASS PLAQUE ---
  const supportsGroup = new THREE.Group();
  scene.add(supportsGroup);

  const leftPedestalGeo = new THREE.BoxGeometry(0.84, 0.56, 0.96);
  const leftPedestal = new THREE.Mesh(leftPedestalGeo, materials.anodizedBlack);
  leftPedestal.position.set(-1.72, -1.58, 0.15);
  supportsGroup.add(leftPedestal);

  const leftCradleGeo = new THREE.BoxGeometry(0.68, 0.25, 0.86);
  const leftCradle = new THREE.Mesh(leftCradleGeo, materials.machinedBrass);
  leftCradle.position.set(-1.72, -1.26, 0.12);
  supportsGroup.add(leftCradle);

  const plaqueGeo = new THREE.PlaneGeometry(0.7, 0.3);
  const plaqueMesh = new THREE.Mesh(plaqueGeo, materials.plaqueMaterial);
  plaqueMesh.position.set(-1.72, -1.52, 0.64);
  plaqueMesh.rotation.x = -0.08;
  supportsGroup.add(plaqueMesh);

  const rightPedestalGeo = new THREE.BoxGeometry(0.9, 0.54, 1.05);
  const rightPedestal = new THREE.Mesh(rightPedestalGeo, materials.anodizedBlack);
  rightPedestal.position.set(0.54, -1.58, 0.05);
  supportsGroup.add(rightPedestal);

  const rightBrassSaddleGeo = new THREE.BoxGeometry(0.7, 0.28, 0.95);
  const rightBrassSaddle = new THREE.Mesh(rightBrassSaddleGeo, materials.machinedBrass);
  rightBrassSaddle.position.set(0.54, -1.25, 0.08);
  supportsGroup.add(rightBrassSaddle);

  // --- CUTAWAY MASTER CINE LENS ASSEMBLY ---
  const lensMasterGroup = new THREE.Group();
  lensMasterGroup.position.set(0, -0.02, 0);
  scene.add(lensMasterGroup);

  // 1. Rear Geared Ring (Left end, x = -2.18)
  const rearBrassGear = createBrassGearRing(
    1.29,
    1.04,
    0.23,
    90,
    0.033,
    materials.machinedBrass,
    materials.agedBrassDark
  );
  rearBrassGear.position.x = -2.18;
  lensMasterGroup.add(rearBrassGear);

  const rearBlackFlangeGeo = new THREE.CylinderGeometry(1.33, 1.33, 0.26, 72, 1, true);
  rearBlackFlangeGeo.rotateZ(Math.PI / 2);
  const rearBlackFlange = new THREE.Mesh(rearBlackFlangeGeo, materials.anodizedBlack);
  rearBlackFlange.position.x = -1.96;
  lensMasterGroup.add(rearBlackFlange);

  // 2. Cutaway Back Half-Cylinder Housing
  const cutawayShellGeo = new THREE.CylinderGeometry(
    1.32,
    1.32,
    2.4,
    64,
    1,
    true,
    Math.PI * 0.58,
    Math.PI * 1.15
  );
  cutawayShellGeo.rotateZ(Math.PI / 2);
  const cutawayShell = new THREE.Mesh(cutawayShellGeo, materials.cutawayInteriorBlack);
  cutawayShell.position.x = -0.77;
  lensMasterGroup.add(cutawayShell);

  for (const bx of [-1.55, -1.05, -0.55, -0.05]) {
    const baffleArcGeo = new THREE.TorusGeometry(1.27, 0.036, 12, 48, Math.PI * 1.15);
    baffleArcGeo.rotateY(Math.PI / 2);
    baffleArcGeo.rotateX(Math.PI * 0.42);
    const baffleArc = new THREE.Mesh(baffleArcGeo, materials.agedBrassDark);
    baffleArc.position.x = bx;
    lensMasterGroup.add(baffleArc);
  }

  // 3. Machined Brass Cutaway Structural Bridges & Stepped Corner Brackets
  const bridgeGroup = new THREE.Group();
  lensMasterGroup.add(bridgeGroup);

  const createBrassBridgeBar = (yPos: number, zPos: number, rotX: number) => {
    const barHolder = new THREE.Group();
    const barGeo = new THREE.BoxGeometry(2.42, 0.12, 0.2);
    const bar = new THREE.Mesh(barGeo, materials.machinedBrass);
    barHolder.add(bar);

    const earGeo = new THREE.BoxGeometry(0.36, 0.23, 0.26);
    const leftEar = new THREE.Mesh(earGeo, materials.machinedBrass);
    leftEar.position.set(-1.02, 0, 0.04);
    barHolder.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, materials.machinedBrass);
    rightEar.position.set(1.02, 0, 0.04);
    barHolder.add(rightEar);

    barHolder.position.set(-0.77, yPos, zPos);
    barHolder.rotation.x = rotX;
    return barHolder;
  };

  const topBridge = createBrassBridgeBar(1.25, 0.24, -0.15);
  const bottomBridge = createBrassBridgeBar(-1.23, 0.3, 0.18);
  bridgeGroup.add(topBridge, bottomBridge);

  const assembledCoverGeo = new THREE.CylinderGeometry(
    1.34,
    1.34,
    2.38,
    64,
    1,
    true,
    -Math.PI * 0.42,
    Math.PI * 0.85
  );
  assembledCoverGeo.rotateZ(Math.PI / 2);
  const assembledCover = new THREE.Mesh(assembledCoverGeo, materials.anodizedBlack);
  assembledCover.position.x = -0.77;
  lensMasterGroup.add(assembledCover);

  // 4. Internal Optical Glass Elements (6 Elements with radial caustic glow discs)
  const rearElement6 = createOpticalLensMesh(
    1.13,
    0.22,
    0.25,
    -0.06,
    materials.opticalGlassCyan,
    materials.frostedGlassEdge,
    materials.causticDiscCyan
  );
  rearElement6.position.x = -1.78;
  lensMasterGroup.add(rearElement6);

  const movableFocusGroup = new THREE.Group();
  lensMasterGroup.add(movableFocusGroup);

  const element5 = createOpticalLensMesh(
    1.05,
    0.16,
    0.08,
    0.08,
    materials.opticalGlassWarm,
    materials.frostedGlassEdge,
    materials.causticDiscWarm
  );
  element5.position.x = -1.16;
  movableFocusGroup.add(element5);

  // GOLDEN BRASS APERTURE IRIS MODULE (x = -0.68)
  const apertureModuleGroup = new THREE.Group();
  apertureModuleGroup.position.x = -0.68;
  movableFocusGroup.add(apertureModuleGroup);

  const irisOuterRingGeo = new THREE.TorusGeometry(1.09, 0.08, 24, 72);
  irisOuterRingGeo.rotateY(Math.PI / 2);
  const irisOuterRing = new THREE.Mesh(irisOuterRingGeo, materials.copperGoldIris);
  apertureModuleGroup.add(irisOuterRing);

  const irisFlangeGeo = new THREE.CylinderGeometry(1.13, 1.13, 0.19, 72, 1, true);
  irisFlangeGeo.rotateZ(Math.PI / 2);
  const irisFlange = new THREE.Mesh(irisFlangeGeo, materials.machinedBrass);
  apertureModuleGroup.add(irisFlange);

  // Warm golden glow halo on the aperture plane
  const irisGlowGeo = new THREE.CircleGeometry(1.05, 64);
  irisGlowGeo.rotateY(Math.PI / 2);
  const irisGlowMesh = new THREE.Mesh(irisGlowGeo, materials.causticDiscWarm);
  apertureModuleGroup.add(irisGlowMesh);

  const irisBlades: THREE.Mesh[] = [];
  const bladeCount = 12;
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x241d14,
    metalness: 0.78,
    roughness: 0.32,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < bladeCount; i++) {
    const bladeGeo = new THREE.BoxGeometry(0.025, 0.62, 0.32);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    apertureModuleGroup.add(blade);
    irisBlades.push(blade);
  }

  // Element 4 (Bright crystal positive element right of aperture at x = -0.18)
  const element4 = createOpticalLensMesh(
    1.07,
    0.24,
    0.26,
    0.12,
    materials.opticalGlassCrystal,
    materials.frostedGlassEdge,
    materials.causticDiscCyan
  );
  element4.position.x = -0.18;
  movableFocusGroup.add(element4);

  // Element 3 (Thick high-refraction element inside main brass gear at x = +0.26)
  const element3 = createOpticalLensMesh(
    0.97,
    0.28,
    0.32,
    -0.14,
    materials.opticalGlassCrystal,
    materials.frostedGlassEdge,
    materials.causticDiscCyan
  );
  element3.position.x = 0.26;
  movableFocusGroup.add(element3);

  // 5. CENTRAL LARGE BRASS HELICAL FOCUS GEAR RING (x = +0.52)
  const mainBrassGear = createBrassGearRing(
    1.47,
    1.18,
    0.35,
    110,
    0.043,
    materials.machinedBrass,
    materials.agedBrassDark
  );
  mainBrassGear.position.x = 0.52;
  lensMasterGroup.add(mainBrassGear);

  const brassCollarGeo = new THREE.CylinderGeometry(1.37, 1.37, 0.18, 72);
  brassCollarGeo.rotateZ(Math.PI / 2);
  const brassCollar = new THREE.Mesh(brassCollarGeo, materials.agedBrassDark);
  brassCollar.position.x = 0.32;
  lensMasterGroup.add(brassCollar);

  // 6. TOP EXPLODED BRASS PINION GEAR MECHANISM
  const topPinionAssembly = new THREE.Group();
  topPinionAssembly.position.set(0.32, 1.92, 0.0);
  lensMasterGroup.add(topPinionAssembly);

  const upperSpurGear = createBrassGearRing(
    0.39,
    0.11,
    0.23,
    32,
    0.036,
    materials.machinedBrass,
    materials.agedBrassDark
  );
  upperSpurGear.position.set(0.08, 0.12, 0);
  topPinionAssembly.add(upperSpurGear);

  const lowerPinionGear = createBrassGearRing(
    0.25,
    0.08,
    0.19,
    22,
    0.032,
    materials.machinedBrass,
    materials.agedBrassDark
  );
  lowerPinionGear.position.set(-0.28, 0.22, 0.12);
  topPinionAssembly.add(lowerPinionGear);

  const carrierBarGeo = new THREE.BoxGeometry(0.66, 0.12, 0.15);
  const carrierBar = new THREE.Mesh(carrierBarGeo, materials.machinedBrass);
  carrierBar.position.set(-0.08, 0.16, -0.15);
  topPinionAssembly.add(carrierBar);

  // 7. FRONT MATTE-BLACK RIBBED FOCUS BARREL & FRONT ELEMENT
  const focusRingGroup = new THREE.Group();
  lensMasterGroup.add(focusRingGroup);

  const focusBarrelLength = 1.44;
  const focusBarrelRadius = 1.38;
  const focusBarrelGeo = new THREE.CylinderGeometry(
    focusBarrelRadius,
    focusBarrelRadius,
    focusBarrelLength,
    72
  );
  focusBarrelGeo.rotateZ(Math.PI / 2);
  const focusBarrelMesh = new THREE.Mesh(focusBarrelGeo, materials.anodizedBlack);
  focusBarrelMesh.position.x = 1.42;
  focusRingGroup.add(focusBarrelMesh);

  const ribCount = 64;
  const ribGeo = new THREE.BoxGeometry(focusBarrelLength * 0.94, 0.043, 0.048);
  const ribsInstanced = new THREE.InstancedMesh(ribGeo, materials.ribbedGripBlack, ribCount);
  const ribDummy = new THREE.Object3D();
  for (let i = 0; i < ribCount; i++) {
    const angle = (i / ribCount) * Math.PI * 2;
    const r = focusBarrelRadius + 0.015;
    ribDummy.position.set(1.42, Math.cos(angle) * r, Math.sin(angle) * r);
    ribDummy.rotation.set(-angle, 0, 0);
    ribDummy.updateMatrix();
    ribsInstanced.setMatrixAt(i, ribDummy.matrix);
  }
  ribsInstanced.instanceMatrix.needsUpdate = true;
  focusRingGroup.add(ribsInstanced);

  const scaleCollarGeo = new THREE.CylinderGeometry(1.31, 1.35, 0.28, 72);
  scaleCollarGeo.rotateZ(Math.PI / 2);
  const scaleCollar = new THREE.Mesh(scaleCollarGeo, materials.focusScaleMaterial);
  scaleCollar.position.x = 2.26;
  focusRingGroup.add(scaleCollar);

  const frontNoseGeo = new THREE.CylinderGeometry(1.16, 1.31, 0.84, 72);
  frontNoseGeo.rotateZ(Math.PI / 2);
  const frontNose = new THREE.Mesh(frontNoseGeo, materials.anodizedBlack);
  frontNose.position.x = 2.82;
  lensMasterGroup.add(frontNose);

  const indexDotGeo = new THREE.SphereGeometry(0.034, 16, 16);
  const indexDotMat = new THREE.MeshBasicMaterial({ color: 0xeff8ff });
  const indexDot = new THREE.Mesh(indexDotGeo, indexDotMat);
  indexDot.position.set(2.44, 0.08, 1.29);
  lensMasterGroup.add(indexDot);

  const frontElement1 = createOpticalLensMesh(
    1.08,
    0.22,
    0.28,
    0.05,
    materials.opticalGlassCyan,
    materials.frostedGlassEdge,
    materials.causticDiscCyan
  );
  frontElement1.position.x = 3.24;
  lensMasterGroup.add(frontElement1);

  // --- RIGHT SIDE DIORAMA SUBJECT SCENE (Bright Window Grid + Cedar & Pine Trees) ---
  const dioramaGroup = new THREE.Group();
  dioramaGroup.position.set(4.5, -0.42, 0.18);
  scene.add(dioramaGroup);

  const gridFrameGeo = new THREE.PlaneGeometry(2.8, 4.0, 12, 16);
  const gridFrameMat = new THREE.MeshBasicMaterial({
    color: 0x8cb4d4,
    wireframe: true,
    transparent: true,
    opacity: 0.22,
  });
  const gridFrame = new THREE.Mesh(gridFrameGeo, gridFrameMat);
  gridFrame.position.set(0.55, 1.1, -0.65);
  gridFrame.rotation.y = -0.35;
  dioramaGroup.add(gridFrame);

  const trayGeo = new THREE.BoxGeometry(1.9, 0.18, 2.3);
  const trayMat = new THREE.MeshStandardMaterial({
    color: 0x70502e,
    roughness: 0.5,
    metalness: 0.15,
  });
  const trayMesh = new THREE.Mesh(trayGeo, trayMat);
  trayMesh.position.set(0.2, -0.85, 0.2);
  trayMesh.rotation.y = -0.25;
  dioramaGroup.add(trayMesh);

  const createBotanicalTree = (colorHex: number, scale: number) => {
    const tree = new THREE.Group();
    const foliageMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.42,
      metalness: 0.05,
      flatShading: true,
    });
    const tier1 = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale, 0.56 * scale, 7), foliageMat);
    tier1.position.y = 0.16 * scale;
    const tier2 = new THREE.Mesh(new THREE.ConeGeometry(0.26 * scale, 0.48 * scale, 7), foliageMat);
    tier2.position.y = 0.46 * scale;
    const tier3 = new THREE.Mesh(new THREE.ConeGeometry(0.18 * scale, 0.38 * scale, 7), foliageMat);
    tier3.position.y = 0.74 * scale;
    tree.add(tier1, tier2, tier3);
    return tree;
  };

  const cedarTree = createBotanicalTree(0x52ad4e, 1.18);
  cedarTree.position.set(-0.05, -0.72, 0.35);
  dioramaGroup.add(cedarTree);

  const pineTree = createBotanicalTree(0x317d35, 1.38);
  pineTree.position.set(0.38, -0.68, -0.15);
  dioramaGroup.add(pineTree);

  const fgSculpture = createBotanicalTree(0x74c966, 0.88);
  fgSculpture.position.set(-0.28, -0.76, 0.75);
  dioramaGroup.add(fgSculpture);

  const dioramaLight = new THREE.PointLight(0xf2ffe6, 3.0, 5.0);
  dioramaLight.position.set(3.8, 1.5, 1.4);
  scene.add(dioramaLight);

  // --- DYNAMIC 3D OPTICAL RAY TRACING SYSTEM ---
  const raySystemGroup = new THREE.Group();
  scene.add(raySystemGroup);

  const rayLines: THREE.Line[] = [];
  const axialWaveLines: THREE.Line[] = [];

  const rayConfigs = [
    { yFactor: 1.0, zFactor: 0.0, opacity: 0.86, color: 0xeaf8ff },
    { yFactor: 0.88, zFactor: 0.14, opacity: 0.68, color: 0xc8ebff },
    { yFactor: 0.74, zFactor: -0.14, opacity: 0.58, color: 0xffe8bd },
    { yFactor: -1.0, zFactor: 0.0, opacity: 0.86, color: 0xeaf8ff },
    { yFactor: -0.88, zFactor: 0.14, opacity: 0.68, color: 0xc8ebff },
    { yFactor: -0.74, zFactor: -0.14, opacity: 0.58, color: 0xffe8bd },
    { yFactor: 0.48, zFactor: 0.08, opacity: 0.42, color: 0x94d8ff },
    { yFactor: -0.48, zFactor: -0.08, opacity: 0.42, color: 0x94d8ff },
    { yFactor: 0.18, zFactor: 0.0, opacity: 0.65, color: 0xffffff },
    { yFactor: -0.18, zFactor: 0.0, opacity: 0.65, color: 0xffffff },
  ];

  for (const cfg of rayConfigs) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(9 * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: cfg.opacity,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geom, mat);
    raySystemGroup.add(line);
    rayLines.push(line);
  }

  // Central braided harmonic optical axis ray bundle
  const axialStrands = 8;
  const axialPointsCount = 72;
  for (let s = 0; s < axialStrands; s++) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(axialPointsCount * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: s % 2 === 0 ? 0xf5fcff : 0xa6e2ff,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geom, mat);
    raySystemGroup.add(line);
    axialWaveLines.push(line);
  }

  const coreBeamGeo = new THREE.CylinderGeometry(0.12, 0.15, 5.2, 32, 1, true);
  coreBeamGeo.rotateZ(Math.PI / 2);
  const coreBeamMat = new THREE.MeshBasicMaterial({
    color: 0xc4edff,
    transparent: true,
    opacity: 0.19,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coreBeamMesh = new THREE.Mesh(coreBeamGeo, coreBeamMat);
  coreBeamMesh.position.x = -0.35;
  raySystemGroup.add(coreBeamMesh);

  let currentShift = 0;
  let currentRotation = 0;
  let currentIris = 0.22;
  let currentExploded = 1.0;

  const updateFromTelemetry = (
    telemetry: OpticalTelemetry,
    assemblyMode: 'assembled' | 'exploded',
    dt: number
  ) => {
    const lerpSpeed = Math.min(1, dt * 10);
    currentShift += (telemetry.focusGroupShift - currentShift) * lerpSpeed;
    currentRotation += (telemetry.ringRotationRad - currentRotation) * lerpSpeed;
    currentIris += (telemetry.irisRadiusNormalized - currentIris) * lerpSpeed;

    const targetExploded = assemblyMode === 'exploded' ? 1.0 : 0.0;
    currentExploded += (targetExploded - currentExploded) * lerpSpeed;

    movableFocusGroup.position.x = currentShift * 0.42;
    focusRingGroup.rotation.x = currentRotation;
    mainBrassGear.rotation.x = currentRotation * 0.85;
    rearBrassGear.rotation.x = -currentRotation * 0.35;
    vernierKnobGroup.rotation.y = -currentRotation * 1.6;
    vernierKnobGroup.position.x = -0.28 - currentShift * 0.38;

    topPinionAssembly.position.y = 1.56 + currentExploded * 0.36;
    upperSpurGear.rotation.x = -currentRotation * 2.8;
    lowerPinionGear.rotation.x = currentRotation * 4.1;

    assembledCover.visible = currentExploded < 0.98;
    assembledCover.position.y = currentExploded * 0.85;
    assembledCover.scale.setScalar(1 - currentExploded * 0.15);

    const openRadius = 0.16 + currentIris * 0.68;
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2 + currentIris * 0.35;
      const blade = irisBlades[i];
      const r = openRadius + 0.26;
      blade.position.set(0, Math.cos(angle) * r, Math.sin(angle) * r);
      blade.rotation.x = -angle + 0.48;
    }

    coreBeamMesh.scale.set(1, 0.58 + currentIris * 0.95, 0.58 + currentIris * 0.95);

    const focusDelta = (telemetry.distanceCm - 54) / 56;
    const convergenceX = -3.85 - focusDelta * 0.85;
    const irisSpread = 0.09 + currentIris * 0.48;
    const frontSpread = 0.22 + currentIris * 0.46;

    rayConfigs.forEach((cfg, idx) => {
      const line = rayLines[idx];
      const posAttr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const signY = cfg.yFactor;
      const signZ = cfg.zFactor;

      const isGhost = Math.abs(cfg.yFactor) < 0.6 && Math.abs(cfg.yFactor) > 0.3;
      const rayConvX = isGhost ? convergenceX + 0.68 : convergenceX;

      const xCoords = [
        4.65,
        3.24,
        1.55,
        0.26 + currentShift * 0.42,
        -0.68 + currentShift * 0.42,
        -1.16 + currentShift * 0.42,
        -1.78,
        rayConvX,
        -5.35,
      ];

      const rearY = signY * (0.14 + currentIris * 0.36);
      const slopeAfterRear = (0 - rearY) / (rayConvX - -1.78);
      const endY = rearY + slopeAfterRear * (-5.35 - -1.78);

      const yCoords = [
        signY * (0.38 + currentIris * 0.25),
        signY * frontSpread,
        signY * (frontSpread * 0.78),
        signY * (irisSpread * 1.15),
        signY * irisSpread,
        signY * (irisSpread * 1.08),
        rearY,
        0.0,
        endY,
      ];

      for (let p = 0; p < 9; p++) {
        posAttr.setXYZ(p, xCoords[p], yCoords[p], signZ * (1 - p / 9) * 0.25);
      }
      posAttr.needsUpdate = true;
    });

    const axialStartX = 3.24;
    const axialEndX = -2.18;
    for (let s = 0; s < axialStrands; s++) {
      const line = axialWaveLines[s];
      const posAttr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const phase = (s / axialStrands) * Math.PI * 2;
      const amp = 0.044 + currentIris * 0.048;

      for (let p = 0; p < axialPointsCount; p++) {
        const t = p / (axialPointsCount - 1);
        const x = axialStartX + (axialEndX - axialStartX) * t;
        const envelope = Math.sin(t * Math.PI) * 0.85 + 0.15;
        const wave = Math.sin(t * 32 + phase - currentRotation * 3) * amp * envelope;
        const zWave = Math.cos(t * 32 + phase - currentRotation * 3) * amp * 0.5 * envelope;
        posAttr.setXYZ(p, x, wave, zWave);
      }
      posAttr.needsUpdate = true;
    }
  };

  const getCalloutAnchors = (): CalloutAnchor[] => [
    {
      id: 'helical',
      label: 'Helical',
      anchorWorld: new THREE.Vector3(0.32, 2.28, 0),
      offsetScreen: { dx: 18, dy: -22 },
      align: 'left',
    },
    {
      id: 'focusing-group',
      label: 'Focusing group',
      anchorWorld: new THREE.Vector3(-0.22 + currentShift * 0.42, 1.05, 0.2),
      offsetScreen: { dx: -52, dy: -28 },
      align: 'right',
    },
    {
      id: 'focusing-ring',
      label: 'Focusing ring',
      anchorWorld: new THREE.Vector3(1.55, 1.38, 0.2),
      offsetScreen: { dx: 54, dy: -16 },
      align: 'left',
    },
    {
      id: 'front-element',
      label: 'Front element',
      anchorWorld: new THREE.Vector3(3.18, 0.92, 0.25),
      offsetScreen: { dx: 48, dy: -18 },
      align: 'left',
    },
    {
      id: 'aperture-stop',
      label: 'Aperture stop',
      anchorWorld: new THREE.Vector3(-0.68 + currentShift * 0.42, -1.08, 0.35),
      offsetScreen: { dx: -44, dy: 28 },
      align: 'right',
    },
    {
      id: 'rear-element',
      label: 'Rear glass',
      anchorWorld: new THREE.Vector3(-2.15, -1.05, 0.35),
      offsetScreen: { dx: -46, dy: 24 },
      align: 'right',
    },
  ];

  const dispose = () => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).geometry) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
  };

  return {
    scene,
    camera,
    focusRingGroup,
    VernierKnobGroup: vernierKnobGroup,
    updateFromTelemetry,
    getCalloutAnchors,
    dispose,
  };
}
