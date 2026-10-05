// Rekvisita som sprites: träd, buskar, stenar, koner, däckväggar, räcken, startportal, läktare,
// upplockningsbara saker, minor och oljefläckar. Allt målas i kod, ljus från vänster uppe.
import { Pix, mix, mul, hash, shade, bayer, ramp, eachTextPixel, BIG, SMALL, textW } from './pix.js?v=1';
import { LX, LY, LZ, isoX, isoY } from './iso.js?v=1';
import { renderParts, box } from './carsprites.js?v=1';

const SQ3 = Math.sqrt(3);
// Klumpar (sfärer, z-skala) strålföljda med samma ljus som allt annat.
function clumps(P, ox, oy, list, colors, seed, rough = 0.38) {
  const R = colors;
  for (let py = 0; py < P.h; py++) for (let px = 0; px < P.w; px++) {
    const i = px - ox + 0.5, j = py - oy + 0.5;
    const o = [i / 2, -i / 2, -j];
    let bt = -1e9, bn = null, bk = -1;
    for (let k = 0; k < list.length; k++) {
      const c = list[k], zs = c.zs || 1;
      const ox2 = o[0] - c.x, oy2 = o[1] - c.y, oz2 = (o[2] - c.z) / zs, dz = 1 / zs;
      const a = 2 + dz * dz, b = 2 * (ox2 + oy2 + oz2 * dz), cc = ox2 * ox2 + oy2 * oy2 + oz2 * oz2 - c.r * c.r;
      const disc = b * b - 4 * a * cc;
      if (disc < 0) continue;
      const t = (-b + Math.sqrt(disc)) / (2 * a);
      if (t > bt) { bt = t; bk = k; bn = [(ox2 + t) / c.r, (oy2 + t) / c.r, (oz2 + t * dz) / c.r / zs]; }
    }
    if (bk < 0) continue;
    const h1 = hash(px >> 1, py >> 1, seed + bk * 7), h2 = hash(px >> 1, py >> 1, seed + 99);
    let nx = bn[0] + (h1 - 0.5) * rough, ny = bn[1] + (h2 - 0.5) * rough, nz = bn[2] + (hash(px, py, seed) - 0.5) * rough * 0.6;
    const l = Math.hypot(nx, ny, nz) || 1;
    const d = (nx * LX + ny * LY + nz * LZ) / l;
    const v = d + (bayer(px, py) - 0.5) * 0.18;
    const col = v > 0.62 ? R.hi : v > 0.25 ? R.base : v > -0.15 ? R.lo : R.dk;
    P.px(px, py, col);
  }
}
const leafR = (base, hiTint = 0xfff0a0) => ({ hi: mix(mul(base, 1.35), hiTint, 0.18), base, lo: mix(mul(base, 0.7), 0x1a2a3a, 0.15), dk: mix(mul(base, 0.45), 0x101820, 0.3) });

function trunk(P, ox, oy, h, w, col, birch = false) {
  const r = ramp(col);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = x === 0 ? r.hi : x === w - 1 ? r.lo : r.base;
    if (birch && hash(x, (y / 2) | 0, 5) > 0.72) c = 0x2a262c;
    P.px(ox - (w >> 1) + x, oy - y, c);
  }
  P.px(ox - (w >> 1) - 1, oy, r.lo); P.px(ox + (w - (w >> 1)), oy, r.dk);
}

function sprite(w, h, ox, oy, fn) {
  const P = new Pix(w, h);
  fn(P);
  return { cv: P.flush(), ox, oy, w, h };
}

