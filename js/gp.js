// Grand Prix-loppets regler: startljus, slipstream och smutsig luft, DRS-zoner, depåstopp med
// däckbyte (autopilot genom depåfilen), datorförarnas däckstrategi och regeln om två blandningar.
import { relS, pitOff, idxAt, wrapA } from './trackgeo.js?v=1';
import { PIT_LIMIT, TEAMS, tyreGrip } from './f1.js?v=1';
import { speedProfile, prepareAI } from './ai.js?v=1';

// Däckens livslängd i andel av loppet (wearScale = 10 / varv gör att det gäller alla längder)
const LIFE = { soft: 0.43, medium: 0.7, hard: 1.05 };
const STRATS = [
  [['medium', 0.5], ['hard', 1]], [['soft', 0.36], ['hard', 1]], [['hard', 0.62], ['medium', 1]],
  [['medium', 0.55], ['soft', 1]], [['soft', 0.33], ['medium', 0.7], ['soft', 1]], [['soft', 0.38], ['soft', 0.72], ['medium', 1]],
];

export function gpSetup(R, opt) {
  const T = R.T;
  R.f1 = true;
  // kvalet slits som loppet det gäller; i bakgrundsloppet slits inget
  R.wearScale = R.mode === 'attract' ? 1e-4 : Math.max(0.6, Math.min(3.5, 10 / (opt.wearLaps || R.laps)));
  R.lightsTotal = R.mode === 'attract' ? 0.01 : 5 + 0.3 + Math.random() * 1.1;
  R.countdown = R.lightsTotal;
  R.lights = 0;
  // DRS: raksträckor längre än 650 enheter
  R.drsZones = [];
  let run = 0, start = 0;
  for (let i = 0; i < T.n * 2; i++) {
    const k = Math.abs(T.KS[i % T.n]);
    if (k < 0.0011) { if (!run) start = i; run++; }
    else { if (run * T.sp > 650 && start < T.n) R.drsZones.push({ start: start * T.sp + 120, end: (i - 1) * T.sp - 60, detect: start * T.sp - 160 }); run = 0; }
  }
  R.drsZones = R.drsZones.filter((z) => z.end - z.start > 300).slice(0, 3);
  for (const c of R.cars) {
    c.teamIdx = TEAMS.findIndex((t) => t.id === c.team);
    if (c.ai && R.mode !== 'time') planStrategy(c, R);
  }
}

export function planStrategy(c, R) {
  const strat = STRATS[(Math.random() * STRATS.length) | 0].map(([cc, u]) => [cc, Math.min(1, u + (Math.random() - 0.5) * 0.08)]);
  c.plan = strat; c.planStage = 0;
  if (R.laps < 3) { c.plan = [[c.tyre.c, 1]]; return; }
  c.tyre.c = strat[0][0]; c.used = new Set([c.tyre.c]);
  c.nextTyre = strat[1] ? strat[1][0] : 'hard';
}

// startljusen: fem röda tänds ett i taget, släcks efter en slumpad paus
export function gpCountdown(R, dt) {
  const before = R.lights;
  R.countdown -= dt;
  const el = R.lightsTotal - R.countdown;
  R.lights = Math.min(5, Math.max(0, Math.floor(el + 0.5)));
  if (R.lights > before) R.events('light', R.lights);
  if (R.countdown <= 0) { R.phase = 'race'; R.lights = 0; R.events('go', 0); for (const c of R.cars) c.lapStart = 0; }
}

// slipstream (mer toppfart) och smutsig luft (mindre grepp i kurvor) bakom en annan bil
export function gpAero(R) {
  const cs = R.cars;
  for (const a of cs) { a.tow = 0; a.dirty = 0; }
  for (const a of cs) {
    if (a.pitPhase || a.speed < 120) continue;
    const fx = Math.cos(a.ang), fy = Math.sin(a.ang);
    for (const b of cs) {
      if (b === a || b.pitPhase) continue;
      const dx = b.x - a.x, dy = b.y - a.y, along = dx * fx + dy * fy;
      if (along < 6 || along > 95) continue;
      const lat = Math.abs(-dx * fy + dy * fx);
      if (lat > 12) continue;
      const t = 1 - along / 95;
      a.tow = Math.max(a.tow, t * (lat < 6 ? 1 : 0.55));
      a.dirty = Math.max(a.dirty, t);
    }
  }
}

