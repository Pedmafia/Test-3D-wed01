import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Seeded random so the textures are identical on every load
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Night city skyline for the ultrawide monitor */
export function cityTexture() {
  const [c, g] = canvas(1024, 432);
  const r = rng(7);
  const sky = g.createLinearGradient(0, 0, 0, c.height);
  sky.addColorStop(0, '#060a1c');
  sky.addColorStop(0.65, '#1a2a5c');
  sky.addColorStop(1, '#0b1028');
  g.fillStyle = sky; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
    g.fillRect(r() * c.width, r() * c.height * 0.55, 1.5, 1.5);
  }
  const base = c.height * 0.82;
  let x = 0;
  while (x < c.width) {
    const w = 26 + r() * 50;
    const h = 60 + r() * 220;
    g.fillStyle = `rgb(${8 + r() * 10},${10 + r() * 12},${24 + r() * 20})`;
    g.fillRect(x, base - h, w, h);
    for (let wy = base - h + 8; wy < base - 6; wy += 9) {
      for (let wx = x + 4; wx < x + w - 5; wx += 7) {
        if (r() < 0.32) {
          g.fillStyle = r() < 0.8 ? `rgba(255,${190 + r() * 50},${110 + r() * 60},0.95)` : 'rgba(150,200,255,0.9)';
          g.fillRect(wx, wy, 3.5, 4.5);
        }
      }
    }
    x += w + 2 + r() * 6;
  }
  // water reflection
  const refl = g.getImageData(0, base - (c.height - base), c.width, c.height - base);
  g.save(); g.globalAlpha = 0.35;
  const [rc, rg] = canvas(c.width, c.height - base);
  rg.putImageData(refl, 0, 0);
  g.translate(0, c.height); g.scale(1, -1);
  g.drawImage(rc, 0, 0, c.width, c.height - base);
  g.restore();
  g.fillStyle = 'rgba(10,20,50,0.45)'; g.fillRect(0, base, c.width, c.height - base);
  return toTexture(c);
}

/** Code editor wallpaper for the ultrawide monitor */
export function codeTexture() {
  const [c, g] = canvas(1024, 432);
  const r = rng(21);
  g.fillStyle = '#14161d'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#1b1e27'; g.fillRect(0, 0, 170, c.height);
  g.fillStyle = '#20232d'; g.fillRect(0, 0, c.width, 26);
  const cols = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#ffcb6b', '#eeffff'];
  for (let i = 0; i < 18; i++) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(16, 40 + i * 20, 40 + r() * 90, 7);
  }
  for (let line = 0; line < 19; line++) {
    const y = 40 + line * 20;
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.fillRect(182, y, 16, 7);
    let x = 214 + Math.floor(r() * 4) * 22;
    const n = 2 + Math.floor(r() * 6);
    for (let k = 0; k < n && x < 980; k++) {
      const w = 20 + r() * 90;
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.fillRect(x, y, w, 7);
      x += w + 9;
    }
  }
  g.fillStyle = '#b3122e'; g.fillRect(0, c.height - 18, c.width, 18);
  return toTexture(c);
}