const TREES = {
  lov: (v, th) => sprite(36, 44, 18, 40, (P) => {
    trunk(P, 18, 40, 15, 3, 0x5e4232);
    const n = 6 + v;
    const list = [{ x: 0, y: 0, z: 22, r: 8.5 }];
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + v, rr = 5 + hash(k, v, 3) * 2;
      list.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, z: 18 + hash(k, v, 4) * 8, r: 4.2 + hash(k, v, 5) * 2 });
    }
    list.push({ x: -1, y: 1, z: 28, r: 5 });
    clumps(P, 18, 40, list, leafR(th.ground === 'snow' ? 0x3a6a3a : 0x3e8c30), 11 + v);
    P.outline();
  }),
  bjork: (v, th) => sprite(30, 46, 15, 42, (P) => {
    trunk(P, 15, 42, 20, 2, 0xe8e4dc, true);
    const list = [];
    for (let k = 0; k < 7; k++) list.push({ x: (hash(k, v, 6) - 0.5) * 7, y: (hash(k, v, 7) - 0.5) * 7, z: 22 + k * 1.8 + hash(k, v, 8) * 2, r: 3.4 + hash(k, v, 9) * 1.8 });
    clumps(P, 15, 42, list, leafR(0x78b03c, 0xffff90), 21 + v, 0.5);
    P.outline();
  }),
  gran: (v, th) => pine(v, th, false),
  snogran: (v, th) => pine(v, th, true),
  buske: (v, th) => sprite(22, 16, 11, 13, (P) => {
    const list = [];
    for (let k = 0; k < 5; k++) list.push({ x: (hash(k, v, 6) - 0.5) * 8, y: (hash(k, v, 7) - 0.5) * 6, z: 3 + hash(k, v, 8) * 2, r: 3 + hash(k, v, 9) * 1.6 });
    clumps(P, 11, 13, list, leafR(th.ground === 'sand' ? 0x7a8434 : th.ground === 'snow' ? 0x3c6648 : 0x3a7e2e), 31 + v);
    if (th.ground === 'snow') for (let y = 0; y < 16; y++) for (let x = 0; x < 22; x++) if (P.alpha(x, y) && !P.alpha(x, y - 2) && hash(x, y, 8) > 0.35) P.px(x, y, (x < 11 ? 0xf6f9ff : 0xc8d6ec));
    P.outline();
  }),
  kaktus: (v) => sprite(20, 30, 10, 27, (P) => {
    const R = { hi: 0x8ed06a, base: 0x4f9a3c, lo: 0x2f6a2e, dk: 0x1c4220 };
    const col = (x0, y0, w, h) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const top = y < 1 && (x === 0 || x === w - 1);
        if (top) continue;
        let c = x === 0 ? R.hi : x >= w - 1 ? R.dk : x === w - 2 ? R.lo : R.base;
        if (x > 0 && x < w - 2 && (x & 1) === 0) c = mix(c, R.lo, 0.5);
        P.px(x0 + x, y0 + y, c);
      }
    };
    const h = 20 + v * 2;
    col(8, 27 - h, 5, h);
    if (v !== 1) { col(3, 27 - h + 6, 3, 8); col(4, 27 - h + 12, 5, 2); }
    if (v !== 2) { col(14, 27 - h + 3, 3, 9); col(12, 27 - h + 10, 4, 2); }
    if (v === 3) P.px(10, 27 - h, 0xf06aa0);
    P.outline();
  }),
  torr: (v) => sprite(28, 36, 14, 33, (P) => {
    const c1 = 0x7a6450, c2 = 0x4e3e32;
    trunk(P, 14, 33, 16, 2, 0x7a6450);
    const br = (x, y, dx, dy, n) => { for (let k = 0; k < n; k++) { P.px(x + dx * k, y + dy * k, k < 2 ? c1 : c2); } };
    br(14, 18, -1, -1, 7); br(15, 16, 1, -1, 8); br(14, 12, 0, -1, 6); br(11, 15, -1, 0, 3); br(19, 12, 1, 0, 3);
    br(9, 13, -1, -1, 3); br(21, 10, 1, -1, 3);
    P.outline();
  }),
  hostlov: (v) => sprite(36, 44, 18, 40, (P) => {
    trunk(P, 18, 40, 15, 3, 0x5e4232);
    const n = 6 + (v & 1);
    const list = [{ x: 0, y: 0, z: 22, r: 8.2 }];
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + v * 1.7, rr = 5 + hash(k, v, 13) * 2;
      list.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, z: 18 + hash(k, v, 14) * 8, r: 4 + hash(k, v, 15) * 2 });
    }
    list.push({ x: -1, y: 1, z: 28, r: 5 });
    clumps(P, 18, 40, list, leafR([0xd86a2a, 0xc0302a, 0xe8b030, 0x9a9a2e][v & 3], 0xfff0a0), 51 + v, 0.45);
    // några löv på marken
    for (let k = 0; k < 10; k++) { const x = 8 + hash(k, v, 16) * 20 | 0, y = 38 + hash(k, v, 17) * 4 | 0; if (!P.alpha(x, y)) P.px(x, y, [0xd86a2a, 0xe8b030, 0xc0302a][k % 3]); }
    P.outline();
  }),
  palm: (v) => sprite(44, 54, 22, 50, (P) => {
    const lean = (v & 1 ? 1 : -1) * (5 + v);
    const H = 30 + (v & 2) * 2;
    let tx = 22, ty = 50 - H;
    for (let y = 0; y < H; y++) {
      const t = y / H, x = Math.round(22 + lean * t * t), yy = 50 - y, w = y > H - 8 ? 2 : 3;
      for (let k = 0; k < w; k++) {
        let c = k === 0 ? 0xb08a5a : k === w - 1 ? 0x5a4430 : 0x8a6a44;
        if (y % 3 === 0) c = mul(c, 0.78);
        P.px(x - 1 + k, yy, c);
      }
      if (y === H - 1) { tx = x; ty = yy; }
    }
    const R = leafR(0x3a9a34, 0xe0ff90);
    const fronds = 8;
    for (let f = 0; f < fronds; f++) {
      const a = (f / fronds) * Math.PI * 2 + v * 0.4;
      const dx = Math.cos(a), dy = Math.sin(a) * 0.55, L = 12 + hash(f, v, 3) * 5;
      const col = dy < -0.15 ? R.hi : dx < -0.3 ? R.base : dy > 0.2 ? R.lo : R.base;
      for (let s = 0; s <= L; s += 0.5) {
        const x = tx + dx * s, y = ty + dy * s + (s / L) ** 2 * 7 - 1;
        P.px(x, y, col); P.px(x, y + 1, s > L * 0.7 ? R.dk : R.lo);
        if (((s * 2) | 0) % 2 === 0 && s > 2) { P.px(x - dy * 2, y + dx * 1.2, col); P.px(x + dy * 2, y + 1 - dx * 1.2 + 1, R.lo); }
      }
    }
    P.rect(tx - 2, ty, 2, 2, 0x6a4a2a); P.rect(tx, ty + 1, 2, 2, 0x5a3e22); P.px(tx - 2, ty, 0x9a7044);
    P.outline();
  }),
  lampa: (v, th) => sprite(18, 42, 7, 39, (P) => {
    const moon = th.ground === 'moon';
    for (let y = 0; y < 30; y++) { P.px(6, 38 - y, 0xb8bcc8); P.px(7, 38 - y, 0x7a7e8c); }
    P.rect(5, 37, 4, 2, 0x4a4c58);
    for (let x = 0; x < 6; x++) P.px(8 + x, 9 - (x < 2 ? 0 : 1), 0x8a8e9c);
    P.rect(11, 8, 5, 2, 0x3a3c48);
    P.rect(11, 10, 5, 1, moon ? 0x9cf0ff : 0xfff2c0);
    if (moon) P.px(13, 7, 0xff4040);
    P.outline();
  }),
  bal: (v) => {
    const parts = [{ t: 'cyl', c: [0, 0, 4.2], r: 4.2, hw: 3.2, mat: 'hay', ax: 1 }];
    const cv = renderParts(parts, v * 0.9, 26, 22, 13, 15, (mat, lp, n, px, py, best) => {
      if (best && best.face) return ((best.rr * 5) % 1) < 0.35 ? 0xb89a48 : 0xe2c870;
      return hash(px, py >> 1, 4) > 0.6 ? 0xd4b45a : 0xe8cf7a;
    });
    return { cv, ox: 13, oy: 15, w: 26, h: 22 };
  },
  sten: (v, th) => sprite(24, 16, 12, 13, (P) => {
    const base = th.ground === 'sand' ? 0xa45a3c : th.ground === 'snow' ? 0x767c90 : 0x8a8890;
    const list = [{ x: 0, y: 0, z: 2.4, r: 5 + v * 0.4, zs: 0.62 }, { x: 2.4, y: -1.8, z: 2, r: 3.4, zs: 0.7 }, { x: -2, y: 2.2, z: 1.6, r: 3, zs: 0.7 }];
    clumps(P, 12, 13, list, { hi: mix(mul(base, 1.25), 0xfff4e0, 0.15), base, lo: mul(base, 0.72), dk: mix(mul(base, 0.48), 0x1a1426, 0.25) }, 41 + v, 0.55);
    if (th.ground === 'snow') for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) if (P.alpha(x, y) && !P.alpha(x, y - 2) && hash(x, y, 7) > 0.3) P.px(x, y, 0xeef2fa);
    P.outline();
  }),
};
function pine(v, th, snowy) {
  const H = 34 + v * 2;
  return sprite(28, 46, 14, 42, (P) => {
    trunk(P, 14, 42, 6, 2, 0x4a3428);
    const R = leafR(snowy ? 0x24563e : 0x23603a, 0xd8ff90);
    const tiers = 5, top = 42 - H;
    for (let y = top; y < 42 - 4; y++) {
      const g = (y - top) / (H - 4);
      const tl = (H - 4) / tiers, tf = ((y - top) % tl) / tl;
      const hw = (1 + g * 9.5) * (0.5 + 0.5 * tf);
      for (let x = Math.floor(14 - hw); x <= Math.ceil(14 + hw); x++) {
        const rel = (x - 14) / Math.max(1, hw);
        if (Math.abs(rel) > 0.85 && hash(x, y, 9 + v) > 0.55) continue;
        let c = rel < -0.35 ? R.hi : rel < 0.2 ? R.base : rel < 0.6 ? R.lo : R.dk;
        if (tf > 0.82) c = rel < 0 ? R.lo : R.dk;
        if (hash(x, y, 13 + v) > 0.86) c = mix(c, R.dk, 0.5);
        if (snowy && tf < 0.45 && rel < 0.45 && hash(x, y, 17) > 0.25) c = rel < -0.2 ? 0xf6f9ff : 0xc8d6ec;
        P.px(x, y, c);
      }
    }
    P.outline();
  });
}