// DRS: inom 1 s från bilen framför vid mätpunkten → får öppna vingen i zonen
export function gpDRS(R, c) {
  const T = R.T;
  // kvalet: vingen får öppnas fritt i zonerna
  if (R.mode === 'time') {
    const inZ = R.phase === 'race' && R.drsZones.some((Z) => relS(T, c.s - Z.start) >= 0 && relS(T, c.s - Z.end) < 0);
    if (!inZ) { c.drsOk = false; c.drs = false; return; }
    if (!c.drsOk) c.drsOk = true;
    if (c.ai || c.inp.fire) c.drs = true;
    if (c.inp.brake > 0) { c.drs = false; }
    return;
  }
  if (!R.drsZones.length || R.raceTime < 20 || c.pitPhase) { c.drs = false; c.drsOk = false; return; }
  const s = c.s, prev = c.prevS ?? s;
  for (let z = 0; z < R.drsZones.length; z++) {
    const Z = R.drsZones[z];
    const cross = (a, b, p) => { const d1 = relS(T, a - p), d2 = relS(T, b - p); return d1 < 0 && d2 >= 0 && d2 - d1 < 100; };
    if (cross(prev, s, Z.detect)) {
      const k = R.order.indexOf(c), ahead = k > 0 ? R.order[k - 1] : null;
      c.drsOk = !!(ahead && !ahead.finished && (ahead.progress - c.progress) / Math.max(150, c.speed) < 1.0);
      c.drsZone = z;
    }
  }
  const Z = c.drsZone != null ? R.drsZones[c.drsZone] : null;
  const inZone = Z && relS(T, s - Z.start) >= 0 && relS(T, s - Z.end) < 0;
  if (!inZone) { if (Z && relS(T, s - Z.end) >= 0 && relS(T, s - Z.end) < 200) { c.drsOk = false; } c.drs = false; }
  else if (c.drsOk) {
    if (c.ai) c.drs = true;
    else if (c.inp.fire) c.drs = true;
    if (c.inp.brake > 0) { c.drs = false; c.drsOk = false; }
  }
  c.prevS = s;
}

function aiWantsPit(c, R) {
  if (c.punct || c.wingLost) return !c.finished;
  if (R.laps < 3 || !c.plan) return false;
  const frac = c.progress / (R.laps * R.T.L);
  const st = c.planStage;
  if (st >= c.plan.length - 1) return c.tyre.wear > 97 && frac < 0.9;
  const left = R.laps - c.lap;
  if (left < 1) return false;
  return frac >= c.plan[st][1] - 0.03 || c.tyre.wear > 86 || c.wing > 45;
}

