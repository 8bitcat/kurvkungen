// Bilarna som små 3D-modeller (konvexa kroppar + cylindrar) som strålföljs till pixelsprites i
// 64 vinklar – samma ljus som terrängen, tonband i rampen, bläckkant mellan delar och sel-out-kontur.
// Lokala axlar: x framåt, y höger, z upp. 1 enhet = 1 världsenhet (bilen är ~20 lång).
import { Pix, mix, mul, ramp, shade, hash } from './pix.js?v=1';
import { LX, LY, LZ } from './iso.js?v=1';

export const ANGLES = 64;
export const SPR_W = 48, SPR_H = 40, SPR_OX = 24, SPR_OY = 27;

const V3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const plane = (n, p, mat) => { const [nx, ny, nz] = V3(...n); return [nx, ny, nz, nx * p[0] + ny * p[1] + nz * p[2], mat]; };

// Låda med fasade kanter. c = {t: topkanter, v: lodräta hörn, f: nos (fram-topp), r: bak-topp, b: underkant}
function box(x0, x1, y0, y1, z0, z1, mat, c = {}) {
  const P = [
    plane([1, 0, 0], [x1, 0, 0]), plane([-1, 0, 0], [x0, 0, 0]),
    plane([0, 1, 0], [0, y1, 0]), plane([0, -1, 0], [0, y0, 0]),
    plane([0, 0, 1], [0, 0, z1]), plane([0, 0, -1], [0, 0, z0]),
  ];
  if (c.t) { P.push(plane([0, 1, 1], [0, y1 - c.t, z1]), plane([0, -1, 1], [0, y0 + c.t, z1])); }
  if (c.v) { for (const sx of [1, -1]) for (const sy of [1, -1]) P.push(plane([sx, sy, 0], [sx > 0 ? x1 - c.v : x0 + c.v, sy > 0 ? y1 : y0, 0])); }
  if (c.f) P.push(plane([c.fz ?? 1, 0, c.fx ?? 1], [x1 - c.f, 0, z1]));
  if (c.r) P.push(plane([-(c.rz ?? 1), 0, c.rx ?? 1], [x0 + c.r, 0, z1]));
  if (c.b) { P.push(plane([1, 0, -1], [x1 - c.b, 0, z0]), plane([-1, 0, -1], [x0 + c.b, 0, z0])); }
  if (c.s) { P.push(plane([0, 1, -1], [0, y1 - c.s, z0]), plane([0, -1, -1], [0, y0 + c.s, z0])); }
  return { t: 'poly', P, mat };
}
// Kupé: botten z0, tak z1, vindruta som lutar `wf` bakåt, bakruta `wr`, sidor drar in `si`.
function cabin(xr, xf, hw, z0, z1, wf, wr, si, mat = 'glass', roof = 'paint') {
  const h = z1 - z0;
  return {
    t: 'poly', mat,
    P: [
      plane([0, 0, 1], [0, 0, z1], roof), plane([0, 0, -1], [0, 0, z0]),
      plane([h, 0, wf], [xf, 0, z0]), plane([-h, 0, wr], [xr, 0, z0]),
      plane([0, h, si], [0, hw, z0]), plane([0, -h, si], [0, -hw, z0]),
    ],
  };
}
const wheel = (x, y, z, r, w, mat = 'tire') => ({ t: 'cyl', c: [x, y, z], r, hw: w / 2, mat });
const wheels = (xf, xr, yw, r, w, rr = r, wr = w) => [
  wheel(xf, yw, r, r, w), wheel(xf, -yw, r, r, w), wheel(xr, yw, rr, rr, wr), wheel(xr, -yw, rr, rr, wr),
];

