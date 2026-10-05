// Bygger terrängen för en bana: höjdkarta (1 enhet/cell), material, trädskuggor och rekvisita.
// Körs i terrängarbetaren. Regler:
//  - marken följer vägens höjd nära vägen och böljar fritt längre bort
//  - sjöar/åar skär ner till vatten, med klippor eller strand
//  - vägkorridoren planas ut; utanför blir det slänter (fyllning/skärning)
//  - vägen ska ALLTID synas: inget får sticka upp framför den i iso-vyn (taket C)
//  - skog = kronor i höjdkartan (renderas som terräng), enstaka träd längs vägen = sprites
import { buildTrack, nearest } from './trackgeo.js?v=1';
import { fbm, vnoise } from './noise.js?v=1';
import { hash, sm } from './pix.js?v=1';
import { THEMES } from './tracks.js?v=1';
import { SHX, SHY } from './iso.js?v=1';

export const MAT = { LAND: 0, WATER: 1, LEAF: 2, ROCK: 3, SAND: 4, PILLAR: 5 };
export const DECK = 0x80;

// Närmaste banpunkt per 2×2-cell via exakt avståndstransform (Felzenszwalb) med argmin.
function dt1(f, n, d, arg, v, z) {
  const INF = 1e20;
  let k = -1;
  for (let q = 0; q < n; q++) {
    if (f[q] >= INF) continue;
    if (k < 0) { k = 0; v[0] = q; z[0] = -INF; z[1] = INF; continue; }
    let s;
    for (;;) {
      const p = v[k];
      s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
      if (s <= z[k] && k > 0) k--; else break;
    }
    if (s <= z[k]) { v[k] = q; z[k + 1] = INF; continue; }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  if (k < 0) { for (let q = 0; q < n; q++) { d[q] = INF; arg[q] = -1; } return; }
  let j = 0;
  for (let q = 0; q < n; q++) {
    while (z[j + 1] < q) j++;
    const p = v[j];
    d[q] = (q - p) * (q - p) + f[p]; arg[q] = p;
  }
}
function nearestGrid(T, GW, GH) {
  const INF = 1e20, M = Math.max(GW, GH);
  const seed = new Int32Array(GW * GH).fill(-1);
  for (let i = 0; i < T.n; i++) {
    const gx = Math.floor(T.X[i] / 2), gy = Math.floor(T.Y[i] / 2);
    if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) seed[gy * GW + gx] = i;
  }
  const colD = new Float64Array(GW * GH), colArg = new Int32Array(GW * GH);
  const f = new Float64Array(M), d = new Float64Array(M), arg = new Int32Array(M), v = new Int32Array(M), z = new Float64Array(M + 1);
  for (let x = 0; x < GW; x++) {
    for (let y = 0; y < GH; y++) f[y] = seed[y * GW + x] >= 0 ? 0 : INF;
    dt1(f, GH, d, arg, v, z);
    for (let y = 0; y < GH; y++) { colD[y * GW + x] = d[y]; colArg[y * GW + x] = arg[y]; }
  }
  const out = new Int32Array(GW * GH);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) f[x] = colD[y * GW + x];
    dt1(f, GW, d, arg, v, z);
    for (let x = 0; x < GW; x++) {
      const sx = arg[x];
      out[y * GW + x] = sx < 0 ? 0 : seed[colArg[y * GW + sx] * GW + sx];
    }
  }
  return out;
}