/** Blueprint / CAD drawing for the vertical monitor */
export function cadTexture() {
  const [c, g] = canvas(384, 640);
  g.fillStyle = '#0a1226'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(120,160,255,0.18)'; g.lineWidth = 1;
  for (let x = 0; x < c.width; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  for (let y = 0; y < c.height; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.strokeStyle = '#cfe0ff'; g.lineWidth = 3;
  g.strokeRect(40, 60, 300, 520);
  g.lineWidth = 2;
  [[40, 240, 200, 240], [200, 60, 200, 380], [200, 380, 340, 380], [120, 240, 120, 580], [40, 440, 120, 440]].forEach(([a, b, cc, d]) => {
    g.beginPath(); g.moveTo(a, b); g.lineTo(cc, d); g.stroke();
  });
  g.strokeStyle = '#ff4d6a';
  g.beginPath(); g.arc(200, 240, 40, Math.PI, Math.PI * 1.5); g.stroke();
  g.fillStyle = '#9fb8ff'; g.font = '16px monospace';
  g.fillText('PLAN  A-101', 40, 40);
  g.fillText('4000 x 4000', 230, 610);
  return toTexture(c);
}

/** Phone lock screen */
export function phoneTexture() {
  const [c, g] = canvas(128, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#2b0a14'); grd.addColorStop(1, '#0c0f24');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center';
  g.fillText(new Date().toTimeString().slice(0, 5), 64, 80);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(14, 120, 100, 30); g.fillRect(14, 158, 100, 30);
  return toTexture(c);
}

/** View outside the window, day and night versions */
export function outdoorTexture(night = false) {
  const [c, g] = canvas(512, 384);
  const r = rng(night ? 3 : 4);
  const sky = g.createLinearGradient(0, 0, 0, c.height);
  if (night) { sky.addColorStop(0, '#05081a'); sky.addColorStop(1, '#1c2242'); }
  else { sky.addColorStop(0, '#cfe6f5'); sky.addColorStop(1, '#eef4ea'); }
  g.fillStyle = sky; g.fillRect(0, 0, c.width, c.height);
  // distant building
  g.fillStyle = night ? '#141830' : '#b9c1c4';
  g.fillRect(300, 90, 180, 300);
  if (night) {
    for (let y = 110; y < 380; y += 22) for (let x = 312; x < 470; x += 26)
      if (r() < 0.4) { g.fillStyle = '#ffcf87'; g.fillRect(x, y, 12, 10); }
  }
  // trees
  for (let i = 0; i < 70; i++) {
    const x = r() * c.width, y = 40 + r() * c.height;
    const rad = 18 + r() * 40;
    const l = night ? 6 + r() * 10 : 28 + r() * 30;
    g.fillStyle = `hsl(${95 + r() * 30}, ${night ? 25 : 45}%, ${l}%)`;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = night ? '#120d0a' : '#4a3a2c'; g.lineWidth = 6;
  for (let i = 0; i < 4; i++) { const x = 40 + i * 120 + r() * 40; g.beginPath(); g.moveTo(x, c.height); g.lineTo(x + 10, 120); g.stroke(); }
  return toTexture(c);
}

/** Light grey wood planks — UVs are in metres, one tile = 2 m */
export function floorTexture() {
  const [c, g] = canvas(1024, 1024);
  const r = rng(11);
  const rows = 12;
  const rh = c.height / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 400;
    while (x < c.width) {
      const w = 380 + r() * 300;
      const l = 62 + r() * 10;
      g.fillStyle = `hsl(30, 4%, ${l}%)`;
      g.fillRect(x, row * rh, w, rh);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = `rgba(80,70,60,${0.04 + r() * 0.07})`;
        g.lineWidth = 1 + r() * 2;
        const yy = row * rh + r() * rh;
        g.beginPath(); g.moveTo(x, yy);
        g.bezierCurveTo(x + w * 0.3, yy + (r() - 0.5) * 8, x + w * 0.6, yy + (r() - 0.5) * 8, x + w, yy);
        g.stroke();
      }
      g.fillStyle = 'rgba(40,38,36,0.55)';
      g.fillRect(x, row * rh, 2, rh);
      x += w;
    }
    g.fillStyle = 'rgba(40,38,36,0.55)';
    g.fillRect(0, row * rh, c.width, 2);
  }
  return toTexture(c, { repeat: true });
}

/** Rug fibre noise */
export function rugTexture() {
  const [c, g] = canvas(512, 512);
  const img = g.createImageData(512, 512);
  const r = rng(5);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + r() * 40;
    img.data[i] = img.data[i + 1] = v; img.data[i + 2] = v + 3; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, { repeat: true });
}

/**
 * The Blender meshes were exported without UVs, so generate box-projected UVs.
 * mode 'fit'   → each face direction is stretched to 0..1 (screens)
 * mode 'metre' → 1 UV unit per `scale` metres (floor, rug)
 */
export function boxUV(geometry, mode = 'fit', scale = 1) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const size = new THREE.Vector3().subVectors(max, min);
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    let u, v;
    if (mode === 'metre') {
      if (ay >= ax && ay >= az) { u = x / scale; v = z / scale; }
      else if (ax >= az) { u = z / scale; v = y / scale; }
      else { u = x / scale; v = y / scale; }
    } else if (ax >= ay && ax >= az) {
      u = nx > 0 ? (max.z - z) / size.z : (z - min.z) / size.z;
      v = (y - min.y) / size.y;
    } else if (az >= ay) {
      u = nz > 0 ? (x - min.x) / size.x : (max.x - x) / size.x;
      v = (y - min.y) / size.y;
    } else {
      u = (x - min.x) / size.x; v = (z - min.z) / size.z;
    }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