export const MODELS = {
  pirat: { // rallyhalvkombi
    len: 20, wid: 9.6, parts: () => [
      box(-9.2, 9.4, -4.7, 4.7, 1.5, 4.9, 'paint', { t: 1.0, v: 1.4, f: 1.6, fx: 1.6, fz: 1, r: 0.8, b: 0.8, s: 0.6 }),
      cabin(-8.6, 3.2, 4.4, 4.9, 8.5, 3.4, 0.9, 1.3),
      box(-9.3, -8.2, -4.9, 4.9, 1.4, 2.6, 'black'), box(8.8, 9.9, -4.9, 4.9, 1.4, 2.5, 'black', { v: 0.7 }),
      box(8.9, 9.6, 2.4, 4.0, 3.1, 4.0, 'light'), box(8.9, 9.6, -4.0, -2.4, 3.1, 4.0, 'light'),
      box(-9.45, -9.0, 2.6, 4.2, 3.4, 4.3, 'tail'), box(-9.45, -9.0, -4.2, -2.6, 3.4, 4.3, 'tail'),
      box(4.9, 5.6, -2.6, -0.6, 4.9, 5.9, 'spot'), box(4.9, 5.6, 0.6, 2.6, 4.9, 5.9, 'spot'),
      box(-7.0, -2.0, -3.4, 3.4, 8.5, 8.9, 'black'),
      ...wheels(5.6, -5.8, 3.9, 2.25, 2.0),
    ], stripe: 'roof',
  },
  komet: { // sportkupé med vinge
    len: 21, wid: 10, parts: () => [
      box(-10, 10.4, -4.9, 4.9, 1.3, 4.3, 'paint', { t: 1.2, v: 1.8, f: 3.4, fx: 3.6, fz: 1, r: 1.0, b: 0.9, s: 0.7 }),
      cabin(-5.6, 2.2, 4.0, 4.3, 7.1, 3.8, 3.4, 1.4),
      box(-10.1, -9.2, -5.0, 5.0, 1.2, 2.4, 'black'), box(9.6, 10.6, -4.7, 4.7, 1.2, 2.2, 'black', { v: 1.2 }),
      box(9.4, 10.2, 2.4, 4.0, 2.4, 3.0, 'light'), box(9.4, 10.2, -4.0, -2.4, 2.4, 3.0, 'light'),
      box(-10.15, -9.7, 1.6, 4.4, 3.2, 3.9, 'tail'), box(-10.15, -9.7, -4.4, -1.6, 3.2, 3.9, 'tail'),
      box(-9.7, -8.0, -4.9, 4.9, 6.2, 6.8, 'paint2'), box(-9.2, -8.6, 3.2, 3.8, 4.3, 6.2, 'black'), box(-9.2, -8.6, -3.8, -3.2, 4.3, 6.2, 'black'),
      box(-2, 2, 4.6, 5.1, 2.6, 3.4, 'black'), box(-2, 2, -5.1, -4.6, 2.6, 3.4, 'black'),
      ...wheels(6.2, -6.4, 4.1, 2.2, 2.1, 2.35, 2.4),
    ], stripe: 'twin',
  },
  muskel: { // muskelbil med luftintag
    len: 22, wid: 10.4, parts: () => [
      box(-10.6, 10.6, -5.1, 5.1, 1.6, 5.0, 'paint', { t: 0.8, v: 1.0, f: 1.2, fx: 1, fz: 1.4, r: 0.8, b: 0.6, s: 0.5 }),
      cabin(-5.4, 1.4, 4.6, 5.0, 8.0, 3.2, 3.6, 1.2),
      box(1.8, 6.4, -1.6, 1.6, 5.0, 6.1, 'paint2', { f: 0.8, fx: 1.2, fz: 1 }), box(5.6, 6.5, -1.3, 1.3, 5.2, 5.9, 'black'),
      box(-10.8, -9.9, -5.2, 5.2, 1.5, 2.6, 'chrome'), box(10.3, 11.0, -5.2, 5.2, 1.5, 2.6, 'chrome'),
      box(10.2, 10.75, -4.4, 4.4, 3.0, 4.6, 'black'), box(10.3, 10.85, 2.8, 4.2, 3.4, 4.3, 'light'), box(10.3, 10.85, -4.2, -2.8, 3.4, 4.3, 'light'),
      box(-10.75, -10.3, -4.6, 4.6, 3.4, 4.4, 'tail'),
      box(-10.6, -9.2, -4.9, 4.9, 5.0, 5.6, 'paint2'),
      ...wheels(6.6, -6.6, 4.3, 2.3, 2.0, 2.6, 2.9),
    ], stripe: 'twin',
  },
  buffel: { // pickup med flak och bågar
    len: 22, wid: 10.6, parts: () => [
      box(-1.0, 10.4, -5.0, 5.0, 2.6, 6.4, 'paint', { t: 0.8, v: 1.0, f: 1.4, fx: 1, fz: 1.6, b: 0.8, s: 0.5 }),
      cabin(-1.0, 4.4, 4.6, 6.4, 10.2, 2.4, 0.4, 0.9),
      box(-10.8, -1.0, -5.0, 5.0, 2.6, 4.2, 'paint', { v: 0.6, b: 0.6 }),
      box(-10.8, -1.0, 4.0, 5.0, 4.2, 6.2, 'paint', { t: 0.4 }), box(-10.8, -1.0, -5.0, -4.0, 4.2, 6.2, 'paint', { t: 0.4 }),
      box(-10.8, -9.8, -4.0, 4.0, 4.2, 6.0, 'paint', { t: 0.4 }),
      box(-8.5, -2.5, -3.6, 3.6, 4.2, 4.6, 'cargo'),
      box(10.4, 11.6, -4.6, 4.6, 2.0, 5.6, 'chrome'), box(10.6, 11.4, -3.8, 3.8, 2.6, 5.0, 'black'),
      box(10.5, 11.2, 2.6, 4.2, 3.6, 4.6, 'light'), box(10.5, 11.2, -4.2, -2.6, 3.6, 4.6, 'light'),
      box(-11.0, -10.6, 2.8, 4.6, 4.4, 5.6, 'tail'), box(-11.0, -10.6, -4.6, -2.8, 4.4, 5.6, 'tail'),
      box(-1.6, -0.9, -4.8, 4.8, 6.2, 11.0, 'black'), box(-1.6, -0.9, -4.8, 4.8, 10.5, 11.2, 'black'),
      box(-1.4, -0.6, 1.6, 3.4, 11.0, 12.0, 'spot'), box(-1.4, -0.6, -3.4, -1.6, 11.0, 12.0, 'spot'),
      ...wheels(6.4, -6.6, 4.5, 3.0, 2.6),
    ], stripe: 'side',
  },
  raket: { // kilformad superbil med stor vinge
    len: 22, wid: 10.8, parts: () => [
      box(-10.6, 11.0, -5.3, 5.3, 1.1, 3.9, 'paint', { t: 1.6, v: 2.4, f: 5.2, fx: 5.6, fz: 1, r: 1.4, b: 1.0, s: 0.9 }),
      cabin(-4.6, 2.6, 3.4, 3.9, 6.4, 4.2, 3.8, 1.6),
      box(-6.6, -3.4, -5.6, -3.6, 2.4, 3.8, 'black', { t: 0.6 }), box(-6.6, -3.4, 3.6, 5.6, 2.4, 3.8, 'black', { t: 0.6 }),
      box(-11.4, -9.4, -5.6, 5.6, 6.3, 6.8, 'paint2', { f: 0.4 }), box(-10.8, -10.0, 3.6, 4.2, 3.6, 6.3, 'black'), box(-10.8, -10.0, -4.2, -3.6, 3.6, 6.3, 'black'),
      box(10.2, 11.2, 2.4, 4.6, 1.9, 2.5, 'light'), box(10.2, 11.2, -4.6, -2.4, 1.9, 2.5, 'light'),
      box(-10.8, -10.4, -4.8, 4.8, 2.6, 3.4, 'tail'),
      box(-10.9, -9.6, -2.2, 2.2, 1.2, 2.2, 'chrome'),
      ...wheels(6.8, -6.8, 4.5, 2.2, 2.3, 2.45, 2.8),
    ], stripe: 'twin',
  },
};

