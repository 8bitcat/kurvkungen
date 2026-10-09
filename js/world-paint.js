// Målar en terrängruta (TS×TS skärmpixlar) genom att skjuta en iso-stråle per pixel genom
// höjdkartan. Träff på ovansida = mark/väg/vatten/lövverk, träff på sida = klippvägg, skogskant,
// brokant. Ljus från vänster uppe, kvantiserat i toner med Bayer-dither, kastade skuggor.
import { nearest, pitOff, relS, PIT } from './trackgeo.js?v=1';
import { TEAMS } from './f1.js?v=1';
import { vnoise, fbm } from './noise.js?v=1';
import { fieldAt } from './fields.js?v=1';
import { hash, bayer, mix, mul, shade, sm } from './pix.js?v=1';
import { LX, LY, LZ, TS } from './iso.js?v=1';
import { MAT, DECK } from './world-gen.js?v=1';

const LH = Math.hypot(LX, LY);
const SDX = LX / LH, SDY = LY / LH, SDZ = LZ / LH;
const FLOWERS = [0xffffff, 0xf6e04a, 0xf28ac2, 0x9cc8ff];

export function paintTile(Wd, tx, ty) {
  const { W, H, Hm, mat, shadow, OX, OY, ZTOP, ZBOT, th, T, near, GW } = Wd;
  const out = new Uint8ClampedArray(TS * TS * 4);
  const kind = new Uint8Array(TS * (TS + 1));
  const q = {};
  const topAt = (x, y) => {
    x |= 0; y |= 0;
    if (x < 0) x = 0; else if (x >= W) x = W - 1;
    if (y < 0) y = 0; else if (y >= H) y = H - 1;
    const h = Hm[y * W + x];
    return h < 0 ? 0 : h;
  };
  const snow = th.ground === 'snow', desert = th.ground === 'sand';
  const city = th.ground === 'city', ash = th.ground === 'ash', moon = th.ground === 'moon';
  const L = T.L, seed = Wd.seed, B = Wd.B, bid = Wd.bid;
  const GS = Wd.def.f1 ? 28 : 30, GN = Wd.def.f1 ? 22 : 10;
  const P = T.pit;
  // depåfilen: asfalt, linjer, depårutor i stallens färger, fartgränslinjer
  function pitRoad(x, y, px, py, s, sd, pc) {
    const rs = relS(T, s), o = sd - pc, ao = Math.abs(o);
    let c = mul(th.road, 0.92);
    if (hash(x | 0, y | 0, 5) > 0.93) c = mix(c, 0xffffff, 0.08);
    if (ao > P.hw - 1.4) return 0xf2f0ea;
    if (Math.abs(o - 0.5) < 0.6 && (rs % 10 + 10) % 10 < 5) c = 0xd8d4cc;
    for (const lim of [P.s0 + P.ramp, P.s1 - P.ramp]) if (Math.abs(rs - lim) < 1.6) return ((Math.floor(rs / 1.6) + Math.floor(o / 1.6)) & 1) ? 0x1c1a20 : 0xf2f0ea;
    const k = Math.round((rs - P.boxS[0]) / PIT.boxStep);
    if (k >= 0 && k < P.boxS.length && o > 1.5) {
      const ds = rs - P.boxS[k];
      if (Math.abs(ds) < 12) {
        const col = TEAMS[k] ? TEAMS[k].c1 : 0xf2f0ea;
        if (Math.abs(ds) > 10.6 || o > P.hw - 2.6 || o < 2.6) return col === 0x111114 ? 0xc9a24a : col;
        c = mix(c, col, 0.12);
      }
    }
    return c;
  }
  const ROOF = [0x6a6a72, 0x5a5652, 0x7a7068, 0x4a4a52, 0x8a8478, 0x5e6266];
  const WALL = [0xa0523a, 0xc0bcb2, 0x6a86a6, 0xd8b860, 0xe0dcd4, 0x8a6a5a];
  const HROOF = [0x3a3440, 0xa83a2a, 0x5a4a3a];

  function ground(x, y, px, py, c0) {
    const xi = x | 0, yi = y | 0;
    if (city && fbm(x / 170, y / 170, seed + 7, 3) < th.forest - 0.02) {
      // stenläggning: plattor 6×6 med fogar
      const tx = Math.floor(x / 6), ty = Math.floor(y / 6), lx = x - tx * 6, ly = y - ty * 6;
      let c = mul(0xa8a49e, 0.94 + hash(tx, ty, seed + 3) * 0.1);
      if (lx < 0.6 || ly < 0.6) c = mul(c, 0.82);
      else if (lx < 1.2 || ly < 1.2) c = mix(c, 0xffffff, 0.12);
      if (hash(xi, yi, 21) > 0.95) c = mul(c, 0.9);
      if (hash(tx >> 3, ty >> 3, seed + 4) > 0.9 && lx > 2 && lx < 4 && ly > 2 && ly < 4 && ((tx + ty) & 7) === 0) c = 0x3a3840;
      return c;
    }
    if (ash) {
      let c = c0 ?? th.grass;
      const a = vnoise(x / 26, y / 26, 40);
      if (a > 0.62) c = th.grass2; else if (a < 0.32) c = th.grass3;
      const b = hash(xi, yi, 13);
      if (b > 0.95) c = mix(c, 0xffffff, 0.12); else if (b < 0.06) c = mul(c, 0.8);
      const cr = Math.abs(vnoise(x / 22, y / 22, 41) - 0.5);
      if (cr < 0.011) c = 0xff8a2a; else if (cr < 0.02) c = 0xa83a1a;
      return c;
    }
    if (moon) {
      let c = c0 ?? th.grass;
      const a = vnoise(x / 40, y / 40, 40) * 0.6 + vnoise(x / 12, y / 12, 42) * 0.4;
      if (a > 0.6) c = th.grass2; else if (a < 0.34) c = th.grass3;
      const b = hash(xi, yi, 13);
      if (b > 0.96) c = mix(c, 0xffffff, 0.2); else if (b < 0.05) c = mul(c, 0.84);
      const gx = Math.floor(x / 16), gy = Math.floor(y / 16);
      if (hash(gx, gy, 43) > 0.62) {
        const cx = gx * 16 + 4 + hash(gx, gy, 44) * 8, cy = gy * 16 + 4 + hash(gx, gy, 45) * 8, r = 1.8 + hash(gx, gy, 46) * 4.5;
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
        if (d < r) c = d > r - 1.1 ? (dx - dy < 0 ? mul(c, 0.78) : mix(c, 0xffffff, 0.22)) : mul(c, 0.88);
      }
      return c;
    }
    if (th.fields) {
      const f = fieldAt(x, y, seed);
      if (f && f.edge) return mix(th.grass3, 0x3a5a24, 0.4 + hash(xi >> 1, yi >> 1, 47) * 0.2);
      if (f) {
        const r = f.row, b = hash(xi, yi, 48);
        if (f.type === 0) { let c = (r % 4) < 1.6 ? 0x5a3a22 : 0x7a5232; if (b > 0.9) c = 0x9a6a42; return c; }
        if (f.type === 1) { let c = (r % 3) < 1 ? 0xc8a848 : 0xe0c060; if (b > 0.92) c = 0xf6e090; return c; }
        if (f.type === 2) { let c = (r % 3.5) < 1.3 ? 0x3a6a24 : 0x5a9a32; if (b > 0.93) c = 0x7aba42; return c; }
        let c = 0xf2e040; if (b > 0.75) c = 0x9ab830; else if (b < 0.1) c = 0xf8f080; return c;
      }
    }
    const a = vnoise(x / 30, y / 30, 11) * 0.65 + vnoise(x / 9, y / 9, 12) * 0.35 + (bayer(px, py) - 0.5) * 0.06;
    let c = a > 0.62 ? th.grass2 : a < 0.3 ? mix(c0 ?? th.grass, th.grass3, 0.55) : (c0 ?? th.grass);
    const b = hash(xi, yi, 13);
    // grästuvor: ljus pixel med mörk fot
    if (!snow && !desert) {
      const tu = hash(xi >> 1, yi >> 1, 19);
      if (tu > 0.86) { const o = hash(xi >> 1, yi >> 1, 29); if (((px + (o * 3 | 0)) & 3) === 0) c = (py & 1) ? mul(c, 0.82) : mix(c, 0xfff2b0, 0.22); }
    }
    if (snow) {
      if (b > 0.985) c = 0xffffff; else if (b < 0.05) c = mul(c, 0.95);
      const dr = Math.sin(x * 0.12 - y * 0.05 + vnoise(x / 40, y / 40, 17) * 6);
      if (dr > 0.85) c = mix(c, 0xffffff, 0.5);
      return c;
    }
    if (b > 0.94) c = mix(c, 0xfff4c0, 0.16); else if (b < 0.07) c = mul(c, 0.84);
    if (hash(xi >> 1, yi >> 1, 14) > 0.9) c = mul(c, 0.91);
    if (desert) {
      const r = Math.sin((x * 0.5 + y * 0.25) * 0.4 + vnoise(x / 25, y / 25, 16) * 5);
      if (r > 0.82) c = th.grass2; else if (r < -0.9) c = th.grass3;
      if (b > 0.993) c = 0x8a5a3a;
      return c;
    }
    if (b > 0.9982) c = FLOWERS[(hash(xi, yi, 15) * 4) | 0];
    const dp = vnoise(x / 70, y / 70, 18);
    if (dp > 0.75 + (bayer(px, py) - 0.5) * 0.05) c = mix(c, th.dirt, 0.65);
    return c;
  }

  function road(x, y, px, py, d, s, hw, i, onDeck) {
    const ad = Math.abs(d), xi = x | 0, yi = y | 0;
    if (ad <= hw) {
      let c = onDeck ? mix(th.road, th.deck, 0.35) : th.road;
      if (vnoise(x / 38, y / 38, 77) > 0.63) c = mul(c, 0.94);
      const gr = hash(xi, yi, 5);
      if (gr > 0.93) c = mix(c, 0xffffff, 0.09); else if (gr < 0.07) c = mul(c, 0.9);
      if (Math.abs(ad - hw * 0.45) < 4.5) c = mul(c, 0.965);
      if (onDeck && (s % 22) < 0.9) c = mul(c, 0.8);
      if (ad < 1.05 && (s % 30) < 15 && !Wd.def.f1) c = th.line;
      else if (ad > hw - 3.4 && ad < hw - 1.9) c = th.edge;
      const K = T.K[i];
      const f1 = Wd.def.f1;
      if (Math.abs(K) > (f1 ? 0.0018 : 0.0036) && ad > hw - (f1 && Math.abs(K) > 0.005 ? 5.8 : 4.8)) {
        const inside = (K > 0) === (d < 0);
        if (inside || f1 || Math.abs(K) > 0.0075) c = (Math.floor(s / 6) & 1) ? th.curbR : th.curbW;
        if (ad > hw - 0.9) c = mul(c, 0.78);
      }
      if (T.flags[i] & 8) {
        const n = T.n, lip = !(T.flags[(i + 3) % n] & 8);
        c = mix(c, 0xd8d4cc, 0.35);
        if (lip) c = (Math.floor((s + ad * 0.8) / 2.5) & 1) ? 0x1c1a20 : 0xf2c21c;
      }
      if (s < 7) c = ((Math.floor(s / 3.5) + Math.floor((d + 200) / 3.5)) & 1) ? 0x1c1a20 : 0xf4f2ee;
      else if (s > L - 26 - GN * GS - 20) { // startrutor
        const k = Math.round((L - 26 - s) / GS);
        if (k >= 0 && k < GN) {
          const sk = L - 26 - k * GS, dk = (k & 1 ? -1 : 1) * hw * 0.44;
          const ds = s - sk, dd = d - dk;
          if ((Math.abs(ds) < 0.9 && Math.abs(dd) < 8) || (Math.abs(Math.abs(dd) - 7.4) < 0.7 && ds < 0 && ds > -9)) c = th.edge;
        }
      }
      return c;
    }
    // vägren
    let c = onDeck ? th.deck : th.shoulder;
    const gr = hash(xi, yi, 7);
    if (onDeck) {
      if (ad > hw + 3.6) c = mul(c, 0.86);
      else if (gr > 0.8) c = mul(c, 1.05);
      return c;
    }
    if (th.kerb) {
      if (ad < hw + 1.2) return 0xd8d4cc;
      c = mul(c, 0.95 + hash(Math.floor(s / 3), Math.floor(ad / 3), 9) * 0.08);
      if (((s % 3) < 0.4) || ((ad % 3) < 0.4)) c = mul(c, 0.86);
      return c;
    }
    if (gr > 0.82) c = mix(c, 0xffffff, 0.16); else if (gr < 0.25) c = mul(c, 0.83);
    if (ad < hw + 1) c = mul(c, 0.8);
    const t = (ad - hw - 3.2) / 2.8;
    if (t > 0 && bayer(px, py) < t) return -1;
    return c;
  }

  for (let py = -1; py < TS; py++) {
    const sy = ty * TS + py - OY + 0.5;
    for (let px = 0; px < TS; px++) {
      const sx = tx * TS + px - OX + 0.5;
      let uHi = 2 * (sy + ZTOP), uLo = 2 * (sy + ZBOT) - 2;
      const uMin = Math.max(-sx, sx), uMax = Math.min(2 * W - sx, 2 * H + sx) - 0.001;
      if (uHi > uMax) uHi = uMax;
      if (uLo < uMin) uLo = uMin;
      let res = 0, hu = 0, hci = 0, hh = 0, prevTop = -1e9, deckZ = 0;
      for (let u = uHi; u >= uLo; u -= 1) {
        const x = (u + sx) * 0.5, y = (u - sx) * 0.5, z = u * 0.5 - sy;
        const ci = (y | 0) * W + (x | 0);
        const m = mat[ci];
        if (m & DECK) {
          nearest(T, x, y, near[(y >> 1) * GW + (x >> 1)], 2, q);
          if (q.dist < q.hw + 5 && (T.flags[q.i] & 1) && z <= q.z && z >= q.z - 4) {
            res = q.z - z < 1 ? 3 : 4; hu = u; hci = ci; deckZ = q.z; break;
          }
        }
        let h = Hm[ci];
        if (h < 0) h = 0;
        if (h >= z) { res = h - z < 1 ? 1 : 2; hu = u; hci = ci; hh = h; break; }
        prevTop = h;
      }
      if (py >= 0) {
        let c = th.outside;
        if (res === 1 || res === 3) {
          const zt = res === 3 ? deckZ : hh;
          let u = 2 * (sy + zt); if (u > hu + 1) u = hu + 1;
          const x = (u + sx) * 0.5, y = (u - sx) * 0.5;
          const m = res === 3 ? -1 : mat[hci] & 15;
          let k = 1, base = -1;
          if (res === 3) {
            nearest(T, x, y, near[(y >> 1) * GW + (x >> 1)], 2, q);
            base = road(x, y, px, py, q.d, q.s, q.hw, q.i, true);
          } else if (m === MAT.WATER) {
            const dep = -Hm[hci];
            const xi = x | 0, yi = y | 0;
            if (th.ice) {
              base = mix(th.water, th.waterDeep, sm(2, 8, dep));
              const cr = Math.abs(vnoise(x / 26, y / 26, 61) - 0.5);
              if (cr < 0.018) base = mul(base, 0.82); else if (cr < 0.04) base = mix(base, 0xffffff, 0.3);
              if (Math.sin(x * 0.09 + y * 0.16 + vnoise(x / 50, y / 50, 62) * 4) > 0.93) base = th.water2;
              if (dep < 0.8) base = th.foam;
            } else if (th.lava) {
              base = mix(th.water, th.waterDeep, sm(2, 8, dep));
              const v = vnoise(x / 12, y / 12, 31);
              if (v > 0.63) base = v > 0.66 ? 0x3a1a16 : 0x8a2a14;
              const vein = Math.abs(vnoise(x / 30, y / 30, 32) - 0.5);
              if (vein < 0.025) base = th.water2;
              if (hash(xi, yi, 33) > 0.995) base = 0xfff6c0;
              if (dep < 1) base = bayer(px, py) < sm(1, 0.3, dep) ? th.foam : th.water2;
              k = 1.12;
            } else {
              base = mix(th.water, th.waterDeep, sm(1.6, 7.5, dep));
              if (th.shallow) base = mix(th.shallow, base, sm(0.8, 3.2, dep));
              const w = Math.sin(x * 0.21 + y * 0.09 + vnoise(x / 40, y / 40, 21) * 7);
              if (w > 0.9 && hash(xi, yi, 22) > 0.3) base = th.water2;
              else if (w < -0.95 && hash(xi, yi, 24) > 0.5) base = mul(base, 0.9);
              if (hash(xi, yi, 23) > 0.9975) base = th.foam;
              if (dep < 0.75) base = bayer(px, py) < sm(0.75, 0.2, dep) ? th.foam : th.water2;
            }
          } else {
            const hx1 = topAt(x - 1, y), hx2 = topAt(x + 1, y), hy1 = topAt(x, y - 1), hy2 = topAt(x, y + 1);
            let gx = (hx2 - hx1) * 0.5, gy = (hy2 - hy1) * 0.5;
            const gl = Math.hypot(gx, gy);
            if (gl > 1.6) { gx *= 1.6 / gl; gy *= 1.6 / gl; }
            const nl = Math.sqrt(gx * gx + gy * gy + 1);
            k = ((-gx * LX - gy * LY + LZ) / nl) / LZ;
            if (m === MAT.LEAF) {
              const s2 = hash(x >> 1, y >> 1, 31);
              const LM = th.leafMix ? th.leafMix[Math.min(3, Math.floor(vnoise(x / 18, y / 18, 91) * 4.4))] : null;
              const l0 = LM ? LM[0] : th.leaf, l1 = LM ? LM[1] : th.leaf2, l2 = LM ? LM[2] : th.leafDk;
              base = l0;
              if (k > 1.04 && s2 > 0.5) base = l1;
              else if (k < 0.86 && s2 > 0.55) base = l2;
              if (hash(x | 0, y | 0, 32) > 0.86) base = mix(base, l1, 0.5);
              if (snow && k > 0.92 && hash(x | 0, y | 0, 33) > 0.45) base = mix(0xf2f6ff, 0xc8d4ea, 1.06 - k);
              k = 1 + (k - 1) * 1.5;
            } else if (m === MAT.PILLAR) {
              base = th.deck;
            } else if (m === MAT.BUILD) {
              const b = B[bid[hci] - 1];
              if (b.kind === 'pits') {
                base = 0x8a8c94;
                if (hash(x >> 1, y >> 1, 73) > 0.85) base = 0x9c9ea8;
                if (hash(x | 0, y | 0, 74) > 0.95) base = 0x6a6c74;
              } else if (b.kind === 'city') {
                if (zt > b.top + 1.8) { base = 0xa8aab4; if (((px + py) & 1) && hash(px, py, 5) > 0.5) base = 0x8a8c96; }
                else if (zt > b.top + 0.5) base = 0xc8c4bc;
                else { base = ROOF[b.style]; if (hash(x | 0, y | 0, 71) > 0.88) base = mul(base, 0.88); if (((x - b.x0) % 12) < 0.6) base = mul(base, 0.9); }
              } else {
                const v = b.axis === 0 ? Math.abs(y - b.cy) : Math.abs(x - b.cx);
                base = b.kind === 'barn' ? 0x7a2a24 : HROOF[b.style];
                if (v < 0.9) base = mix(base, 0xffffff, 0.2);
                else if ((v % 2) < 0.5) base = mul(base, 0.78);
                if (hash(x | 0, y | 0, 72) > 0.9) base = mul(base, 0.9);
              }
            } else {
              const gi = near[(y >> 1) * GW + (x >> 1)];
              const ex = T.X[gi] - x, ey = T.Y[gi] - y;
              if (ex * ex + ey * ey < (T.HW[gi] + (P ? 90 : 16)) ** 2) {
                nearest(T, x, y, gi, 2, q);
                if (q.dist < q.hw + 6.5) base = road(x, y, px, py, q.d, q.s, q.hw, q.i, false);
                if (P && base < 0) {
                  const po = pitOff(T, q.s);
                  if (po !== null) {
                    const sd = q.d * P.side, pc = po * P.side;
                    if (Math.abs(sd - pc) < P.hw) base = pitRoad(x, y, px, py, q.s, sd, pc);
                    else if (sd > q.hw && sd < pc) { base = 0xb8b4ac; if ((Math.floor(relS(T, q.s) / 8) & 1) && hash(x | 0, y | 0, 8) > 0.5) base = 0xaca89f; }
                    else if (sd >= pc && sd < P.bld0 + 2) base = 0xc4c0b8;
                  }
                }
              }
              if (base < 0) {
                if (m === MAT.SAND && Wd.def.f1) {
                  const g = hash(x | 0, y | 0, 20);
                  base = g > 0.72 ? 0xe2d4b4 : g < 0.22 ? 0x9e8c6a : 0xc8b48c;
                  if (hash(x >> 1, y >> 1, 21) > 0.9) base = 0x8a7a5c;
                } else if (m === MAT.SAND) {
                  base = hh < 1.3 ? th.sand2 : th.sand;
                  const r = Math.sin((x * 0.4 + y * 0.3) * 0.5 + vnoise(x / 20, y / 20, 19) * 4);
                  if (r > 0.86) base = mix(base, 0xffffff, 0.2);
                  if (hash(x | 0, y | 0, 20) < 0.08) base = mul(base, 0.9);
                } else if (m === MAT.ROCK || gl > 1.25) {
                  base = (hash(x >> 1, y >> 1, 25) > 0.5) ? th.rock2 : th.rock;
                  if (hash(x | 0, y | 0, 26) > 0.85) base = mul(base, 0.85);
                  if (!desert && !snow && gl < 1.1) base = mix(base, th.grass3, 0.45);
                } else base = ground(x, y, px, py);
              }
            }
            // kastad skugga
            let sh = shadow[hci];
            if (!sh) {
              let sx2 = x, sy2 = y, sz = zt + 0.6;
              for (let s = 0; s < 80; s++) {
                sx2 += SDX; sy2 += SDY; sz += SDZ;
                if (sz > ZTOP || sx2 < 0 || sy2 < 0 || sx2 >= W || sy2 >= H) break;
                const cj = (sy2 | 0) * W + (sx2 | 0);
                const hj = Hm[cj];
                if (hj > sz) { sh = 1; break; }
                if ((mat[cj] & DECK) && hj < sz) {
                  const gz = T.Z[near[(sy2 >> 1) * GW + (sx2 >> 1)]];
                  if (sz < gz && sz > gz - 4) { sh = 1; break; }
                }
              }
            }
            if (sh) k *= 0.6;
          }
          if (m === MAT.WATER) {
            // skuggor på vattnet
            let sh = shadow[hci], sx2 = x, sy2 = y, sz = 0.6;
            for (let s = 0; !sh && s < 80; s++) {
              sx2 += SDX; sy2 += SDY; sz += SDZ;
              if (sz > ZTOP || sx2 < 0 || sy2 < 0 || sx2 >= W || sy2 >= H) break;
              const cj = (sy2 | 0) * W + (sx2 | 0);
              if (Hm[cj] > sz) sh = 1;
              else if (mat[cj] & DECK) { const gz = T.Z[near[(sy2 >> 1) * GW + (sx2 >> 1)]]; if (sz < gz && sz > gz - 4) sh = 1; }
            }
            if (sh && !th.lava) k = 0.64;
          }
          if (res === 3) {
            // brodäck: skugga från räcken mm. ignoreras
          }
          c = shade(base, k, px + tx * TS, py + ty * TS, 0.6);
          kind[(py + 1) * TS + px] = 1;
        } else if (res === 2 || res === 4) {
          const z = hu * 0.5 - sy;
          const x = (hu + sx) * 0.5, y = (hu - sx) * 0.5;
          const cx = tx * TS + px, cy = ty * TS + py;
          if (res === 4) {
            let base = th.deck;
            const t = deckZ - z;
            if (t < 1) base = mix(th.deck, 0xffffff, 0.25);
            else if (t > 3.2) base = mul(th.deck, 0.55);
            else if ((cx % 12) === 0) base = mul(th.deck, 0.8);
            c = shade(base, 0.85, cx, cy);
          } else {
            const m = mat[hci] & 15;
            const gx = topAt(x + 2, y) - topAt(x - 2, y), gy = topAt(x, y + 2) - topAt(x, y - 2);
            let nx = -gx, ny = -gy;
            const l = Math.hypot(nx, ny);
            if (l < 0.01) { nx = 0.707; ny = 0.707; } else { nx /= l; ny /= l; }
            let k = 0.8 + (nx * LX + ny * LY) * 0.5;
            const depth = hh - z, above = z - prevTop;
            let base;
            if (m === MAT.LEAF) {
              const LM = th.leafMix ? th.leafMix[Math.min(3, Math.floor(vnoise(x / 18, y / 18, 91) * 4.4))] : null;
              const l0 = LM ? LM[0] : th.leaf, l1 = LM ? LM[1] : th.leaf2, l2 = LM ? LM[2] : th.leafDk;
              base = hash(cx >> 1, Math.floor(z), 51) > 0.62 ? (k > 0.8 ? l1 : l2) : l0;
              if (hash(cx, Math.floor(z * 2), 52) > 0.86) base = l2;
              k *= 1 - Math.min(0.4, depth * 0.035);
              if (above < 4.5) { base = hash(cx >> 1, 0, 53) > 0.6 ? th.trunk : th.leafDk; k *= 0.7; }
              if (snow && depth < 2 && hash(cx, 1, 54) > 0.3) base = 0xe8eef8;
            } else if (m === MAT.PILLAR) {
              base = th.deck; if ((cx & 3) === 0) base = mul(base, 0.9);
            } else if (m === MAT.BUILD) {
              const b = B[bid[hci] - 1];
              const zr = z - b.base;
              const along = Math.abs(nx) > Math.abs(ny) ? y - b.cy : x - b.cx;
              if (b.kind === 'pits') {
                nearest(T, x, y, near[(y >> 1) * GW + (x >> 1)], 3, q);
                const rs = relS(T, q.s), bk = Math.round((rs - P.boxS[0]) / PIT.boxStep), team = TEAMS[bk];
                base = 0xd8d4cc;
                if (team && Math.abs(rs - P.boxS[bk]) < 13) {
                  if (zr < 8.6) {
                    base = 0x2a2830;
                    if (zr < 2.4 && hash(cx, Math.floor(z * 2), 75) > 0.6) base = 0x141218;
                    if (zr > 3 && zr < 6 && hash(cx >> 1, 1, bk) > 0.7) base = mix(team.c1, 0x2a2830, 0.4);
                    if (zr > 7.6) base = team.c1;
                  } else if (zr > 10 && zr < 13) base = (Math.floor(cx / 2) + bk) % 7 === 0 ? 0xf2f0ea : team.c1;
                }
                if (z > b.top - 1) base = 0xf2f0ea;
                if (zr < 0.8) base = 0x9a968e;
                k = 0.85 + (nx * LX + ny * LY) * 0.35;
              } else if (b.kind === 'city') {
                base = WALL[b.style];
                const fl = Math.floor(zr / 7), zz = zr - fl * 7, col = ((cx % 6) + 6) % 6;
                if (b.style === 0 && (Math.floor(z * 2) & 1)) base = mul(base, 0.92);
                if (z > b.top - 1.2) base = mix(base, 0xffffff, 0.25);
                else if (zr < 6) { base = mul(base, 0.8); if (zz > 1.2 && zz < 5 && col !== 0) base = ((cx >> 2) + 1) % 5 === 0 ? 0x8ab0d8 : 0x2a3a4a; }
                else if (b.style === 2) { base = zz < 0.8 ? 0xb8c4d0 : ((cx + fl * 3) % 9 < 2 ? 0x9ac0e0 : 0x4a6a8e); }
                else if (zz > 2.4 && zz < 5.6 && col >= 1 && col <= 4) {
                  base = hash(Math.floor(cx / 6), fl, b.style + 70) > 0.82 ? 0x8ab0d8 : 0x2e3e58;
                  if (zz > 5) base = mul(base, 0.7);
                }
                k = 0.8 + (nx * LX + ny * LY) * 0.45;
              } else {
                const barn = b.kind === 'barn';
                base = barn ? 0xa8302a : 0xeae6dc;
                if (barn && ((cx % 3) + 3) % 3 === 0) base = mul(base, 0.84);
                if (z > b.wall - 1.1 && z < b.wall + 0.2) base = 0xf2eee6;
                if (barn && Math.abs(along) < 6.5 && zr < 10) {
                  const a = Math.abs(along);
                  if (a > 5.6 || zr > 9.2) base = 0xf2eee6;
                  else if (Math.abs(a * 0.8 - Math.abs(zr - 4.6)) < 0.55) base = 0xf2eee6;
                  else base = 0x8a2622;
                }
                if (!barn && zr > 3 && zr < 8 && ((along + 40) % 8) < 3.5) base = (zr < 3.6 || zr > 7.4) ? 0x3a5a8a : 0x2e3e58;
                if (z > b.wall + 3 && z < b.wall + 5 && Math.abs(along) < 1.3) base = 0x2a2428;
              }
            } else {
              const off = hash(Math.floor(cx / 7), 0, 60) * 5;
              const br = Math.floor((z + off) / 5);
              const bc = Math.floor((cx + hash(br, 1, 61) * 8) / 8);
              const r = hash(bc, br, 62);
              base = r > 0.66 ? th.rock2 : r > 0.33 ? th.rock : mul(th.rock, 0.9);
              const fz = (z + off) - br * 5;
              if (fz > 4.3) base = mix(base, 0xffffff, 0.18);
              else if (fz < 0.6) base = mul(base, 0.7);
              if (((cx + hash(br, 1, 61) * 8) % 8) < 1) base = mul(base, 0.75);
              if (hash(cx, Math.floor(z * 2), 63) > 0.9) base = mul(base, 0.88);
              const grassy = m === MAT.LAND && !desert;
              if (grassy && depth < 1.4) base = snow ? 0xeef2fa : th.grass3;
              else if (grassy && depth < 2.6 && hash(cx, 7, 64) > 0.45 + (depth - 1.4) * 0.4) base = snow ? 0xdde4f0 : mul(th.grass3, 0.85);
              if (above < 1.6) k *= 0.78;
            }
            c = shade(base, k, cx, cy);
          }
          kind[(py + 1) * TS + px] = 2;
        }
        const o = (py * TS + px) * 4;
        out[o] = (c >> 16) & 255; out[o + 1] = (c >> 8) & 255; out[o + 2] = c & 255; out[o + 3] = 255;
      } else if (res === 1 || res === 3) kind[px] = 1; else if (res) kind[px] = 2;
    }
  }
  // ljus kant på klippkrön (ovansida direkt ovanför en sida)
  for (let py = 0; py < TS - 1; py++) for (let px = 0; px < TS; px++) {
    if (kind[(py + 1) * TS + px] === 1 && kind[(py + 2) * TS + px] === 2) {
      const o = (py * TS + px) * 4;
      out[o] = Math.min(255, out[o] * 1.12 + 10); out[o + 1] = Math.min(255, out[o + 1] * 1.12 + 9); out[o + 2] = Math.min(255, out[o + 2] * 1.08 + 4);
    }
  }
  return out;
}
