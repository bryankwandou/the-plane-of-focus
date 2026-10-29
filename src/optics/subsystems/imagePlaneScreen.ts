import * as THREE from 'three';
import {
  IMAGE_PLANE_X,
  OPTICAL_AXIS_Y,
  SUBJECTS,
  computeCoc,
  formatDistCm,
  formatAperture,
} from '../opticalPhysics';

export interface ImagePlaneSubsystem {
  group: THREE.Group;
  updateProjection: (focusD: number, apertureN: number) => void;
}

export function buildImagePlaneScreen(mats: {
  darkAnodized: THREE.Material;
  brushedBrass: THREE.Material;
}): ImagePlaneSubsystem {
  const group = new THREE.Group();
  const screenW = 2.65;
  const screenH = 1.92;

  // Twin anodized support pillars rising from the optical bench to the Ground Glass frame
  const pillarGeo = new THREE.BoxGeometry(0.18, 1.32, 0.22);
  [-0.85, 0.85].forEach((pz) => {
    const pillar = new THREE.Mesh(pillarGeo, mats.darkAnodized);
    pillar.position.set(IMAGE_PLANE_X, 2.38, pz);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);

    const clampFoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.36),
      mats.brushedBrass
    );
    clampFoot.position.set(IMAGE_PLANE_X, 1.98, pz);
    group.add(clampFoot);
  });

  // Machined black aluminum outer frame around the Ground Glass
  const frameThickness = 0.12;
  const frameDepth = 0.14;
  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(frameDepth, frameThickness, screenW + frameThickness * 2),
    mats.darkAnodized
  );
  topBar.position.set(IMAGE_PLANE_X, OPTICAL_AXIS_Y + screenH * 0.5 + frameThickness * 0.5, 0);
  group.add(topBar);

  const botBar = new THREE.Mesh(
    new THREE.BoxGeometry(frameDepth, frameThickness, screenW + frameThickness * 2),
    mats.darkAnodized
  );
  botBar.position.set(IMAGE_PLANE_X, OPTICAL_AXIS_Y - screenH * 0.5 - frameThickness * 0.5, 0);
  group.add(botBar);

  const leftBar = new THREE.Mesh(
    new THREE.BoxGeometry(frameDepth, screenH, frameThickness),
    mats.darkAnodized
  );
  leftBar.position.set(IMAGE_PLANE_X, OPTICAL_AXIS_Y, -screenW * 0.5 - frameThickness * 0.5);
  group.add(leftBar);

  const rightBar = new THREE.Mesh(
    new THREE.BoxGeometry(frameDepth, screenH, frameThickness),
    mats.darkAnodized
  );
  rightBar.position.set(IMAGE_PLANE_X, OPTICAL_AXIS_Y, screenW * 0.5 + frameThickness * 0.5);
  group.add(rightBar);

  // Brass corner accents on Ground Glass frame
  const cornerAccentGeo = new THREE.BoxGeometry(frameDepth + 0.02, 0.18, 0.18);
  [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].forEach(([sy, sz]) => {
    const corner = new THREE.Mesh(cornerAccentGeo, mats.brushedBrass);
    corner.position.set(
      IMAGE_PLANE_X,
      OPTICAL_AXIS_Y + sy * (screenH * 0.5 + frameThickness * 0.4),
      sz * (screenW * 0.5 + frameThickness * 0.4)
    );
    group.add(corner);
  });

  // Glowing seafoam-cyan frosted glass rim
  const rimEdgeMat = new THREE.MeshBasicMaterial({
    color: 0x8ef6ff,
    transparent: true,
    opacity: 0.42,
  });
  const rimEdge = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, screenH + 0.02, screenW + 0.02),
    rimEdgeMat
  );
  rimEdge.position.set(IMAGE_PLANE_X + 0.01, OPTICAL_AXIS_Y, 0);
  group.add(rimEdge);

  // Live 2D Canvas projection of the inverted optical image formed on the Ground Glass
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  const layerCanvases = [0, 1, 2].map(() => {
    const lc = document.createElement('canvas');
    lc.width = 256;
    lc.height = 192;
    return lc;
  });

  // Pre-render the 3 depth layers (0: Foreground Cedar, 1: Middle Cabin, 2: Background Mountain Peak)
  // Note: A real single-lens camera forms an INVERTED (upside-down & laterally flipped) optical image!
  {
    // Layer 2: Background Sky + Snow-capped Mountains
    const l2 = layerCanvases[2].getContext('2d')!;
    const skyG = l2.createLinearGradient(0, 0, 0, 192);
    skyG.addColorStop(0, '#2a4d6c');
    skyG.addColorStop(0.6, '#5c8db0');
    skyG.addColorStop(1, '#416d3e');
    l2.fillStyle = skyG;
    l2.fillRect(0, 0, 256, 192);

    // Mountains
    l2.fillStyle = '#4e5d6c';
    l2.beginPath();
    l2.moveTo(20, 145);
    l2.lineTo(95, 38);
    l2.lineTo(170, 145);
    l2.fill();

    l2.beginPath();
    l2.moveTo(115, 145);
    l2.lineTo(190, 52);
    l2.lineTo(250, 145);
    l2.fill();

    // Snow caps
    l2.fillStyle = '#eef6fc';
    l2.beginPath();
    l2.moveTo(95, 38);
    l2.lineTo(72, 72);
    l2.lineTo(118, 72);
    l2.closePath();
    l2.fill();

    // Layer 1: Middle Ground Meadow + Cozy Timber Cabin with Warm Glowing Windows
    const l1 = layerCanvases[1].getContext('2d')!;
    l1.fillStyle = '#3b6e38';
    l1.fillRect(0, 128, 256, 64);

    // Cabin walls
    l1.fillStyle = '#966236';
    l1.fillRect(102, 96, 54, 42);

    // Pitched roof
    l1.fillStyle = '#3c2415';
    l1.beginPath();
    l1.moveTo(92, 98);
    l1.lineTo(129, 68);
    l1.lineTo(166, 98);
    l1.closePath();
    l1.fill();

    // Warm glowing cabin windows
    l1.fillStyle = '#ffda75';
    l1.fillRect(112, 108, 12, 12);
    l1.fillRect(132, 108, 12, 12);

    // Layer 0: Foreground Cedar Trees
    const l0 = layerCanvases[0].getContext('2d')!;
    const drawTree = (tx: number, ty: number, s: number) => {
      l0.fillStyle = '#54351d';
      l0.fillRect(tx - 4 * s, ty, 8 * s, 22 * s);
      l0.fillStyle = '#2d6e32';
      for (let tier = 0; tier < 3; tier++) {
        const w = (32 - tier * 7) * s;
        const h = 26 * s;
        const yTop = ty - 42 * s + tier * 13 * s;
        l0.beginPath();
        l0.moveTo(tx, yTop);
        l0.lineTo(tx - w, yTop + h);
        l0.lineTo(tx + w, yTop + h);
        l0.closePath();
        l0.fill();
      }
    };
    drawTree(56, 136, 1.15);
    drawTree(206, 140, 0.95);
  }

  const projTexture = new THREE.CanvasTexture(canvas);
  projTexture.colorSpace = THREE.SRGBColorSpace;

  const screenMat = new THREE.MeshBasicMaterial({
    map: projTexture,
    side: THREE.DoubleSide,
  });

  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
  screenMesh.position.set(IMAGE_PLANE_X + 0.025, OPTICAL_AXIS_Y, 0);
  screenMesh.rotation.y = Math.PI / 2;
  group.add(screenMesh);

  let lastFocusD = -1;
  let lastAperture = -1;

  const updateProjection = (focusD: number, apertureN: number) => {
    if (Math.abs(focusD - lastFocusD) < 0.004 && Math.abs(apertureN - lastAperture) < 0.02) {
      return;
    }
    lastFocusD = focusD;
    lastAperture = apertureN;

    ctx.save();
    ctx.clearRect(0, 0, 512, 384);

    // Invert image vertically and horizontally to simulate true optical conjugate image on Ground Glass
    ctx.translate(512, 384);
    ctx.scale(-1, -1);

    const drawOrder = [2, 1, 0];
    drawOrder.forEach((idx) => {
      const subj = SUBJECTS[idx];
      const coc = computeCoc(subj.d, focusD, apertureN);
      const blurPx = Math.min(18, coc * 165);
      ctx.filter = blurPx > 0.4 ? `blur(${blurPx.toFixed(1)}px)` : 'none';
      ctx.drawImage(layerCanvases[idx], 0, 0, 512, 384);

      // Draw optical Circle of Confusion bokeh discs for out-of-focus highlights
      if (blurPx > 2.2) {
        ctx.filter = 'none';
        const radius = Math.min(34, 4 + blurPx * 1.45);
        ctx.fillStyle =
          idx === 1
            ? 'rgba(255, 212, 128, 0.34)'
            : idx === 0
            ? 'rgba(152, 245, 184, 0.28)'
            : 'rgba(158, 230, 255, 0.28)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.lineWidth = 1.2;
        const bx = idx === 1 ? 256 : idx === 0 ? 115 : 195;
        const by = idx === 1 ? 220 : idx === 0 ? 235 : 110;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    ctx.restore();

    // Subtle ground-glass fiducial crosshair + corner brackets + live telemetry
    ctx.strokeStyle = 'rgba(190, 248, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(256, 24);
    ctx.lineTo(256, 360);
    ctx.moveTo(24, 192);
    ctx.lineTo(488, 192);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(190, 248, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(256, 192, 36, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(215, 250, 255, 0.82)';
    ctx.font = '600 13px monospace';
    ctx.fillText(
      `GROUND GLASS  |  FOCUS ${formatDistCm(focusD)}  |  ${formatAperture(apertureN)}`,
      22,
      366
    );

    projTexture.needsUpdate = true;
  };

  return {
    group,
    updateProjection,
  };
}