// ---------- strålföljning ----------
function hitPoly(part, o, d, res) {
  let tin = -1e9, tout = 1e9, pl = null;
  for (const p of part.P) {
    const den = p[0] * d[0] + p[1] * d[1] + p[2] * d[2];
    const dist = p[3] - (p[0] * o[0] + p[1] * o[1] + p[2] * o[2]);
    if (Math.abs(den) < 1e-9) { if (dist < 0) return false; continue; }
    const t = dist / den;
    if (den > 0) { if (t < tout) { tout = t; pl = p; } } else if (t > tin) tin = t;
    if (tin > tout) return false;
  }
  if (!pl) return false;
  res.t = tout; res.n = pl; res.mat = pl[4] || part.mat;
  return true;
}
function hitCyl(part, o, d, res) {
  const [cx, cy, cz] = part.c, r = part.r, hw = part.hw;
  let ty0, ty1;
  if (Math.abs(d[1]) < 1e-9) { if (Math.abs(o[1] - cy) > hw) return false; ty0 = -1e9; ty1 = 1e9; }
  else { const a = (cy - hw - o[1]) / d[1], b = (cy + hw - o[1]) / d[1]; ty0 = Math.min(a, b); ty1 = Math.max(a, b); }
  const ox = o[0] - cx, oz = o[2] - cz;
  const A = d[0] * d[0] + d[2] * d[2], B = 2 * (ox * d[0] + oz * d[2]), Cc = ox * ox + oz * oz - r * r;
  if (A < 1e-12) { if (Cc > 0) return false; }
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return false;
  const sq = Math.sqrt(disc), t0 = (-B - sq) / (2 * A), t1 = (-B + sq) / (2 * A);
  const tin = Math.max(ty0, t0), tout = Math.min(ty1, t1);
  if (tin > tout) return false;
  res.t = tout;
  if (t1 < ty1) {
    const px = ox + d[0] * tout, pz = oz + d[2] * tout;
    res.n = [px / r, 0, pz / r]; res.mat = part.mat; res.tread = true;
  } else {
    const py = o[1] + d[1] * tout - cy;
    res.n = [0, Math.sign(py) || 1, 0];
    const px = ox + d[0] * tout, pz = oz + d[2] * tout;
    const rr = Math.hypot(px, pz) / r;
    res.mat = rr < 0.6 ? (rr < 0.2 ? 'hub' : 'rim') : part.mat; res.tread = false;
  }
  return true;
}
function trace(parts, o, d, best) {
  const res = {};
  best.t = -1e9; best.k = -1;
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    if ((p.t === 'poly' ? hitPoly(p, o, d, res) : hitCyl(p, o, d, res)) && res.t > best.t) {
      best.t = res.t; best.k = k; best.n = res.n; best.mat = res.mat; best.tread = res.tread;
    }
  }
  return best.k >= 0;
}