const cache = new Map();
export function treeSprite(kind, v, th) {
  const key = kind + v + th.ground;
  if (!cache.has(key)) cache.set(key, TREES[kind](v, th));
  return cache.get(key);
}
export const TREE_RADIUS = { lov: 4, bjork: 3, gran: 4, snogran: 4, buske: 0, kaktus: 2.5, torr: 2.5, sten: 5, hostlov: 4, palm: 2.5, lampa: 1.5, bal: 4.5 };

export const CONE = sprite(9, 11, 4, 9, (P) => {
  P.rect(1, 8, 7, 2, 0x2a2228); P.rect(1, 8, 7, 1, 0x3c343a);
  const rows = [[4, 1], [4, 1], [3, 3], [3, 3], [3, 3], [2, 5], [2, 5], [2, 5]];
  rows.forEach(([x, w], y) => { for (let k = 0; k < w; k++) { let c = k === 0 ? 0xffb050 : k === w - 1 ? 0xb8400e : 0xf0701a; if (y === 3 || y === 4) c = k === 0 ? 0xffffff : k === w - 1 ? 0xb8b4c0 : 0xeeeef2; P.px(x + k, y + 1, c); } });
  P.outline();
});
export const CONE_DOWN = sprite(12, 7, 6, 5, (P) => {
  for (let k = 0; k < 7; k++) { const c = k === 3 || k === 4 ? 0xeeeef2 : 0xf0701a; P.px(3 + k, 3, c); P.px(3 + k, 4, mul(c, 0.7)); if (k > 3) P.px(3 + k, 2, mix(c, 0xffffff, 0.2)); }
  P.px(2, 3, 0x2a2228); P.px(2, 4, 0x2a2228);
  P.outline();
});
export const TIRES = sprite(14, 16, 7, 13, (P) => {
  for (let t = 0; t < 3; t++) {
    const cy = 11 - t * 3.4, red = (t & 1);
    for (let y = -3; y <= 3; y++) for (let x = -6; x <= 6; x++) {
      const e = (x / 6.2) ** 2 + (y / 2.6) ** 2;
      if (e > 1) continue;
      let c = e < 0.3 ? 0x141218 : 0x2a2830;
      if (e > 0.3 && e < 0.62 && y <= 0) c = red ? 0xd03030 : 0xf0eee8;
      if (x < -3 && e > 0.6) c = 0x3a3842;
      P.px(7 + x, Math.round(cy + y), c);
    }
  }
  P.outline();
});

