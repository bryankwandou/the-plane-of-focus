import * as THREE from 'three';
import {
  VALLEY_MIN_X,
  VALLEY_MAX_X,
  VALLEY_HALF_Z,
  VALLEY_BASE_Y,
  LENS_FRONT_X,
  SUBJECTS,
  clamp,
  computeDofBounds,
} from '../opticalPhysics';

export interface MiniatureValleySubsystem {
  group: THREE.Group;
  planeOfFocusGroup: THREE.Group;
  planeCollider: THREE.Mesh;
  dofZoneMesh: THREE.Mesh;
  subjectTargets: THREE.Mesh[];
  updateFocusPlane: (focusD: number, apertureN: number, timeSec: number) => void;
}

interface TriangleEdgeTriplet {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
  minX: number;
  maxX: number;
}

function buildIntersectionContourSystem(sourceGroup: THREE.Object3D): {
  lineSegments: THREE.LineSegments;
  updatePlaneX: (planeX: number) => void;
} {
  sourceGroup.updateMatrixWorld(true);
  const triangles: TriangleEdgeTriplet[] = [];
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();

  sourceGroup.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || mesh.userData.noIntersect) return;
    const geom = mesh.geometry;
    const pos = geom.attributes.position;
    if (!pos) return;
    const index = geom.index;
    const mat = mesh.matrixWorld;

    const pushTri = (i0: number, i1: number, i2: number) => {
      vA.fromBufferAttribute(pos, i0).applyMatrix4(mat);
      vB.fromBufferAttribute(pos, i1).applyMatrix4(mat);
      vC.fromBufferAttribute(pos, i2).applyMatrix4(mat);
      const minX = Math.min(vA.x, vB.x, vC.x);
      const maxX = Math.max(vA.x, vB.x, vC.x);
      if (maxX < VALLEY_MIN_X - 0.1 || minX > VALLEY_MAX_X + 0.1) return;
      triangles.push({
        ax: vA.x,
        ay: vA.y,
        az: vA.z,
        bx: vB.x,
        by: vB.y,
        cz: vC.z,
        bz: vB.z,
        cx: vC.x,
        cy: vC.y,
        minX,
        maxX,
      });
    };

    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        pushTri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        pushTri(i, i + 1, i + 2);
      }
    }
  });

  const maxSegments = Math.max(256, triangles.length);
  const positions = new Float32Array(maxSegments * 6);
  const geom = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('position', attr);
  geom.setDrawRange(0, 0);

  const mat = new THREE.LineBasicMaterial({
    color: 0xbef8ff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const lineSegments = new THREE.LineSegments(geom, mat);
  lineSegments.frustumCulled = false;

  const updatePlaneX = (planeX: number) => {
    let ptr = 0;
    for (let i = 0; i < triangles.length; i++) {
      const t = triangles[i];
      if (planeX < t.minX || planeX > t.maxX) continue;

      const pts: number[] = [];
      const checkEdge = (
        x1: number,
        y1: number,
        z1: number,
        x2: number,
        y2: number,
        z2: number
      ) => {
        if ((x1 <= planeX && x2 >= planeX) || (x2 <= planeX && x1 >= planeX)) {
          const denom = x2 - x1;
          if (Math.abs(denom) < 1e-6) return;
          const u = (planeX - x1) / denom;
          pts.push(planeX, y1 + (y2 - y1) * u, z1 + (z2 - z1) * u);
        }
      };

      checkEdge(t.ax, t.ay, t.az, t.bx, t.by, t.bz);
      checkEdge(t.bx, t.by, t.bz, t.cx, t.cy, t.cz);
      checkEdge(t.cx, t.cy, t.cz, t.ax, t.ay, t.az);

      if (pts.length >= 6 && ptr + 6 <= positions.length) {
        positions[ptr++] = pts[0];
        positions[ptr++] = pts[1];
        positions[ptr++] = pts[2];
        positions[ptr++] = pts[3];
        positions[ptr++] = pts[4];
        positions[ptr++] = pts[5];
      }
    }
    attr.needsUpdate = true;
    geom.setDrawRange(0, ptr / 3);
  };

  return { lineSegments, updatePlaneX };
}

function createSkyBackdropTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#447aa8');
  g.addColorStop(0.55, '#7bb1d6');
  g.addColorStop(0.85, '#b8d9e8');
  g.addColorStop(1, '#dcebe8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Soft sunlit clouds
  ctx.fillStyle = 'rgba(255, 252, 244, 0.36)';
  for (let i = 0; i < 9; i++) {
    const cx = 50 + i * 52;
    const cy = 55 + Math.sin(i * 1.7) * 28;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 44, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFocusPlaneGridTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  // Subtle cyan/emerald translucent wash
  const radial = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  radial.addColorStop(0, 'rgba(130, 240, 255, 0.24)');
  radial.addColorStop(0.7, 'rgba(95, 215, 245, 0.16)');
  radial.addColorStop(1, 'rgba(70, 195, 235, 0.08)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, 512, 512);

  // Crisp grid lines matching the screenshot's right-side Plane of Focus glass
  ctx.strokeStyle = 'rgba(185, 248, 255, 0.42)';
  ctx.lineWidth = 1.5;
  const step = 64;
  for (let i = step; i < 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Outer glowing border
  ctx.strokeStyle = 'rgba(215, 252, 255, 0.92)';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, 506, 506);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildMiniatureValley(
  mats: {
    darkAnodized: THREE.Material;
    brushedBrass: THREE.Material;
  }
): MiniatureValleySubsystem {
  const group = new THREE.Group();
  const valleyCenterX = (VALLEY_MIN_X + VALLEY_MAX_X) * 0.5;
  const valleyLenX = VALLEY_MAX_X - VALLEY_MIN_X;
  const valleyWidthZ = VALLEY_HALF_Z * 2;

  // Support pedestals connecting the diorama to the optical bench rail
  const pedGeo = new THREE.BoxGeometry(0.38, 1.02, 1.15);
  [-0.95, 0.95].forEach((dx) => {
    const ped = new THREE.Mesh(pedGeo, mats.darkAnodized);
    ped.position.set(valleyCenterX + dx, 2.52, 0);
    ped.castShadow = true;
    ped.receiveShadow = true;
    ped.userData.noIntersect = true;
    group.add(ped);
  });

  // Warm hardwood diorama tray frame
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x724c2a,
    roughness: 0.48,
    metalness: 0.05,
  });
  const trayBase = new THREE.Mesh(
    new THREE.BoxGeometry(valleyLenX + 0.16, 0.16, valleyWidthZ + 0.16),
    woodMat
  );
  trayBase.position.set(valleyCenterX, VALLEY_BASE_Y - 0.06, 0);
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  trayBase.userData.noIntersect = true;
  group.add(trayBase);

  // Brass corner brackets on wooden tray
  const cornerGeo = new THREE.BoxGeometry(0.14, 0.18, 0.14);
  [
    [VALLEY_MIN_X - 0.04, -VALLEY_HALF_Z - 0.04],
    [VALLEY_MIN_X - 0.04, VALLEY_HALF_Z + 0.04],
    [VALLEY_MAX_X + 0.04, -VALLEY_HALF_Z - 0.04],
    [VALLEY_MAX_X + 0.04, VALLEY_HALF_Z + 0.04],
  ].forEach(([cx, cz]) => {
    const cMesh = new THREE.Mesh(cornerGeo, mats.brushedBrass);
    cMesh.position.set(cx, VALLEY_BASE_Y - 0.05, cz);
    cMesh.userData.noIntersect = true;
    group.add(cMesh);
  });

  const dioramaGroup = new THREE.Group();
  group.add(dioramaGroup);

  // Rolling green alpine terrain
  const segX = 56;
  const segZ = 48;
  const terrainGeo = new THREE.PlaneGeometry(valleyLenX, valleyWidthZ, segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cLow = new THREE.Color(0x3b6e38);
  const cMid = new THREE.Color(0x4d8842);
  const cHigh = new THREE.Color(0x6b7c5e);
  const cPath = new THREE.Color(0x9a825c);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const lx = posAttr.getX(i);
    const lz = posAttr.getZ(i);
    const wx = lx + valleyCenterX;
    const u = (wx - VALLEY_MIN_X) / valleyLenX;
    const v = lz / VALLEY_HALF_Z;

    // Valley floor with gentle hills on sides and rising slope toward back
    let h =
      0.08 +
      0.18 * Math.pow(Math.abs(v), 1.6) +
      0.22 * Math.pow(u, 1.8) +
      0.06 * Math.sin(wx * 2.7 + lz * 2.1) +
      0.04 * Math.cos(wx * 4.3 - lz * 3.4);

    // Flatten slightly around the cabin at SUBJECTS[1]
    const dCabin = Math.hypot(wx - SUBJECTS[1].worldPos[0], lz - SUBJECTS[1].worldPos[2]);
    if (dCabin < 0.55) {
      h = THREE.MathUtils.lerp(0.18, h, dCabin / 0.55);
    }

    posAttr.setY(i, VALLEY_BASE_Y + h);
    posAttr.setX(i, wx);

    // Winding path near z = 0.1 * sin(wx)
    const pathDist = Math.abs(lz - (0.18 * Math.sin(wx * 1.4) - 0.05));
    if (pathDist < 0.16 && u < 0.72) {
      tmpColor.copy(cPath).lerp(cMid, pathDist / 0.16);
    } else if (h < 0.22) {
      tmpColor.copy(cLow).lerp(cMid, (h - 0.06) / 0.16);
    } else {
      tmpColor.copy(cMid).lerp(cHigh, clamp((h - 0.22) / 0.35, 0, 1));
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  dioramaGroup.add(terrainMesh);

  // Helper to build stylized tiered pine/cedar trees (visible on the right edge of the user's screenshot!)
  const foliageDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2f6b34,
    roughness: 0.72,
  });
  const foliageBrightMat = new THREE.MeshStandardMaterial({
    color: 0x458b3e,
    roughness: 0.68,
  });
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5c3d24,
    roughness: 0.85,
  });

  const addPineTree = (x: number, baseY: number, z: number, scale = 1, bright = false) => {
    const tree = new THREE.Group();
    tree.position.set(x, baseY, z);
    tree.scale.setScalar(scale);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 10), trunkMat);
    trunk.position.y = 0.11;
    trunk.castShadow = true;
    tree.add(trunk);

    const mat = bright ? foliageBrightMat : foliageDarkMat;
    const tiers = [
      { r: 0.22, h: 0.34, y: 0.30 },
      { r: 0.175, h: 0.30, y: 0.48 },
      { r: 0.125, h: 0.26, y: 0.64 },
    ];
    tiers.forEach((t) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 14), mat);
      cone.position.y = t.y;
      cone.castShadow = true;
      cone.receiveShadow = true;
      tree.add(cone);
    });

    dioramaGroup.add(tree);
    return tree;
  };

  // Foreground Cedar (Subject 0) + foreground trees positioned right at the right edge of the Hero Lens view
  addPineTree(SUBJECTS[0].worldPos[0], VALLEY_BASE_Y + 0.14, SUBJECTS[0].worldPos[2], 1.18, true);
  addPineTree(1.36, VALLEY_BASE_Y + 0.14, 0.86, 1.12, true);
  addPineTree(1.56, VALLEY_BASE_Y + 0.15, 1.18, 0.96, false);
  addPineTree(1.82, VALLEY_BASE_Y + 0.16, 0.98, 1.04, true);
  addPineTree(1.65, VALLEY_BASE_Y + 0.16, -0.85, 1.0, false);
  addPineTree(2.42, VALLEY_BASE_Y + 0.18, 0.86, 0.92, true);
  addPineTree(2.95, VALLEY_BASE_Y + 0.20, 0.78, 1.05, false);
  addPineTree(3.18, VALLEY_BASE_Y + 0.22, -0.82, 1.12, true);

  // Cozy Timber Cabin (Subject 1 at d = 2.35 -> x = 2.85, z = -0.18)
  const cabinGroup = new THREE.Group();
  cabinGroup.position.set(SUBJECTS[1].worldPos[0], VALLEY_BASE_Y + 0.18, SUBJECTS[1].worldPos[2]);
  cabinGroup.rotation.y = 0.22;

  const cabinWallMat = new THREE.MeshStandardMaterial({
    color: 0x9c6b3e,
    roughness: 0.68,
  });
  const cabinRoofMat = new THREE.MeshStandardMaterial({
    color: 0x422a1b,
    roughness: 0.75,
  });
  const warmWindowMat = new THREE.MeshStandardMaterial({
    color: 0xffe49e,
    emissive: 0xffae38,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const cabinBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.36), cabinWallMat);
  cabinBody.position.y = 0.14;
  cabinBody.castShadow = true;
  cabinBody.receiveShadow = true;
  cabinGroup.add(cabinBody);

  // Pitched roof
  const roofGeo = new THREE.ConeGeometry(0.35, 0.24, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roofMesh = new THREE.Mesh(roofGeo, cabinRoofMat);
  roofMesh.position.y = 0.38;
  roofMesh.scale.set(1.18, 1, 1.02);
  roofMesh.castShadow = true;
  cabinGroup.add(roofMesh);

  // Glowing front & side windows
  const winFront = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), warmWindowMat);
  winFront.position.set(-0.212, 0.15, 0.06);
  winFront.rotation.y = -Math.PI / 2;
  cabinGroup.add(winFront);

  const winSide = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.09), warmWindowMat);
  winSide.position.set(-0.04, 0.15, 0.182);
  cabinGroup.add(winSide);

  dioramaGroup.add(cabinGroup);

  // Background Snow-Capped Mountains & Distant Pine (Subject 2 at d = 3.65 -> x = 4.15)
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x5c6873,
    roughness: 0.78,
    flatShading: true,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf2f6fa,
    roughness: 0.45,
    flatShading: true,
  });

  const addMountainPeak = (x: number, z: number, radius: number, height: number) => {
    const mGroup = new THREE.Group();
    mGroup.position.set(x, VALLEY_BASE_Y + 0.16, z);

    const baseCone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), rockMat);
    baseCone.position.y = height * 0.5;
    baseCone.castShadow = true;
    baseCone.receiveShadow = true;
    mGroup.add(baseCone);

    const snowCap = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.46, height * 0.44, 7),
      snowMat
    );
    snowCap.position.y = height * 0.785;
    snowCap.rotation.y = 0.08;
    mGroup.add(snowCap);

    dioramaGroup.add(mGroup);
  };

  addMountainPeak(SUBJECTS[2].worldPos[0], SUBJECTS[2].worldPos[2], 0.72, 1.38);
  addMountainPeak(4.42, 0.65, 0.64, 1.18);
  addMountainPeak(4.55, -1.02, 0.58, 1.08);
  addPineTree(3.98, VALLEY_BASE_Y + 0.28, 0.15, 1.18, false);

  // Back sky board at the rear of the wooden tray
  const skyTex = createSkyBackdropTexture();
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex });
  const skyBoard = new THREE.Mesh(new THREE.PlaneGeometry(valleyWidthZ + 0.08, 1.85), skyMat);
  skyBoard.position.set(VALLEY_MAX_X + 0.03, VALLEY_BASE_Y + 0.92, 0);
  skyBoard.rotation.y = -Math.PI / 2;
  skyBoard.userData.noIntersect = true;
  group.add(skyBoard);

  // Invisible click targets for the 3 subjects so clicking them in 3D focuses on them
  const subjectTargets: THREE.Mesh[] = [];
  const hitGeo = new THREE.SphereGeometry(0.32, 12, 12);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  SUBJECTS.forEach((subj) => {
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.set(subj.worldPos[0], subj.worldPos[1], subj.worldPos[2]);
    hit.userData = { type: 'subject', subjectIndex: subj.index, d: subj.d };
    group.add(hit);
    subjectTargets.push(hit);
  });

  // Real-time 3D Triangle Cross-Section Contour Slicer
  const contourSystem = buildIntersectionContourSystem(dioramaGroup);
  group.add(contourSystem.lineSegments);

  // Draggable Glowing Plane of Focus Sheet (visible on the right side of the user's screenshot!)
  const planeOfFocusGroup = new THREE.Group();
  const planeHeight = 1.92;
  const planeWidth = valleyWidthZ + 0.12;

  const gridTex = createFocusPlaneGridTexture();
  const planeMat = new THREE.MeshBasicMaterial({
    map: gridTex,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight), planeMat);
  planeMesh.rotation.y = -Math.PI / 2;
  planeMesh.position.y = VALLEY_BASE_Y + planeHeight * 0.5 - 0.02;
  planeOfFocusGroup.add(planeMesh);

  // Invisible drag collider for the Plane of Focus
  const planeCollider = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  );
  planeCollider.rotation.y = -Math.PI / 2;
  planeCollider.position.copy(planeMesh.position);
  planeCollider.userData = { type: 'focusPlane' };
  planeOfFocusGroup.add(planeCollider);

  group.add(planeOfFocusGroup);

  // Translucent Depth-of-Field Sharp Zone Slab around the Plane of Focus
  const dofZoneMat = new THREE.MeshBasicMaterial({
    color: 0x7ceeff,
    transparent: true,
    opacity: 0.07,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const dofZoneMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, planeHeight * 0.96, planeWidth * 0.98),
    dofZoneMat
  );
  dofZoneMesh.position.y = planeMesh.position.y;
  group.add(dofZoneMesh);

  const updateFocusPlane = (focusD: number, apertureN: number, _timeSec: number) => {
    const valleyShift = -0.50;
    const planeX = clamp(LENS_FRONT_X + focusD + valleyShift, VALLEY_MIN_X, VALLEY_MAX_X);
    planeOfFocusGroup.position.x = planeX;
    contourSystem.updatePlaneX(planeX);

    const [nearD, farD] = computeDofBounds(focusD, apertureN);
    const nearX = clamp(LENS_FRONT_X + nearD + valleyShift, VALLEY_MIN_X, VALLEY_MAX_X);
    const farX = clamp(
      LENS_FRONT_X + (isFinite(farD) ? farD : 20) + valleyShift,
      VALLEY_MIN_X,
      VALLEY_MAX_X
    );
    const slabWidth = Math.max(0.02, farX - nearX);
    dofZoneMesh.position.x = (nearX + farX) * 0.5;
    dofZoneMesh.scale.x = slabWidth;
  };

  return {
    group,
    planeOfFocusGroup,
    planeCollider,
    dofZoneMesh,
    subjectTargets,
    updateFocusPlane,
  };
}
