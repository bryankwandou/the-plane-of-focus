import * as THREE from 'three';

function createBlueprintTexture(title: string, mode: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#0e131a';
  ctx.fillRect(0, 0, 512, 320);

  // Subtle blueprint grid
  ctx.strokeStyle = 'rgba(110, 210, 245, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 32; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 320);
    ctx.stroke();
  }
  for (let y = 32; y < 320; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Optical axis
  ctx.strokeStyle = 'rgba(130, 225, 255, 0.35)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(30, 160);
  ctx.lineTo(482, 160);
  ctx.stroke();
  ctx.setLineDash([]);

  // Lens schematic curves
  ctx.strokeStyle = 'rgba(165, 238, 255, 0.72)';
  ctx.lineWidth = 2;
  [210, 250, 290].forEach((lx) => {
    ctx.beginPath();
    ctx.ellipse(lx, 160, 10, 74, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Ray cone schematic
  ctx.strokeStyle =
    mode === 0
      ? 'rgba(255, 215, 130, 0.68)'
      : mode === 1
      ? 'rgba(150, 245, 190, 0.68)'
      : 'rgba(155, 225, 255, 0.68)';
  ctx.beginPath();
  ctx.moveTo(75, 160);
  ctx.lineTo(250, 95);
  ctx.lineTo(435, 160);
  ctx.moveTo(75, 160);
  ctx.lineTo(250, 225);
  ctx.lineTo(435, 160);
  ctx.stroke();

  ctx.fillStyle = 'rgba(195, 235, 250, 0.65)';
  ctx.font = '600 13px monospace';
  ctx.fillText(title, 24, 38);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildStudioRoom(): THREE.Group {
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x12151c,
    roughness: 0.78,
    metalness: 0.15,
  });

  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x171b23,
    roughness: 0.64,
    metalness: 0.22,
  });

  // Main architectural studio back wall
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(36, 18, 0.4), wallMat);
  backWall.position.set(0, 8.2, -4.6);
  backWall.receiveShadow = true;
  group.add(backWall);

  // Subtle vertical architectural slats/panels along the back wall (matching the dark studio background in screenshot)
  for (let i = -8; i <= 8; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.45, 14, 0.08), panelMat);
    slat.position.set(i * 1.65, 7.2, -4.36);
    slat.receiveShadow = true;
    group.add(slat);
  }

  // Horizontal architectural shelf / warm LED accent line behind the right side of the lens
  const shelfBar = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.12, 0.45),
    new THREE.MeshStandardMaterial({
      color: 0x242934,
      roughness: 0.4,
      metalness: 0.5,
    })
  );
  shelfBar.position.set(2.5, 4.32, -4.18);
  group.add(shelfBar);

  const warmLedStrip = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.025, 0.04),
    new THREE.MeshBasicMaterial({
      color: 0xffdca8,
      transparent: true,
      opacity: 0.65,
    })
  );
  warmLedStrip.position.set(2.5, 4.25, -3.98);
  group.add(warmLedStrip);

  // 3 Framed Optical Blueprint Diagrams high on the back studio wall (visible in wide overview camera)
  const titles = [
    'FIG 1. THIN LENS CONJUGATE EQUATION  1/f = 1/s + 1/s\'',
    'FIG 2. CIRCLE OF CONFUSION & APERTURE STOP DIAMETER',
    'FIG 3. HYPERFOCAL & DEPTH OF FIELD BOUNDARY ZONES',
  ];
  titles.forEach((title, idx) => {
    const tex = createBlueprintTexture(title, idx);
    const frameGroup = new THREE.Group();
    frameGroup.position.set(-4.8 + idx * 4.8, 7.35, -4.28);

    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 2.15, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: 0.4, metalness: 0.6 })
    );
    frameGroup.add(backing);

    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.98),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    art.position.z = 0.035;
    frameGroup.add(art);

    group.add(frameGroup);
  });

  // Dark studio floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0d1015,
    roughness: 0.68,
    metalness: 0.18,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.0;
  floor.receiveShadow = true;
  group.add(floor);

  return group;
}