// Räckessegment mellan två världspunkter (z = vägens höjd). Returnerar sprite med ankare i mittpunkten.
export function railSprite(ax, ay, az, bx, by, bz, color = 0x9aa8b8) {
  const sa = [isoX(ax, ay), isoY(ax, ay, az)], sb = [isoX(bx, by), isoY(bx, by, bz)];
  const x0 = Math.floor(Math.min(sa[0], sb[0])) - 2, x1 = Math.ceil(Math.max(sa[0], sb[0])) + 2;
  const y0 = Math.floor(Math.min(sa[1], sb[1])) - 8, y1 = Math.ceil(Math.max(sa[1], sb[1])) + 2;
  const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
  const ox = Math.round(isoX(mx, my)) - x0, oy = Math.round(isoY(mx, my, mz)) - y0;
  return sprite(x1 - x0 + 1, y1 - y0 + 1, ox, oy, (P) => {
    const R = ramp(color);
    const n = Math.max(1, Math.ceil(Math.abs(sb[0] - sa[0])));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = Math.round(sa[0] + (sb[0] - sa[0]) * t) - x0, y = sa[1] + (sb[1] - sa[1]) * t - y0;
      P.px(x, Math.round(y - 5), R.hi); P.px(x, Math.round(y - 4), R.base); P.px(x, Math.round(y - 3), R.lo);
    }
    for (const s of [sa]) { const x = Math.round(s[0]) - x0, y = Math.round(s[1]) - y0; for (let k = 0; k < 6; k++) P.px(x, y - k, k > 2 ? 0x4a4e5a : 0x6a6e7a); P.px(x + 1, y - 1, 0x2a2830); }
  });
}

