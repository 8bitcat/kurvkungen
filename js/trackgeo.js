// Banans geometri: centripetal Catmull-Rom genom kontrollpunkterna, jämnt omsamplad var SP:e enhet.
// Per sampel: läge, höjd, tangent, vänsternormal, signerad krökning (+ = högersväng), halvbredd.
// Projektionen (iso.js) gör att ökande vinkel = medurs på skärmen, alltså högersväng.

export const SP = 2;

function crPoint(p0, p1, p2, p3, t) {
  const k01 = Math.max(1e-3, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) ** 0.5);
  const k12 = Math.max(1e-3, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) ** 0.5);
  const k23 = Math.max(1e-3, Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) ** 0.5);
  const t0 = 0, t1 = k01, t2 = t1 + k12, t3 = t2 + k23;
  const tt = t1 + (t2 - t1) * t;
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const a1 = ((t1 - tt) / (t1 - t0)) * p0[k] + ((tt - t0) / (t1 - t0)) * p1[k];
    const a2 = ((t2 - tt) / (t2 - t1)) * p1[k] + ((tt - t1) / (t2 - t1)) * p2[k];
    const a3 = ((t3 - tt) / (t3 - t2)) * p2[k] + ((tt - t2) / (t3 - t2)) * p3[k];
    const b1 = ((t2 - tt) / (t2 - t0)) * a1 + ((tt - t0) / (t2 - t0)) * a2;
    const b2 = ((t3 - tt) / (t3 - t1)) * a2 + ((tt - t1) / (t3 - t1)) * a3;
    out[k] = ((t2 - tt) / (t2 - t1)) * b1 + ((tt - t1) / (t2 - t1)) * b2;
  }
  return out;
}

function smoothLoop(a, rad, passes = 2) {
  const n = a.length;
  let src = a;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(n);
    let acc = 0;
    for (let k = -rad; k <= rad; k++) acc += src[((k % n) + n) % n];
    for (let i = 0; i < n; i++) {
      out[i] = acc / (2 * rad + 1);
      acc += src[(i + rad + 1) % n] - src[((i - rad) % n + n) % n];
    }
    src = out;
  }
  return src;
}
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// Sluten polylinje → jämnt fördelade punkter med avstånd ≈ SP
function resampleLoop(xs, ys, zs, segs) {
  const dn = xs.length;
  const cum = new Float64Array(dn + 1);
  for (let i = 0; i < dn; i++) { const j = (i + 1) % dn; cum[i + 1] = cum[i] + Math.hypot(xs[j] - xs[i], ys[j] - ys[i]); }
  const L = cum[dn], n = Math.round(L / SP), sp = L / n;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), SEG = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = i * sp;
    while (cum[j + 1] < s) j++;
    const t = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), k = (j + 1) % dn;
    X[i] = xs[j] + (xs[k] - xs[j]) * t; Y[i] = ys[j] + (ys[k] - ys[j]) * t; Z[i] = zs[j] + (zs[k] - zs[j]) * t;
    SEG[i] = segs[j];
  }
  return { X, Y, Z, SEG, L, sp };
}