// Körning i depån: styr längs depåfilens mittlinje, håll fartgränsen, stanna vid stallets ruta
function steerAlong(c, R, latFn) {
  const T = R.T, sp = c.speed;
  const look = c.pitPhase ? 10 + sp * 0.16 : 16 + sp * 0.25;
  const j = idxAt(T, c.s + look);
  const lat = latFn(c.s + look);
  const tx = T.X[j] + T.NX[j] * lat, ty = T.Y[j] + T.NY[j] * lat;
  const err = wrapA(Math.atan2(ty - c.y, tx - c.x) - c.ang);
  c.inp.steer = Math.max(-1, Math.min(1, err * 2.8 - c.angVel * 0.25));
}
export function gpCar(R, c, dt) {
  const T = R.T, P = T.pit;
  c.vcap = 0;
  gpDRS(R, c);
  if (!P || R.phase === 'countdown' || R.mode === 'time') return;
  const rs = relS(T, c.s);
  if (c.finished && !c.pitPhase) return;
  // spelare (även online-gäster): punka eller tappad vinge ställer in BOX en gång – B ångrar
  if (!c.ai && !c.pitPhase && (c.punct || c.wingLost) && !c.autoBox && !c.finished) { c.autoBox = true; c.boxing = true; }
  if (c.ai && !c.pitPhase) { const w = aiWantsPit(c, R); if (w && !c.boxing) { c.nextTyre = c.plan[Math.min(c.plan.length - 1, c.planStage + 1)][0]; } c.boxing = w; }
  // AI och spelare som ska in: styr mot depåinfarten före rampen
  if (!c.pitPhase && c.boxing && rs > P.s0 - 220 && rs < P.s0 + P.ramp) {
    steerAlong(c, R, (s) => { const po = pitOff(T, s); return P.side * Math.max(T.HW[0] - 2, po !== null ? Math.abs(po) : 0); });
    c.inp.gas = 1; c.inp.brake = c.speed > 230 ? 1 : 0;
  }
  if (!c.pitPhase) {
    const enterZone = rs > P.s0 + 10 && rs < P.s0 + P.ramp;
    if (enterZone && (c.boxing || c.inPit) && c.d * P.side > T.HW[0] - 6) { c.pitPhase = 'in'; R.events('pitin', c); }
    else return;
  }
  const box = P.boxS[Math.max(0, c.teamIdx)] + (c.seat ? 6 : -6);
  // två filer: snabbfilen närmast banan, rutorna närmast garagen
  steerAlong(c, R, (s) => {
    const po = pitOff(T, s);
    if (po === null) return 0;
    const e = Math.max(0, Math.min(1, (Math.abs(po) - (T.HW[0] - 8)) / (P.mid - (T.HW[0] - 8))));
    const toBox = box - relS(T, s);
    const inBox = (c.pitPhase === 'in' && toBox < 26) || (c.pitPhase === 'out' && toBox > -30);
    return po + P.side * 7 * e * (inBox ? 1 : -1);
  });
  let vt = 1e9;
  if (c.pitPhase === 'in') {
    if (rs < P.s0 + P.ramp) vt = PIT_LIMIT + Math.max(0, P.s0 + P.ramp - rs) * 1.3;
    else c.vcap = PIT_LIMIT;
    const dist = box - rs;
    // stallkamraten står i rutan → vänta
    const mate = R.cars.find((o) => o !== c && o.team === c.team && o.pitPhase === 'stop');
    if (mate && dist < 40) vt = Math.min(vt, dist > 22 ? 30 : 0);
    else if (dist < 60) vt = Math.min(vt, Math.sqrt(2 * 240 * Math.max(0, dist - 0.5)));
    if (dist < 2 && c.speed < 25 && !mate) {
      // stopptiden byggs av skadorna: däcken, framvingen eller en ny nos, punkan
      const work = [['DÄCK', 2.0 + Math.random() * 0.7]];
      if (c.wingLost) work.push(['NY NOS', 5.4 + Math.random() * 1.2]);
      else if (c.wing > 12) work.push(['FRAMVINGE', 0.8 + c.wing * 0.045]);
      if (c.punct) work.push(['PUNKA', 1.0 + Math.random() * 0.6]);
      c.pitWork = work; c.pitT = c.pitT0 = work.reduce((a, w) => a + w[1], 0);
      c.pitPhase = 'stop'; c.vx = c.vy = 0; R.events('pitstop', c);
    }
  } else if (c.pitPhase === 'stop') {
    c.vx = c.vy = 0; c.inp.gas = 0; c.inp.brake = 0; c.inp.steer = 0; // (bromsen backar i stillastående)
    c.pitT -= dt;
    if (c.pitT <= 0) {
      c.tyre = { c: c.nextTyre || 'medium', wear: 0 };
      c.used.add(c.tyre.c); c.stops++; c.wing = 0; c.wingLost = false; c.punct = 0; c.boxing = false; c.autoBox = false;
      if (c.plan) { c.planStage++; const nx = c.plan[Math.min(c.plan.length - 1, c.planStage + 1)]; c.nextTyre = nx ? nx[0] : 'hard'; }
      else c.nextTyre = c.tyre.c === 'hard' ? 'medium' : 'hard';
      c.pitPhase = 'out';
      R.events('pitdone', c, c.tyre.c);
    }
    return;
  } else if (c.pitPhase === 'out') {
    if (rs < P.s1 - P.ramp) c.vcap = PIT_LIMIT;
    if (rs > P.s1 - 30 || rs < P.s0) c.pitPhase = null;
  }
  // fastnat i in- eller utfarten (t.ex. knuffad mot depåmuren): flytta in i filen
  if (c.speed < 6 && c.pitPhase !== 'stop' && !R.cars.some((o) => o !== c && o.team === c.team && o.pitPhase === 'stop')) c.pitStuck = (c.pitStuck || 0) + dt;
  else c.pitStuck = 0;
  if (c.pitStuck > 2.5) {
    c.pitStuck = 0;
    const po = pitOff(T, c.s + 12);
    if (po === null) c.pitPhase = null;
    else { c.placeAt(T, idxAt(T, c.s + 12), po); c.vx = Math.cos(c.ang) * 40; c.vy = Math.sin(c.ang) * 40; R.events('rescue', c); }
  }
  const sp = c.speed;
  c.inp.gas = sp < Math.min(vt, c.vcap || 1e9) ? 1 : 0;
  c.inp.brake = sp > Math.min(vt, c.vcap || 1e9) + 8 ? 1 : 0;
  c.inp.fire = c.inp.rear = c.inp.nitro = false;
  c.drs = false;
}

// efter målgång: tvåblandningsregeln
export function gpFinish(R, c) {
  if (R.laps >= 3 && c.used.size < 2) { c.finishTime += 20; c.penalty = 20; R.events('penalty', c); }
}

// Uppskattad varvtid (kvalet): fartprofilen × förarens tempo, accelerationen som i bilens motor.
// LAP_CAL kalibreras mot riktiga datorvarv (tools/gpcal.mjs).
const LAP_CAL = 1.04;
export function lapEstimate(T, st, skill, compound = 'soft') {
  if (!T.KM) prepareAI(T);
  const VT = speedProfile(T, st);
  const k = (0.9 + skill * 0.13) * Math.pow(tyreGrip(compound, 0), 0.8);
  let v = 0, t = 0;
  for (let p = 0; p < 2; p++) for (let i = 0; i < T.n; i++) {
    const f = Math.min(1, v / st.vmax);
    v = Math.min(VT[i] * k, st.vmax, Math.sqrt(v * v + 2 * st.acc * (1 - f * f * 0.92) * T.sp));
    if (p) t += T.sp / Math.max(20, v);
  }
  return t * LAP_CAL;
}