// Startportal med banderoll tvärs över vägen (världspunkter för stolparnas fötter).
export function gantrySprite(lx, ly, rx, ry, z, label) {
  const H = 30, B0 = 22, B1 = 30;
  const pl = [isoX(lx, ly), isoY(lx, ly, z)], pr = [isoX(rx, ry), isoY(rx, ry, z)];
  const x0 = Math.floor(Math.min(pl[0], pr[0])) - 4, x1 = Math.ceil(Math.max(pl[0], pr[0])) + 4;
  const y0 = Math.floor(Math.min(pl[1], pr[1])) - H - 4, y1 = Math.ceil(Math.max(pl[1], pr[1])) + 2;
  const mx = (lx + rx) / 2, my = (ly + ry) / 2;
  const ox = Math.round(isoX(mx, my)) - x0, oy = Math.round(isoY(mx, my, z)) - y0;
  return sprite(x1 - x0 + 1, y1 - y0 + 1, ox, oy, (P) => {
    const A = pl[0] < pr[0] ? pl : pr, Bp = pl[0] < pr[0] ? pr : pl;
    const n = Math.round(Bp[0] - A[0]);
    const w = textW(SMALL, label);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = Math.round(A[0] + k) - x0, yb = A[1] + (Bp[1] - A[1]) * t - y0;
      for (let v = B0; v <= B1; v++) {
        const y = Math.round(yb - v);
        let c = v === B0 || v === B1 ? 0x1c1a22 : v === B1 - 1 ? 0xf2f0ea : (v === B0 + 1 ? 0x9a1e24 : 0xc8262e);
        if (k < 6 || k > n - 6) c = (((k >> 1) + (v >> 1)) & 1) ? 0x1c1a22 : 0xf2f0ea;
        P.px(x, y, c);
      }
    }
    // text längs banderollen
    const start = Math.round((n - w) / 2);
    eachTextPixel(SMALL, label, 0, 0, 1, (tx, ty) => {
      const k = start + tx, t = k / n;
      if (k < 7 || k > n - 7) return;
      const x = Math.round(A[0] + k) - x0, yb = A[1] + (Bp[1] - A[1]) * t - y0;
      P.px(x, Math.round(yb - (B1 - 2) + ty), 0xfff2c0);
    });
    for (const p of [pl, pr]) {
      const x = Math.round(p[0]) - x0, y = Math.round(p[1]) - y0;
      for (let k = 0; k <= H + 1; k++) { P.px(x - 1, y - k, 0xd8dce4); P.px(x, y - k, 0xa0a6b4); P.px(x + 1, y - k, 0x5a5e6c); }
      P.rect(x - 2, y - 1, 5, 2, 0x3a3c46);
    }
    P.outline();
  });
}