// Grovt rutnät + bilinjär läsning för lågfrekventa fält
function coarse(W, H, step, fn) {
  const cw = Math.ceil(W / step) + 2, ch = Math.ceil(H / step) + 2, a = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) a[j * cw + i] = fn(i * step, j * step);
  return (x, y) => {
    const fx = x / step, fy = y / step, i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * cw + i;
    return a[k] + (a[k + 1] - a[k]) * tx + (a[k + cw] - a[k]) * ty + (a[k] - a[k + 1] - a[k + cw] + a[k + cw + 1]) * tx * ty;
  };
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}
export function makeWater(def) {
  const lakes = (def.lakes || []).map((l) => ({ ...l, c: Math.cos(l.rot || 0), s: Math.sin(l.rot || 0) }));
  const rivers = def.rivers || [];
  return (x, y, wob) => {
    let best = -1e9;
    for (const l of lakes) {
      const dx = x - l.x, dy = y - l.y;
      const lx = dx * l.c + dy * l.s, ly = -dx * l.s + dy * l.c;
      const e = Math.sqrt((lx / l.rx) ** 2 + (ly / l.ry) ** 2) * (1 - wob * 0.34);
      const v = (1 - e) * Math.min(l.rx, l.ry);
      if (v > best) best = v;
    }
    for (const r of rivers) {
      let dm = 1e9;
      for (let k = 0; k + 1 < r.pts.length; k++) {
        const a = r.pts[k], b = r.pts[k + 1];
        const dd = segDist(x, y, a[0], a[1], b[0], b[1]);
        if (dd < dm) dm = dd;
      }
      const v = r.w * 0.5 * (1 + wob * 0.6) - dm;
      if (v > best) best = v;
    }
    return best;
  };
}

