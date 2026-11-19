import * as THREE from 'three';

export interface ProceduralTextures {
  ground: THREE.CanvasTexture;
  asphalt: THREE.CanvasTexture;
  helipad: THREE.CanvasTexture;
  container: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  gloo: THREE.CanvasTexture;
  crate: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Tactical arid/grass terrain
  const [gCan, gCtx] = makeCanvas(512, 512);
  gCtx.fillStyle = '#5c5442';
  gCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 14;
    const shade = Math.random();
    gCtx.fillStyle =
      shade < 0.35
        ? 'rgba(72, 82, 52, 0.28)'
        : shade < 0.7
          ? 'rgba(116, 102, 76, 0.25)'
          : 'rgba(54, 48, 38, 0.28)';
    gCtx.beginPath();
    gCtx.arc(x, y, r, 0, Math.PI * 2);
    gCtx.fill();
  }
  const ground = finalizeTexture(gCan, aniso, 36, 36);

  // 2. Asphalt road / compound floor
  const [aCan, aCtx] = makeCanvas(512, 512);
  aCtx.fillStyle = '#2d3138';
  aCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3500; i++) {
    const v = 35 + Math.floor(Math.random() * 28);
    aCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    aCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  aCtx.strokeStyle = 'rgba(255,255,255,0.08)';
  aCtx.lineWidth = 2;
  aCtx.strokeRect(4, 4, 504, 504);
  const asphalt = finalizeTexture(aCan, aniso, 8, 8);

  // 3. Helipad Concrete Pad
  const [hCan, hCtx] = makeCanvas(512, 512);
  hCtx.fillStyle = '#363b42';
  hCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2000; i++) {
    const v = 45 + Math.floor(Math.random() * 25);
    hCtx.fillStyle = `rgba(${v},${v + 3},${v + 6},0.45)`;
    hCtx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }
  hCtx.strokeStyle = '#f59e0b';
  hCtx.lineWidth = 14;
  hCtx.beginPath();
  hCtx.arc(256, 256, 195, 0, Math.PI * 2);
  hCtx.stroke();
  hCtx.strokeStyle = '#e5e7eb';
  hCtx.lineWidth = 10;
  hCtx.beginPath();
  hCtx.arc(256, 256, 170, 0, Math.PI * 2);
  hCtx.stroke();
  // Big H
  hCtx.fillStyle = '#f59e0b';
  hCtx.fillRect(182, 162, 34, 188);
  hCtx.fillRect(296, 162, 34, 188);
  hCtx.fillRect(182, 238, 148, 36);
  const helipad = finalizeTexture(hCan, aniso, 1, 1);

  // 4. Corrugated Shipping Container
  const [cCan, cCtx] = makeCanvas(512, 256);
  cCtx.fillStyle = '#d4d4d8';
  cCtx.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 16) {
    cCtx.fillStyle = 'rgba(0,0,0,0.22)';
    cCtx.fillRect(x, 0, 6, 256);
    cCtx.fillStyle = 'rgba(255,255,255,0.18)';
    cCtx.fillRect(x + 6, 0, 4, 256);
  }
  cCtx.fillStyle = 'rgba(15,23,42,0.45)';
  cCtx.fillRect(0, 0, 512, 16);
  cCtx.fillRect(0, 240, 512, 16);
  cCtx.fillStyle = 'rgba(255,255,255,0.6)';
  cCtx.font = 'bold 26px monospace';
  cCtx.fillText('ZERO-CORP // 04', 28, 56);
  const container = finalizeTexture(cCan, aniso, 1, 1);

  // 5. Concrete Bunker Wall with Hazard Stripe
  const [bCan, bCtx] = makeCanvas(512, 512);
  bCtx.fillStyle = '#6f747a';
  bCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) {
    const v = 90 + Math.floor(Math.random() * 45);
    bCtx.fillStyle = `rgba(${v},${v + 2},${v},0.3)`;
    bCtx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
  }
  // Seam lines
  bCtx.strokeStyle = 'rgba(30,34,38,0.45)';
  bCtx.lineWidth = 4;
  bCtx.beginPath();
  bCtx.moveTo(0, 256);
  bCtx.lineTo(512, 256);
  bCtx.moveTo(256, 0);
  bCtx.lineTo(256, 512);
  bCtx.stroke();
  // Bottom hazard stripe
  bCtx.fillStyle = '#18181b';
  bCtx.fillRect(0, 456, 512, 56);
  bCtx.fillStyle = '#eab308';
  for (let x = -60; x < 580; x += 48) {
    bCtx.beginPath();
    bCtx.moveTo(x, 512);
    bCtx.lineTo(x + 24, 512);
    bCtx.lineTo(x + 56, 456);
    bCtx.lineTo(x + 32, 456);
    bCtx.closePath();
    bCtx.fill();
  }
  const concrete = finalizeTexture(bCan, aniso, 2, 1);

  // 6. Gloo Wall Hexagonal Energy Matrix
  const [glCan, glCtx] = makeCanvas(512, 256);
  glCtx.fillStyle = '#0c4a6e';
  glCtx.fillRect(0, 0, 512, 256);
  glCtx.strokeStyle = '#38bdf8';
  glCtx.lineWidth = 3;
  const rHex = 24;
  const dx = rHex * 1.5;
  const dy = rHex * Math.sqrt(3);
  for (let col = -1; col < 18; col++) {
    for (let row = -1; row < 10; row++) {
      const cx = col * dx;
      const cy = row * dy + (col % 2 === 0 ? 0 : dy / 2);
      glCtx.beginPath();
      for (let s = 0; s < 6; s++) {
        const ang = (Math.PI / 3) * s;
        const px = cx + (rHex - 2) * Math.cos(ang);
        const py = cy + (rHex - 2) * Math.sin(ang);
        if (s === 0) glCtx.moveTo(px, py);
        else glCtx.lineTo(px, py);
      }
      glCtx.closePath();
      glCtx.fillStyle = (col + row) % 3 === 0 ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.1)';
      glCtx.fill();
      glCtx.stroke();
    }
  }
  const gloo = finalizeTexture(glCan, aniso, 2, 1);

  // 7. Armored Supply Crate
  const [crCan, crCtx] = makeCanvas(256, 256);
  crCtx.fillStyle = '#3f4d3b';
  crCtx.fillRect(0, 0, 256, 256);
  crCtx.strokeStyle = '#f59e0b';
  crCtx.lineWidth = 14;
  crCtx.strokeRect(8, 8, 240, 240);
  crCtx.fillStyle = '#f59e0b';
  crCtx.fillRect(28, 114, 200, 28);
  crCtx.fillStyle = '#18181b';
  crCtx.font = 'bold 20px monospace';
  crCtx.fillText('SUPPLY DROP', 58, 135);
  const crate = finalizeTexture(crCan, aniso, 1, 1);

  // 8. Bark
  const [bkCan, bkCtx] = makeCanvas(128, 256);
  bkCtx.fillStyle = '#4a3728';
  bkCtx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 200; i++) {
    bkCtx.fillStyle = Math.random() > 0.5 ? 'rgba(30,20,12,0.4)' : 'rgba(92,70,50,0.35)';
    bkCtx.fillRect(Math.random() * 128, Math.random() * 256, 4, 24 + Math.random() * 32);
  }
  const bark = finalizeTexture(bkCan, aniso, 1, 2);

  return {
    ground,
    asphalt,
    helipad,
    container,
    concrete,
    gloo,
    crate,
    bark,
    dispose: () => {
      ground.dispose();
      asphalt.dispose();
      helipad.dispose();
      container.dispose();
      concrete.dispose();
      gloo.dispose();
      crate.dispose();
      bark.dispose();
    },
  };
}