export function buildTrack(def) {
  const P = def.points, m = P.length;
  const dense = [], seg = [];
  for (let i = 0; i < m; i++) {
    const p0 = P[(i - 1 + m) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(8, Math.ceil(len / 1.5));
    for (let k = 0; k < steps; k++) { dense.push(crPoint(p0, p1, p2, p3, k / steps)); seg.push(i + k / steps); }
  }
  let R0 = resampleLoop(dense.map((p) => p[0]), dense.map((p) => p[1]), dense.map((p) => p[2]), seg);
  // kurvbegränsare: jämna ut där radien blir mindre än RMIN
  const RMIN = def.rmin || 64;
  for (let it = 0; it < 160; it++) {
    const { X, Y } = R0, n0 = X.length, w = 8;
    const hot = new Float32Array(n0);
    let any = false;
    for (let i = 0; i < n0; i++) {
      const a = (i - w + n0) % n0, b = (i + w) % n0;
      const a1 = Math.atan2(Y[i] - Y[a], X[i] - X[a]), a2 = Math.atan2(Y[b] - Y[i], X[b] - X[i]);
      const k = Math.abs(wrapA(a2 - a1)) / (w * R0.sp);
      if (k > 1 / RMIN) { any = true; for (let o = -30; o <= 30; o++) hot[(i + o + n0) % n0] = Math.max(hot[(i + o + n0) % n0], 1 - Math.abs(o) / 31); }
    }
    if (!any) break;
    const nx = new Float32Array(X), ny = new Float32Array(Y);
    for (let i = 0; i < n0; i++) {
      if (!hot[i]) continue;
      let sx = 0, sy = 0;
      for (let o = -18; o <= 18; o++) { sx += X[(i + o + n0) % n0]; sy += Y[(i + o + n0) % n0]; }
      nx[i] = X[i] + (sx / 37 - X[i]) * 0.4 * hot[i]; ny[i] = Y[i] + (sy / 37 - Y[i]) * 0.4 * hot[i];
    }
    R0 = resampleLoop(nx, ny, R0.Z, R0.SEG);
  }
  const { X, Y, Z: Zr, SEG, L: L0, sp } = R0, n = X.length;
  const Z = smoothLoop(Zr, 20, 3);
  const TX = new Float32Array(n), TY = new Float32Array(n), NX = new Float32Array(n), NY = new Float32Array(n), A = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    let tx = X[b] - X[a], ty = Y[b] - Y[a];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    TX[i] = tx; TY[i] = ty; NX[i] = ty; NY[i] = -tx; A[i] = Math.atan2(ty, tx);
  }
  const Kraw = new Float32Array(n);
  for (let i = 0; i < n; i++) Kraw[i] = wrapA(A[(i + 2) % n] - A[(i - 2 + n) % n]) / (4 * sp);
  const K = smoothLoop(Kraw, 6, 2);
  const KS = smoothLoop(Kraw, 30, 2); // bred krökning (racinglinje, kurvskyltar)
  // Halvbredd: standard eller per kontrollpunkt (gäller sträckan fram till nästa punkt)
  const HW = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ci = Math.floor(SEG[i]) % m;
    HW[i] = (P[ci][3] && P[ci][3].w) || def.hw || 28;
  }
  const HWs = smoothLoop(HW, 15, 2);
  const flags = new Uint8Array(n); // bit 0 = bro (sätts av terränggeneratorn), bit 1 = räcke vänster, bit 2 = räcke höger
  for (let i = 0; i < n; i++) {
    const o = P[Math.floor(SEG[i]) % m][3];
    if (o && o.rail) { if (o.rail.includes('L')) flags[i] |= 2; if (o.rail.includes('R')) flags[i] |= 4; }
  }
  const ZB = new Float32Array(Z); // höjd utan ramper (för terrängen runt omkring)
  // hoppramper mitt på sträckan efter en kontrollpunkt med {jump: höjd}
  for (let ci = 0; ci < m; ci++) {
    const o = P[ci][3];
    if (!o || !o.jump) continue;
    let i0 = -1, i1 = -1;
    for (let i = 0; i < n; i++) if (Math.floor(SEG[i]) === ci) { if (i0 < 0) i0 = i; i1 = i; }
    if (i0 < 0) continue;
    const mid = Math.round((i0 + i1) / 2), len = 20;
    for (let k = 0; k < len; k++) { const i = (mid - len + k + n) % n; Z[i] += o.jump * (k + 1) / len; flags[i] |= 8; }
  }
  const T = { n, L: L0, sp, X, Y, Z, ZB, TX, TY, NX, NY, A, K, KS, HW: HWs, SEG, flags };
  T.pit = buildPit(T, def);
  return T;
}