const HV = V3(LX + 1 / Math.sqrt(3), LY + 1 / Math.sqrt(3), LZ + 1 / Math.sqrt(3));

function matColor(mat, pal, lp, nz, stripeKind) {
  switch (mat) {
    case 'paint': {
      if (stripeKind === 'twin' && nz > 0.5 && Math.abs(Math.abs(lp[1]) - 1.2) < 0.75) return pal.stripe;
      if (stripeKind === 'roof' && nz > 0.5 && Math.abs(lp[1]) < 1.1) return pal.stripe;
      if (stripeKind === 'side' && nz < 0.3 && lp[2] > 3.6 && lp[2] < 4.6) return pal.stripe;
      return pal.paint;
    }
    case 'paint2': return pal.paint2;
    case 'glass': return 0x1e2a44;
    case 'black': return 0x26242c;
    case 'chrome': return 0xc8ccd4;
    case 'light': return 0xfff2c0;
    case 'spot': return 0xfff8d8;
    case 'tail': return 0xd02828;
    case 'tire': return 0x24222a;
    case 'rim': return 0xb4b8c2;
    case 'hub': return 0x6a6c78;
    case 'cargo': return 0x5a4632;
    default: return 0xff00ff;
  }
}

export function palette(color, stripe) {
  const dark = ((color >> 16 & 255) + (color >> 8 & 255) + (color & 255)) < 240;
  return { paint: color, paint2: mul(color, 0.82), stripe: stripe ?? (dark ? 0xe8e4dc : 0xf6f2ea) };
}

// Allmän modellrendering (läktare, portal m.m.): delar i lokala koordinater, matFn(mat, lp, n, px, py) → färg.
export function renderParts(parts, ang, W, H, OX, OY, matFn, outline = true) {
  const P = new Pix(W, H);
  const c = Math.cos(ang), s = Math.sin(ang);
  const dl = [c + s, -s + c, 1];
  const best = {};
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = px - OX + 0.5, j = py - OY + 0.5;
    const wx = i / 2, wy = -i / 2, wz = -j;
    const o = [wx * c + wy * s, -wx * s + wy * c, wz];
    if (!trace(parts, o, dl, best)) continue;
    const n = best.n;
    const nw = [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
    const lp = [o[0] + dl[0] * best.t, o[1] + dl[1] * best.t, o[2] + dl[2] * best.t];
    const diff = Math.max(0, nw[0] * LX + nw[1] * LY + nw[2] * LZ);
    const col = matFn(best.mat, lp, n, px, py);
    P.px(px, py, shade(col, 0.44 + 0.74 * diff, px, py, 0.4));
  }
  if (outline) P.outline();
  return P.flush();
}
export { box, cabin, plane };

