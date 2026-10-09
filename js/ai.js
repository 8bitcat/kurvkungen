// Datorförare: racinglinje (inner i kurvorna), målfart ur krökningen med bromsprofil,
// omkörningar, vapen, nitro och återhämtning när de kört fast.
import { idxAt, wrapA } from './trackgeo.js?v=1';
import { tyreGrip } from './f1.js?v=1';

export function prepareAI(T) {
  const n = T.n;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = -Math.max(-1, Math.min(1, T.KS[i] * 260)) * (T.HW[i] - 9);
  // utjämna linjen
  let LO = raw;
  for (let p = 0; p < 3; p++) {
    const o = new Float32Array(n), R = 22;
    let acc = 0;
    for (let k = -R; k <= R; k++) acc += LO[(k + n) % n];
    for (let i = 0; i < n; i++) { o[i] = acc / (2 * R + 1); acc += LO[(i + R + 1) % n] - LO[(i - R + n) % n]; }
    LO = o;
  }
  const KM = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let k = 0;
    for (let o = -4; o <= 4; o++) k = Math.max(k, Math.abs(T.K[(i + o + n) % n]));
    KM[i] = k * 0.88; // linjen rätar ut kurvan något
  }
  T.LO = LO; T.KM = KM; T.vtCache = new Map();
}

// Målfart per sampel för en bil: begränsad av svängförmåga (styrningen) och grepp, med bromsprofil.
export function speedProfile(T, st) {
  const key = `${st.vmax | 0}-${st.turn.toFixed(2)}-${st.grip | 0}-${st.df || 0}-${st.tf || 0}-${st.brk || 0}`;
  const tf = st.tf || 0.3, brk = st.brk ? st.brk * 0.84 : 470;
  if (T.vtCache.has(key)) return T.vtCache.get(key);
  const n = T.n, VT = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.max(T.KM[i], 1e-5);
    const tk = st.turn / k;
    const vTurn = tk / (1 + tf * tk / st.vmax);
    let vGrip = Math.sqrt(st.grip * 0.8 / k);
    if (st.df) { const den = k - 0.8 * st.grip * st.df / (st.vmax * st.vmax); vGrip = den <= 0 ? 1e9 : Math.sqrt(0.8 * st.grip / den); }
    VT[i] = Math.min(vTurn * 0.98, vGrip, st.vmax * 1.4);
  }
  for (let pass = 0; pass < 2; pass++) for (let i = n - 1; i >= 0; i--) {
    const j = (i + 1) % n;
    VT[i] = Math.min(VT[i], Math.sqrt(VT[j] * VT[j] + 2 * brk * T.sp));
  }
  T.vtCache.set(key, VT);
  return VT;
}

export function makeAI(skill) {
  return {
    skill, // 0..1
    speed: 0.9 + skill * 0.13,
    line: 0.75 + skill * 0.25,
    bias: (Math.random() - 0.5) * 10,
    aggr: 0.25 + skill * 0.6,
    stuckT: 0, revT: 0, offT: 0, fireT: 0, rearT: 0, nitroT: 1 + Math.random() * 4, wob: Math.random() * 10,
  };
}

// AI:ns vapenbruk: räckvidd, kon (cos), hur länge avtryckaren hålls och väntetid efteråt
const WEAP = {
  kulspruta: { range: 230, cone: 0.975, hold: 0.4, cool: [0.2, 0.5] },
  raketer: { range: 380, cone: 0.82, hold: 0, cool: [2.5, 4] },
  kanon: { range: 420, cone: 0.985, hold: 0, cool: [2, 3] },
  laser: { range: 260, cone: 0.985, hold: 0.8, cool: [0.6, 1.2] },
  eld: { range: 80, cone: 0.88, hold: 1.0, cool: [0.4, 1] },
  blixt: { range: 320, cone: 0.6, hold: 0, cool: [3, 4] },
};
const sdiff = (T, a, b) => { let d = a - b; if (d > T.L / 2) d -= T.L; else if (d < -T.L / 2) d += T.L; return d; };