// Närmaste punkt på mittlinjen nära index `hint`. Skriver i `out` (återanvänds).
export function nearest(T, x, y, hint, range, out) {
  const n = T.n, X = T.X, Y = T.Y;
  let best = 1e30, bi = 0, bt = 0;
  for (let o = -range; o <= range; o++) {
    let i = hint + o; i = i < 0 ? i + n : i >= n ? i - n : i;
    const j = i + 1 === n ? 0 : i + 1;
    const ax = X[i], ay = Y[i], bx = X[j] - ax, by = Y[j] - ay;
    let t = ((x - ax) * bx + (y - ay) * by) / (bx * bx + by * by);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + bx * t - x, qy = ay + by * t - y, d2 = qx * qx + qy * qy;
    if (d2 < best) { best = d2; bi = i; bt = t; }
  }
  const j = bi + 1 === n ? 0 : bi + 1;
  const nx = T.NX[bi] + (T.NX[j] - T.NX[bi]) * bt, ny = T.NY[bi] + (T.NY[j] - T.NY[bi]) * bt;
  const qx = X[bi] + (X[j] - X[bi]) * bt, qy = Y[bi] + (Y[j] - Y[bi]) * bt;
  out.i = bi; out.t = bt;
  out.d = (x - qx) * nx + (y - qy) * ny;
  out.dist = Math.sqrt(best);
  out.s = (bi + bt) * T.sp;
  out.z = T.Z[bi] + (T.Z[j] - T.Z[bi]) * bt;
  out.zb = T.ZB[bi] + (T.ZB[j] - T.ZB[bi]) * bt;
  out.hw = T.HW[bi];
  return out;
}

export function nearestGlobal(T, x, y, out) {
  let best = 1e30, bi = 0;
  for (let i = 0; i < T.n; i += 3) {
    const dx = T.X[i] - x, dy = T.Y[i] - y, d = dx * dx + dy * dy;
    if (d < best) { best = d; bi = i; }
  }
  return nearest(T, x, y, bi, 4, out);
}

export const wrapS = (T, s) => ((s % T.L) + T.L) % T.L;

// ---------- depåfilen ----------
// Ligger på bortre sidan av start/mål. off(s) = sidoavstånd från mittlinjen till depåfilens mitt.
export const PIT = { ramp: 170, gap: 26, hw: 15, boxS0: -236, boxStep: 34, boxes: 11 };
export function buildPit(T, def) {
  if (!def.pit) return null;
  const side = T.NX[0] + T.NY[0] < 0 ? 1 : -1;
  const hw = T.HW[0];
  const P = { s0: def.pit.s0, s1: def.pit.s1, side, hw: PIT.hw, mid: hw + PIT.gap, wall: hw + 8, ramp: PIT.ramp };
  P.boxS = Array.from({ length: PIT.boxes }, (_, k) => PIT.boxS0 + k * PIT.boxStep);
  P.bld0 = P.mid + P.hw + 6; P.bld1 = P.bld0 + 30;
  return P;
}
// s relativt start/mål (−L/2..L/2)
export const relS = (T, s) => { let r = wrapS(T, s); if (r > T.L / 2) r -= T.L; return r; };
// depåfilens mittlinje (sidoavstånd med tecken = side) vid s, eller null utanför
export function pitOff(T, s) {
  const P = T.pit; if (!P) return null;
  const r = relS(T, s);
  if (r < P.s0 || r > P.s1) return null;
  const a = Math.min(1, (r - P.s0) / P.ramp), b = Math.min(1, (P.s1 - r) / P.ramp);
  const t = Math.min(a, b), e = t * t * (3 - 2 * t);
  return P.side * ((T.HW[0] - 8) + (P.mid - (T.HW[0] - 8)) * e);
}
// raka delen av depån (mellan inramp och utramp)
export function pitStraight(T, s) { const P = T.pit; if (!P) return false; const r = relS(T, s); return r > P.s0 + P.ramp && r < P.s1 - P.ramp; }
export const idxAt = (T, s) => { let i = Math.round(wrapS(T, s) / T.sp); return i >= T.n ? i - T.n : i; };
export { wrapA };