// Läktare längs vägen: ang = vägens riktning, side = åt vilket håll läktaren stiger.
export function standSprite(ang, len, side) {
  const parts = [];
  for (let k = 0; k < 4; k++) parts.push(box(-len / 2, len / 2, side > 0 ? k * 4 : -(k + 1) * 4, side > 0 ? (k + 1) * 4 : -k * 4, 0, 3 + k * 3.2, 'seat'));
  const yb = side > 0 ? 16 : -16;
  parts.push(box(-len / 2, len / 2, side > 0 ? 16 : -18, side > 0 ? 18 : -16, 0, 20, 'wall'));
  parts.push(box(-len / 2 - 1, len / 2 + 1, side > 0 ? -1 : -19, side > 0 ? 19 : 1, 20, 21.5, 'roof'));
  for (const x of [-len / 2 + 1, 0, len / 2 - 1]) parts.push(box(x - 0.6, x + 0.6, side > 0 ? -0.6 : -0.6, side > 0 ? 0.6 : 0.6, 0, 20, 'post'));
  void yb;
  const W = Math.ceil(len * 1.5 + 60), H = Math.ceil(len * 0.8 + 70);
  const cv = renderParts(parts, ang, W, H, W >> 1, H - 30, (mat, lp, n, px, py) => {
    if (mat === 'seat') {
      if (n[2] > 0.5) { const h = hash(px, py >> 1, 3); return (py & 1) ? [0xf2c8a0, 0xd8a078, 0x8a5a3a, 0xf4d2b0][(h * 4) | 0] : [0xd8282c, 0x2a5ad8, 0xf2c21c, 0xe8e8ee, 0x26a24a, 0xf27a18][(h * 6) | 0]; }
      return 0xb8b4ac;
    }
    if (mat === 'roof') return (Math.floor(lp[0] / 4) & 1) ? 0xd03030 : 0xf0eee8;
    if (mat === 'wall') return 0x9c968c;
    return 0x6a6e7a;
  });
  return { cv, ox: W >> 1, oy: H - 30, w: W, h: H };
}