export function aiDrive(car, R, dt) {
  const T = R.T, ai = car.ai, inp = car.inp;
  inp.fire = false; inp.rear = false; inp.nitro = false;
  if (car.wreckT > 0 || car.sinkT > 0) return;
  const sp = car.speed;
  ai.wob += dt;
  // fastkörd?
  if (R.phase === 'race' && sp < 14 && inp.gas > 0) ai.stuckT += dt; else ai.stuckT = Math.max(0, ai.stuckT - dt);
  if (ai.stuckT > 1.1) { ai.revT = 0.9 + Math.random() * 0.4; ai.stuckT = 0; }
  if (car.dist > car.hw + 60 || car.wrongT > 2.5) { ai.offT += dt; if (ai.offT > 2.5) { R.respawn(car); ai.offT = 0; } } else ai.offT = 0;

  const look = 16 + sp * 0.3;
  const j = idxAt(T, car.s + look);
  let off = T.LO[j] * ai.line + ai.bias + Math.sin(ai.wob * 0.7) * 3;
  // undvik bilar framför
  let brakeFor = 1e9;
  const scan = car.f1 ? 40 + sp * 0.3 : 75;
  for (const o of R.cars) {
    if (o === car || o.wreckT > 0 || (car.f1 && o.pitPhase && !car.pitPhase)) continue;
    const ds = sdiff(T, o.s, car.s);
    const dd = o.d - car.d;
    // F1: bil bredvid (även lite bakom) – kläm dig inte in mot den i kurvan
    if (car.f1 && ds > -22 && ds <= 4 && Math.abs(dd) < 15) { const side = car.d - o.d >= 0 ? 1 : -1; off = side > 0 ? Math.max(off, o.d + 15) : Math.min(off, o.d - 15); continue; }
    if (ds <= 0 || ds > scan) continue;
    if (Math.abs(dd) < 13) {
      const side = car.d - o.d >= 0 ? 1 : -1;
      off = car.d + side * (14 - Math.abs(dd)) * 1.4;
      // F1: bromsa i tid för en långsammare bil framför (stängningsfarten mot avståndet)
      if (car.f1) { const close = sp - o.speed, gap = ds - 26; if (close > 0 && gap < close * 0.55) brakeFor = Math.min(brakeFor, o.speed + Math.max(0, gap) * 1.2); }
      else if (ds < 26 && o.speed < sp - 25) brakeFor = Math.min(brakeFor, o.speed + 10);
    }
  }
  // stora djur på vägen: kör runt (eller bromsa)
  if (R.animals) for (const a of R.animals.list) {
    if (a.S.size === 's' || a.state === 'dead' || a.state === 'flat' || a.state === 'gone' || a.state === 'fly') continue;
    const dx = a.x - car.x, dy = a.y - car.y, dist = Math.hypot(dx, dy);
    if (dist > 110) continue;
    const fx = Math.cos(car.ang), fy = Math.sin(car.ang), along = dx * fx + dy * fy;
    if (along < 0) continue;
    const lat = -dx * fy + dy * fx; // + = till höger om bilen
    if (Math.abs(lat) < a.S.r + 9) {
      const nx = T.NX[car.si], ny = T.NY[car.si];
      const ad = car.d + (dx * nx + dy * ny);
      off = ad + (car.d >= ad ? 1 : -1) * (a.S.r + 12);
      if (a.S.size === 'l' && ai.skill > 0.3) brakeFor = Math.min(brakeFor, 90 + along * 0.8);
    }
  }
  const hw = T.HW[j] - 7;
  if (off > hw) off = hw; else if (off < -hw) off = -hw;
  const tx = T.X[j] + T.NX[j] * off, ty = T.Y[j] + T.NY[j] * off;
  let err = wrapA(Math.atan2(ty - car.y, tx - car.x) - car.ang);
  let steer = err * 2.8 - car.angVel * 0.25;
  if (car.blindT > 0) steer += Math.sin(ai.wob * 9) * 0.9;
  inp.steer = Math.max(-1, Math.min(1, steer));

  // fart
  const VT = car.vt || (car.vt = speedProfile(T, car.st));
  let vt = 1e9;
  for (const a of [6, 20, 40, 70]) vt = Math.min(vt, VT[idxAt(T, car.s + a + sp * 0.1)]);
  vt *= ai.speed;
  if (car.f1) vt *= Math.pow(car.turnK || tyreGrip(car.tyre.c, car.tyre.wear), 0.8);
  vt = Math.min(vt, brakeFor);
  if (car.oilT > 0 || car.blindT > 0) vt *= 0.85;
  inp.gas = sp < vt ? 1 : 0;
  inp.brake = sp > vt + 22 ? 1 : 0;
  if (Math.abs(err) > 1.4 && sp > 60) { inp.gas = 0; inp.brake = 1; }
  if (ai.revT > 0) { ai.revT -= dt; inp.gas = 0; inp.brake = 1; inp.steer = -Math.sign(err || 1); return; }
  if (R.phase !== 'race') return;

  // nitro på raksträckor
  ai.nitroT -= dt;
  if (ai.nitroT < 0 && car.nitro > 0 && VT[idxAt(T, car.s + 160)] > car.st.vmax * 1.2 && VT[idxAt(T, car.s + 60)] > car.st.vmax * 1.2 && Math.abs(err) < 0.15) {
    inp.nitro = true; ai.nitroT = 6 + Math.random() * 10 * (1.2 - ai.skill);
  }
  // vapen
  ai.fireT -= dt; ai.rearT -= dt;
  const fx = Math.cos(car.ang), fy = Math.sin(car.ang);
  const W = WEAP[car.frontW];
  if (ai.holdT > 0) { ai.holdT -= dt; inp.fire = car.ammoF > 0; }
  for (const o of R.cars) {
    if (o === car || o.wreckT > 0 || o.inv > 0) continue;
    const dx = o.x - car.x, dy = o.y - car.y, dist = Math.hypot(dx, dy);
    const along = (dx * fx + dy * fy) / (dist || 1);
    if (car.ammoF > 0 && ai.fireT < 0 && dist < W.range && along > W.cone) {
      if (Math.random() < ai.aggr * (o.isPlayer ? 1.1 : 0.7)) { inp.fire = true; ai.holdT = W.hold; ai.fireT = W.cool[0] + Math.random() * W.cool[1]; }
      else ai.fireT = 0.6;
    }
    const rearRange = car.rearW === 'bakraket' ? 300 : 80;
    if (car.ammoR > 0 && ai.rearT < 0 && dist < rearRange && along < (car.rearW === 'bakraket' ? -0.6 : -0.85)) {
      if (Math.random() < ai.aggr * 0.5) inp.rear = true;
      ai.rearT = 2 + Math.random() * 3;
    }
  }
}