export function generateWorld(def) {
  const th = THEMES[def.theme];
  const T = buildTrack(def);
  const W = def.size[0], H = def.size[1], N = W * H, seed = def.seed | 0;
  const GW = W >> 1, GH = H >> 1;
  const near = nearestGrid(T, GW, GH);
  const q = {};

  const hillF = coarse(W, H, 8, (x, y) => fbm(x / 260, y / 260, seed, 4) - 0.5);
  const detF = coarse(W, H, 4, (x, y) => fbm(x / 46, y / 46, seed + 1, 3) - 0.5);
  const wobF = coarse(W, H, 4, (x, y) => fbm(x / 70, y / 70, seed + 2, 3) - 0.5);
  const shoreF = coarse(W, H, 8, (x, y) => fbm(x / 160, y / 160, seed + 3, 2));
  const mesaF = th.mesa ? coarse(W, H, 4, (x, y) => fbm(x / 190, y / 190, seed + 5, 4) + (vnoise(x / 23, y / 23, seed + 6) - 0.5) * 0.05) : null;
  const forestF = coarse(W, H, 8, (x, y) => fbm(x / 170, y / 170, seed + 7, 3));
  // jämn "vägens höjd" långt från vägen (annars blir det en kant mitt emellan två vägdelar med olika höjd)
  const zField = coarse(W, H, 16, (x, y) => {
    let sw = 0, sz = 0;
    for (let i = 0; i < T.n; i += 8) {
      const d2 = (T.X[i] - x) ** 2 + (T.Y[i] - y) ** 2;
      const w = 1 / Math.pow(d2 + 900, 1.6);
      sw += w; sz += w * T.Z[i];
    }
    return sz / sw;
  });
  const water = makeWater(def);

  // Broar: där vatten finns under vägen
  for (let i = 0; i < T.n; i++) {
    let wet = false;
    for (const o of [-1, -0.5, 0, 0.5, 1]) {
      const x = T.X[i] + T.NX[i] * T.HW[i] * o, y = T.Y[i] + T.NY[i] * T.HW[i] * o;
      if (water(x, y, wobF(Math.max(0, x), Math.max(0, y))) > -6) wet = true;
    }
    if (wet) T.flags[i] |= 1;
  }
  { // förläng broar 10 sampel åt båda håll och fyll små luckor
    const b = new Uint8Array(T.n);
    for (let i = 0; i < T.n; i++) if (T.flags[i] & 1) for (let o = -10; o <= 10; o++) b[(i + o + T.n) % T.n] = 1;
    for (let i = 0; i < T.n; i++) if (b[i]) T.flags[i] |= 1 | 6; else T.flags[i] &= ~1;
  }

  const Hm = new Float32Array(N), mat = new Uint8Array(N), C = new Float32Array(N).fill(1e9);
  const RD = new Uint8Array(N); // avstånd till vägkanten (klampat), används för träd/skog
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ci = y * W + x, X = x + 0.5, Y = y + 0.5;
      const gi = near[(y >> 1) * GW + (x >> 1)];
      const ex = T.X[gi] - X, ey = T.Y[gi] - Y;
      const est = Math.sqrt(ex * ex + ey * ey);
      let dist, zr, hw, si;
      if (est < 230) { nearest(T, X, Y, gi, 2, q); dist = q.dist; zr = q.z; hw = q.hw; si = q.i; }
      else { dist = est; zr = T.Z[gi]; hw = T.HW[gi]; si = gi; }
      RD[ci] = Math.min(255, Math.max(0, dist - hw));
      // naturlig mark
      const zb = zr + (zField(X, Y) - zr) * sm(24, 150, dist);
      let land = zb + hillF(X, Y) * th.hillAmp * 2 * sm(30, 240, dist) + detF(X, Y) * th.detAmp * 2 * sm(20, 90, dist);
      if (mesaF) {
        const mv = mesaF(X, Y);
        land += th.mesaH * (sm(th.mesa, th.mesa + 0.018, mv) + 0.6 * sm(th.mesa + 0.1, th.mesa + 0.118, mv)) * sm(60, 110, dist);
      }
      if (land < 3) land = 3;
      const wob = wobF(X, Y);
      const wd = water(X, Y, wob);
      let h, m = MAT.LAND;
      const cliffy = shoreF(X, Y) < th.cliffShore;
      if (wd > 0) { h = -2.4 - Math.min(wd, 50) * 0.12; m = MAT.WATER; }
      else if (cliffy) { h = land; if (-wd < 3) m = MAT.ROCK; }
      else {
        const b = sm(0, th.beach, -wd);
        h = 0.5 + (land - 0.5) * b;
        if (-wd < th.beach * 0.55) m = MAT.SAND;
      }
      // vägkorridoren
      const bridge = T.flags[si] & 1;
      const core = hw + 7;
      if (bridge && dist < hw + 5) {
        m = (m === MAT.WATER ? MAT.WATER : MAT.LAND) | DECK;
        if ((m & 15) === MAT.WATER) h = Math.min(h, zr - 8); else h = Math.min(h, zr);
        C[ci] = zr;
      } else if (bridge && m === MAT.WATER) {
        // vattnet bredvid bron lämnas orört
      } else if (dist < core) {
        h = zr; m = MAT.LAND; if (dist < hw + 8) C[ci] = zr;
      } else if (dist < core + 160) {
        const e = dist - core;
        if (h < zr) h = Math.max(h, zr - e * th.fill);
        else h = Math.min(h, zr + e * th.cut);
        if (m === MAT.WATER && h > 0.2) m = MAT.ROCK;
        if (dist < hw + 8) C[ci] = Math.min(C[ci], zr);
      }
      Hm[ci] = h; mat[ci] = m;
    }
  }
  // brofundament (pelare)
  for (let i = 0; i < T.n; i += 24) {
    if (!(T.flags[i] & 1)) continue;
    let landNear = false;
    for (let o = -8; o <= 8; o += 4) if (!(T.flags[(i + o + T.n) % T.n] & 1)) landNear = true;
    if (landNear) continue;
    for (const side of [-1, 1]) {
      const px = T.X[i] + T.NX[i] * side * (T.HW[i] - 5), py = T.Y[i] + T.NY[i] * side * (T.HW[i] - 5);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 9) continue;
        const x = Math.floor(px + dx), y = Math.floor(py + dy);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const ci = y * W + x;
        if (Hm[ci] < T.Z[i] - 4.6) { Hm[ci] = T.Z[i] - 4.6; mat[ci] = MAT.PILLAR | DECK; }
      }
    }
  }
  // Synlighetstaket: ingenting framför (+x+y) vägen får skymma den.
  for (let y = 1; y < H; y++) {
    const r = y * W, rp = (y - 1) * W;
    for (let x = 1; x < W; x++) { const c = C[rp + x - 1] + 1; if (c < C[r + x]) C[r + x] = c; }
  }
  for (let ci = 0; ci < N; ci++) {
    if ((mat[ci] & DECK) || RD[ci] < 8) continue;
    if (Hm[ci] > C[ci] - 0.5) Hm[ci] = C[ci] - 0.5;
  }

  // Räcken där vägen går längs ett stup
  {
    const add = new Uint8Array(T.n);
    for (let i = 0; i < T.n; i++) for (const [side, bit] of [[1, 2], [-1, 4]]) {
      let low = 1e9;
      for (const e of [9, 13, 18]) {
        const x = Math.floor(T.X[i] + T.NX[i] * side * (T.HW[i] + e)), y = Math.floor(T.Y[i] + T.NY[i] * side * (T.HW[i] + e));
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const h = Hm[y * W + x]; if (h < low) low = h;
      }
      if (low < T.Z[i] - 4.5) add[i] |= bit;
    }
    for (let i = 0; i < T.n; i++) if (add[i]) for (let o = -8; o <= 8; o++) T.flags[(i + o + T.n) % T.n] |= add[i];
  }

  // Skog: trädkronor som höjd i kartan
  const objects = [];
  const shadow = new Uint8Array(N);
  const slopeAt = (x, y) => {
    const a = Hm[y * W + Math.max(0, x - 3)], b = Hm[y * W + Math.min(W - 1, x + 3)];
    const c = Hm[Math.max(0, y - 3) * W + x], d = Hm[Math.min(H - 1, y + 3) * W + x];
    return Math.abs(a - b) + Math.abs(c - d);
  };
  if (th.forest < 1) {
    const canopy = new Float32Array(N);
    const S = 8;
    for (let gy = 0; gy < H / S; gy++) for (let gx = 0; gx < W / S; gx++) {
      const cx = gx * S + 4 + (hash(gx, gy, seed + 21) - 0.5) * 6, cy = gy * S + 4 + (hash(gx, gy, seed + 22) - 0.5) * 6;
      const ix = cx | 0, iy = cy | 0;
      if (ix < 4 || iy < 4 || ix >= W - 4 || iy >= H - 4) continue;
      const ci = iy * W + ix;
      if (mat[ci] !== MAT.LAND || RD[ci] < 36) continue;
      if (forestF(cx, cy) + (hash(gx, gy, seed + 23) - 0.5) * 0.05 < th.forest) continue;
      if (slopeAt(ix, iy) > 5) continue;
      const g = Hm[ci];
      const R = 4.6 + hash(gx, gy, seed + 24) * 3.2;
      const top = g + 11 + hash(gx, gy, seed + 25) * 7 + R * 0.5, base = g + 4.5;
      if (top > C[ci] - 0.5) continue;
      const r0 = Math.ceil(R);
      for (let dy = -r0; dy <= r0; dy++) for (let dx = -r0; dx <= r0; dx++) {
        const rr = (dx * dx + dy * dy) / (R * R);
        if (rr >= 1) continue;
        const x = ix + dx, y = iy + dy, cj = y * W + x;
        if (mat[cj] !== MAT.LAND && mat[cj] !== MAT.LEAF) continue;
        let z = base + (top - base) * Math.sqrt(1 - rr);
        if (z > C[cj] - 0.5) z = C[cj] - 0.5;
        if (z > canopy[cj]) canopy[cj] = z;
      }
    }
    for (let ci = 0; ci < N; ci++) if (canopy[ci] > 0 && canopy[ci] > Hm[ci] + 1) { Hm[ci] = canopy[ci]; mat[ci] = MAT.LEAF; }
  }

  // Enstaka träd/buskar/stenar längs vägen (sprites)
  const stampShadow = (x, y, rx, ry, len) => {
    const cx = x + SHX * len, cy = y + SHY * len;
    for (let dy = -Math.ceil(ry); dy <= ry; dy++) for (let dx = -Math.ceil(rx); dx <= rx; dx++) {
      if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1) continue;
      const xx = Math.floor(cx + dx), yy = Math.floor(cy + dy);
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) shadow[yy * W + xx] = 1;
    }
  };
  const TREE_H = { lov: 30, gran: 34, bjork: 30, snogran: 34, kaktus: 20, buske: 10, torr: 24 };
  const S2 = 13;
  for (let gy = 0; gy < H / S2; gy++) for (let gx = 0; gx < W / S2; gx++) {
    const x = gx * S2 + hash(gx, gy, seed + 31) * S2, y = gy * S2 + hash(gx, gy, seed + 32) * S2;
    const ix = x | 0, iy = y | 0;
    if (ix < 2 || iy < 2 || ix >= W - 2 || iy >= H - 2) continue;
    const ci = iy * W + ix, rd = RD[ci];
    if (mat[ci] !== MAT.LAND && mat[ci] !== MAT.SAND) continue;
    if (rd < 14 || slopeAt(ix, iy) > 4) continue;
    const near = rd < 90;
    const dens = th.treeDensity * (near ? 0.55 : 0.12) * (0.4 + forestF(x, y));
    if (hash(gx, gy, seed + 33) > dens) continue;
    const kinds = th.trees;
    let kind = kinds[Math.floor(hash(gx, gy, seed + 34) * kinds.length)];
    const g = Hm[ci];
    if (g + TREE_H[kind] > C[ci] + 5) { kind = th.ground === 'sand' ? 'buske' : 'buske'; if (g + 10 > C[ci] + 3) continue; }
    const v = Math.floor(hash(gx, gy, seed + 35) * 4);
    objects.push({ k: kind, x, y, z: g, v });
    const th2 = TREE_H[kind];
    stampShadow(x, y, kind === 'buske' ? 5 : kind === 'kaktus' ? 3 : 8, kind === 'buske' ? 3 : kind === 'kaktus' ? 2 : 5.5, th2 * 0.62);
  }
  // stenblock
  const S3 = 23;
  for (let gy = 0; gy < H / S3; gy++) for (let gx = 0; gx < W / S3; gx++) {
    if (hash(gx, gy, seed + 41) > th.rocks * 0.35) continue;
    const x = gx * S3 + hash(gx, gy, seed + 42) * S3, y = gy * S3 + hash(gx, gy, seed + 43) * S3;
    const ix = x | 0, iy = y | 0;
    if (ix < 2 || iy < 2 || ix >= W - 2 || iy >= H - 2) continue;
    const ci = iy * W + ix;
    if (mat[ci] === MAT.WATER || mat[ci] === MAT.LEAF || (mat[ci] & DECK) || RD[ci] < 16) continue;
    if (Hm[ci] + 9 > C[ci] + 3) continue;
    objects.push({ k: 'sten', x, y, z: Hm[ci], v: Math.floor(hash(gx, gy, seed + 44) * 4) });
  }

  let ZTOP = 0, ZBOT = 1e9;
  for (let ci = 0; ci < N; ci++) { const h = Hm[ci] < 0 ? 0 : Hm[ci]; if (h > ZTOP) ZTOP = h; if (h < ZBOT) ZBOT = h; }
  for (let i = 0; i < T.n; i++) if (T.Z[i] > ZTOP) ZTOP = T.Z[i];
  ZTOP = Math.ceil(ZTOP + 2); ZBOT = Math.floor(ZBOT);
  const OX = H, OY = ZTOP, CW = W + H, CH = Math.ceil((W + H) / 2) + ZTOP - ZBOT;
  return { def, th, T, W, H, GW, GH, near, Hm, mat, shadow, objects, ZTOP, ZBOT, OX, OY, CW, CH, seed };
}