// Upplockningsbara saker: symbol på en lysande skiva
function disc(sym, col, ring) {
  return sprite(15, 15, 7, 7, (P) => {
    P.ell(7.5, 7.5, 7.4, 7.4, col, 0.35, 3);
    for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
      const r = Math.hypot(x - 7, y - 7);
      if (r > 5.6) continue;
      let c = r > 4.6 ? ring : mix(col, 0xffffff, 0.15);
      if (r <= 4.6 && x + y < 11) c = mix(col, 0xffffff, 0.35);
      if (r <= 4.6 && x + y > 17) c = mul(col, 0.8);
      P.px(x, y, c);
    }
    sym(P);
  });
}
export const PICKUPS = {
  pengar: disc((P) => { const c = 0x5a3a00; ['.##.', '#...', '.##.', '...#', '.##.'].forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && P.px(5 + x, 5 + y, c))); P.px(6, 4, c); P.px(6, 10, c); }, 0xf6c834, 0xa86e0a),
  reparera: disc((P) => { const c = 0xffffff; for (let k = 0; k < 5; k++) P.px(5 + k, 9 - k, c); P.px(4, 10, c); P.px(5, 10, c); P.px(9, 3, c); P.px(10, 4, c); P.px(10, 3, 0x3060c0); }, 0x3a8cf0, 0x1a4a9a),
  nitro: disc((P) => { const c = 0xffffff; for (let y = 0; y < 5; y++) { P.px(5, 5 + y, c); P.px(9, 5 + y, c); P.px(6 + Math.min(2, y * 0.6 | 0), 5 + y, c); } P.px(7, 7, c); P.px(8, 8, c); }, 0xe8402c, 0x8a1a12),
  ammo: disc((P) => { for (const x of [5, 7, 9]) { P.px(x, 5, 0xfff2b0); for (let y = 6; y < 10; y++) P.px(x, y, 0xe8b032); } }, 0x3aa84a, 0x1a6a2a),
};
export const MINE = [false, true].map((on) => sprite(9, 6, 4, 3, (P) => {
  for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) { const e = ((x - 4) / 4.2) ** 2 + ((y - 2.5) / 2.2) ** 2; if (e <= 1) P.px(x, y, e > 0.6 ? 0x2a2830 : y < 2 ? 0x6a6874 : 0x45434e); }
  P.px(4, 1, on ? 0xff3020 : 0x6a1a14); if (on) P.px(4, 0, 0xffa090, 0.6);
}));
export function glueSprite(seed) {
  return sprite(40, 22, 20, 11, (P) => {
    for (let y = 0; y < 22; y++) for (let x = 0; x < 40; x++) {
      const e = ((x - 20) / 18) ** 2 + ((y - 11) / 9) ** 2 + (hash(x >> 2, y >> 1, seed + 5) - 0.5) * 0.4;
      if (e > 1) continue;
      let c = e > 0.82 ? 0xb8c43a : 0xd8e45a;
      if (hash(x, y, seed) > 0.93) c = 0xf4fca0;
      if (Math.sin(x * 0.7 + y * 1.1 + seed) > 0.9 && e < 0.6) c = 0xfaffd0;
      P.px(x, y, c, 0.9);
    }
  });
}
export const STUMP = sprite(14, 10, 7, 7, (P) => {
  for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) P.px(4 + x, 3 + y, x === 0 ? 0x8a6448 : x === 5 ? 0x4a3426 : 0x6a4c36);
  for (let x = 0; x < 6; x++) P.px(4 + x, 2, x === 0 || x === 5 ? 0xb89a6a : 0xd8bc8a);
  P.px(6, 2, 0x9a7a52); P.px(7, 2, 0xc8a878);
  P.px(2, 7, 0x4a3426); P.px(3, 7, 0x5a3e2c); P.px(10, 7, 0x4a3426);
  P.outline();
});
export const BARREL = sprite(10, 13, 5, 11, (P) => {
  for (let y = 0; y < 10; y++) for (let x = 0; x < 7; x++) {
    let c = x === 0 ? 0xf05a3a : x >= 5 ? 0x8a1c14 : 0xd2341e;
    if (y === 2 || y === 7) c = x === 0 ? 0xc8ccd4 : x >= 5 ? 0x5a5e6a : 0x9a9eaa;
    if (y >= 4 && y <= 5 && x > 0 && x < 6) c = ((x + y) & 1) ? 0x1c1a20 : 0xf2c21c;
    P.px(1 + x, 1 + y, c);
  }
  for (let x = 0; x < 7; x++) P.px(1 + x, 0, x === 0 || x === 6 ? 0x6a1810 : 0xa82418);
  P.outline();
});
export function oilSprite(seed) {
  return sprite(40, 22, 20, 11, (P) => {
    for (let y = 0; y < 22; y++) for (let x = 0; x < 40; x++) {
      const e = ((x - 20) / 18) ** 2 + ((y - 11) / 9) ** 2 + (hash(x >> 2, y >> 1, seed) - 0.5) * 0.4;
      if (e > 1) continue;
      let c = 0x141218;
      const s = Math.sin(x * 0.5 - y * 0.8 + seed);
      if (s > 0.85 && e < 0.7) c = [0x3a2a6a, 0x2a5a4a, 0x6a3a5a][(x + y) % 3];
      if (e > 0.85) c = 0x24222a;
      P.px(x, y, c, 0.92);
    }
  });
}