// Ritar en sprite för vinkel ang (radianer). Returnerar canvas.
export function renderCar(modelId, pal, ang, zoom = 1) {
  const M = MODELS[modelId];
  const parts = M.parts();
  const SW = SPR_W * zoom, SH = SPR_H * zoom;
  const P = new Pix(SW, SH);
  const c = Math.cos(ang), s = Math.sin(ang);
  const dl = [c + s, -s + c, 1];
  const best = {};
  const depth = new Float32Array(SW * SH).fill(-1e9), part = new Int16Array(SW * SH).fill(-1);
  for (let py = 0; py < SH; py++) for (let px = 0; px < SW; px++) {
    const i = (px - SPR_OX * zoom + 0.5) / zoom, j = (py - SPR_OY * zoom + 0.5) / zoom;
    const wx = i / 2, wy = -i / 2, wz = -j;
    const o = [wx * c + wy * s, -wx * s + wy * c, wz];
    if (!trace(parts, o, dl, best)) continue;
    const n = best.n;
    const nw = [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
    const lp = [o[0] + dl[0] * best.t, o[1] + dl[1] * best.t, o[2] + dl[2] * best.t];
    const diff = Math.max(0, nw[0] * LX + nw[1] * LY + nw[2] * LZ);
    let I = 0.44 + 0.74 * diff;
    let col = matColor(best.mat, pal, lp, n[2], M.stripe);
    const spec = Math.max(0, nw[0] * HV[0] + nw[1] * HV[1] + nw[2] * HV[2]);
    if (best.mat === 'glass') {
      I = 0.7 + 0.4 * diff;
      const streak = ((lp[0] * 0.9 + lp[2] * 1.3 + lp[1] * 0.2) % 4 + 4) % 4;
      if (spec > 0.8 || streak < 0.7) col = mix(col, 0x9cc6ee, spec > 0.92 ? 0.85 : 0.45);
    } else if (best.mat === 'light' || best.mat === 'spot' || best.mat === 'tail') I = Math.max(I, 1.0);
    else if (best.mat === 'tire') { I = 0.6 + 0.4 * diff; if (best.tread && hash(Math.floor(Math.atan2(n[2], n[0]) * 4), 0, 3) > 0.5) col = 0x302e36; }
    let out = shade(col, I, px, py, 0.35);
    if ((best.mat === 'paint' || best.mat === 'paint2' || best.mat === 'chrome') && spec > 0.965) out = mix(out, 0xffffff, 0.7);
    P.px(px, py, out);
    depth[py * SW + px] = best.t; part[py * SW + px] = best.k;
  }
  // bläckkant där en närmare del möter en bortre
  const d = P.d;
  for (let py = 0; py < SH; py++) for (let px = 0; px < SW; px++) {
    const k = py * SW + px;
    if (part[k] < 0) continue;
    for (const [ox, oy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const xx = px + ox, yy = py + oy;
      if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
      const kk = yy * SW + xx;
      if (part[kk] >= 0 && part[kk] !== part[k] && depth[kk] > depth[k] + 1.6) {
        const i4 = k * 4; d[i4] *= 0.62; d[i4 + 1] *= 0.6; d[i4 + 2] *= 0.68; break;
      }
    }
  }
  P.outline();
  return P.flush();
}

// Skugga på marken (sett från ljuset), samma origo som bilspriten.
export const SH_W = 64, SH_H = 40;
export function renderShadow(modelId, ang) {
  const parts = MODELS[modelId].parts();
  const P = new Pix(SH_W, SH_H);
  const c = Math.cos(ang), s = Math.sin(ang);
  const dl = [LX * c + LY * s, -LX * s + LY * c, LZ];
  const best = {};
  for (let py = 0; py < SH_H; py++) for (let px = 0; px < SH_W; px++) {
    const i = px - SPR_OX + 0.5, j = py - SPR_OY + 0.5;
    const gx = j + i / 2, gy = j - i / 2;
    const o = [gx * c + gy * s, -gx * s + gy * c, 0];
    if (trace(parts, o, dl, best) && best.t > 0) P.px(px, py, 0x140c1e, 0.38);
  }
  return P.flush();
}

// Utbränt vrak: samma sprite, mörk och sotig
export function burnt(canvas) {
  const P = new Pix(canvas.width, canvas.height);
  P.ctx.drawImage(canvas, 0, 0);
  const img = P.ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = (d[i] * 0.3 + d[i + 1] * 0.5 + d[i + 2] * 0.2) / 255;
    const h = hash(i >> 2, 0, 9);
    const cc = h > 0.93 ? mix(0x3a2a22, 0xd0601a, l) : mix(0x16141a, 0x5a5660, l * 0.9);
    d[i] = cc >> 16 & 255; d[i + 1] = cc >> 8 & 255; d[i + 2] = cc & 255;
  }
  P.ctx.putImageData(img, 0, 0);
  return P.canvas;
}

export const CAR_COLORS = [0xd8282c, 0x2a5ad8, 0xf2c21c, 0x26a24a, 0xe8e8ee, 0x2c2a36, 0xf27a18, 0x8a3ad2, 0x1eb4c8, 0xe2609e];
export const ramps = (c) => ramp(c);
