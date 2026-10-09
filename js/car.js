// En bil: arkadfysik (styrning, motor, sidogrepp, luftfärd), markkontakt mot höjdkartan,
// räcken och banföljning (progress, varv, senaste säkra punkt). Egenskaper per fordon:
// svävare (lågt grepp, flyter över vatten/lava), pansarvagn (svänger på stället), terrängbilar.
import { nearest, nearestGlobal, wrapA, pitOff, pitStraight } from './trackgeo.js?v=1';
import { MAT } from './world-gen.js?v=1';
import { carStats, FRONT, REAR, CARS } from './cars.js?v=1';
import { MODELS } from './carsprites.js?v=1';
import { f1Stats, tyreGrip, COMPOUNDS, teamById, KMH_F1 } from './f1.js?v=1';

const GRAV = 560;
const SURF = {
  road: { grip: 1, vmax: 1, drag: 0.05 },
  shoulder: { grip: 0.92, vmax: 0.86, drag: 0.4 },
  grass: { grip: 0.66, vmax: 0.62, drag: 0.9 },
  sand: { grip: 0.6, vmax: 0.6, drag: 1.0 },
  snow: { grip: 0.48, vmax: 0.66, drag: 0.8 },
  rock: { grip: 0.8, vmax: 0.72, drag: 0.6 },
  ice: { grip: 0.26, vmax: 0.92, drag: 0.1 },
  hover: { grip: 1, vmax: 1, drag: 0.1 },
};

export class Car {
  constructor(opt) {
    Object.assign(this, {
      name: 'Bil', carId: 'pirat', color: 0xd8282c, isPlayer: false, upg: {}, acc: {}, frontW: 'kulspruta', frontLvl: 0, rearW: 'minor', rearLvl: 0,
    }, opt);
    if (this.f1) {
      // Grand Prix-bil: stallets färger och styrka, däck, depå
      const team = teamById(this.team);
      this.def = { name: team.name, model: 'f1' };
      this.model = 'f1'; this.carId = 'pirat';
      this.color = team.c1;
      this.pal = { paint: team.c1, paint2: team.c2, stripe: team.c3 };
      this.st = f1Stats(team.perf);
      this.tyre = { c: this.compound || 'medium', wear: 0 };
      this.used = new Set([this.tyre.c]);
      this.nextTyre = this.tyre.c === 'hard' ? 'medium' : 'hard';
      this.stops = 0; this.wing = 0; this.wingLost = false; this.punct = 0; this.tow = 0; this.drs = false; this.drsOk = false; this.pitPhase = null; this.pitT = 0; this.boxing = false; this.vcap = 0;
      this.frontW = 'kulspruta'; this.rearW = 'minor';
    } else {
      const C = CARS[this.carId];
      this.def = C;
      this.model = C.model;
      this.st = carStats(this.carId, this.upg, this.acc);
    }
    const M = MODELS[this.model];
    this.len = M.len; this.wid = M.wid;
    // kollisionscirklar längs bilen
    this.cr = Math.min(6.5, M.wid * 0.5);
    const span = Math.max(0, M.len / 2 - this.cr);
    const n = M.len > 2.6 * M.wid ? 3 : 2;
    this.co = Array.from({ length: n }, (_, k) => -span + (2 * span * k) / (n - 1));
    this.x = 0; this.y = 0; this.z = 0; this.vz = 0; this.vzg = 0; this.ang = 0;
    this.vx = 0; this.vy = 0; this.vf = 0; this.vr = 0; this.angVel = 0; this.steer = 0; this.air = false;
    this.inp = { steer: 0, gas: 0, brake: 0, fire: false, rear: false, nitro: false };
    this.si = 0; this.s = 0; this.d = 0; this.dist = 0; this.hw = 28; this.progress = 0; this.lap = 0; this.lastGood = 0;
    this.finished = false; this.finishTime = 0; this.place = 0;
    this.dmg = 0; this.wreckT = 0; this.inv = 0; this.sinkT = 0;
    this.nitro = this.st.nitro; this.nitroT = 0;
    this.ammoF = this.f1 ? 0 : FRONT[this.frontW].ammo + FRONT[this.frontW].perLvl * this.frontLvl;
    this.ammoR = this.f1 ? 0 : REAR[this.rearW].ammo + REAR[this.rearW].perLvl * this.rearLvl;
    this.maxF = this.ammoF; this.maxR = this.ammoR;
    this.coolF = 0; this.coolR = 0; this.smokeT = 0; this.oilT = 0; this.blindT = 0;
    this.tackleT = 0; this.burnT = 0; this.empT = 0; this.punkT = 0; this.glueT = 0; this.burnBy = null;
    this.money = 0; this.kills = 0; this.roadkill = 0; this.lastHitBy = null; this.lastHitT = 0;
    this.slip = 0; this.surf = 'road'; this.wrongT = 0; this.rubber = 1; this.lapTimes = []; this.lapStart = 0; this.bestLap = 0;
    this.hitFlash = 0; this.bump = 0; this.scrape = 0; this.landed = 0; this.firing = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
  get kmh() { return Math.round(this.speed * (this.f1 ? KMH_F1 : 0.8)); }
  get mass() { return this.st.mass; }

  placeAt(T, i, lat, back = 0) {
    const x = T.X[i] - T.TX[i] * back + T.NX[i] * lat, y = T.Y[i] - T.TY[i] * back + T.NY[i] * lat;
    this.x = x; this.y = y; this.z = T.Z[i]; this.ang = T.A[i];
    this.vx = this.vy = this.vf = this.vr = this.angVel = 0; this.air = false; this.vz = 0;
    this.si = i; this.lastGood = i;
  }

  track(R, q) {
    const T = R.T;
    nearest(T, this.x, this.y, this.si, 10, q);
    if (q.dist > q.hw + 160) nearestGlobal(T, this.x, this.y, q);
    const prevS = this.s;
    this.si = q.i; this.s = q.s; this.d = q.d; this.dist = q.dist; this.hw = q.hw; this.roadZ = q.z;
    let ds = this.s - prevS;
    if (ds < -T.L / 2) ds += T.L; else if (ds > T.L / 2) ds -= T.L;
    if (Math.abs(ds) < 60) this.progress += ds;
  }

  // mark under bilen; svävaren flyter på vatten och lava
  ground(W, x, y) {
    const g = W.groundAt(x, y, this.si);
    if (this.st.hover && W.gm === MAT.WATER) { W.gw = false; W.glava = false; return Math.max(g, 0); }
    return g;
  }

  step(dt, R) {
    const W = R.world, T = R.T, q = R.q, st = this.st, inp = this.inp;
    const grav = GRAV * (W.th.grav || 1);
    this.track(R, q);
    if (this.inv > 0) this.inv -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.wreckT > 0 || this.sinkT > 0) {
      const k = Math.exp(-2.5 * dt);
      this.vx *= k; this.vy *= k;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.air) { this.vz -= grav * dt; this.z += this.vz * dt; const g = W.groundAt(this.x, this.y, this.si); if (this.z < g) { this.z = g; this.air = false; this.vz = 0; } }
      if (this.sinkT > 0) { this.sinkT -= dt; this.z -= 6 * dt; if (this.sinkT <= 0) R.respawn(this); }
      else { this.wreckT -= dt; if (this.wreckT <= 0) R.respawn(this); }
      return;
    }
    // underlag
    this.ground(W, this.x, this.y);
    let surf = 'road';
    if (st.hover) surf = 'hover';
    else if (W.gdeck || this.dist < this.hw + 0.5) surf = 'road';
    else if (this.dist < this.hw + 6.5) surf = 'shoulder';
    else if (W.gm === MAT.WATER) surf = W.th.ice ? 'ice' : 'grass';
    else if (W.gm === MAT.SAND) surf = 'sand';
    else if (W.gm === MAT.ROCK) surf = 'rock';
    else surf = W.th.ground === 'snow' ? 'snow' : W.th.ground === 'sand' ? 'sand' : W.th.ground === 'moon' ? 'sand' : 'grass';
    // depåfilen och betongen vid depåmuren räknas som väg
    this.inPit = false;
    if (T.pit && surf !== 'road') {
      const po = pitOff(T, this.s);
      if (po !== null) {
        const sd = this.d * T.pit.side, pc = po * T.pit.side;
        if (Math.abs(sd - pc) < T.pit.hw + 2) { surf = 'road'; this.inPit = true; }
        else if (sd > this.hw && sd < pc) surf = 'road';
      }
    } else if (T.pit && this.d * T.pit.side > this.hw - 6) { const po = pitOff(T, this.s); if (po !== null && Math.abs(this.d - po) < T.pit.hw) this.inPit = true; }
    this.surf = surf;
    const S = SURF[surf];
    const offK = surf === 'road' || surf === 'shoulder' || surf === 'hover' ? 1 : st.offroad;
    let grip = S.grip * Math.min(1.25, offK), vmaxMul = Math.min(1, S.vmax * offK);
    if (this.f1) {
      const v = Math.abs(this.vx * Math.cos(this.ang) + this.vy * Math.sin(this.ang));
      // däcken, framvingen och smutsig luft styr hur skarpt bilen kan svänga (understyrning) och greppet
      this.turnK = tyreGrip(this.tyre.c, this.tyre.wear) * (1 - this.wing * 0.0022) * (1 - 0.05 * (this.dirty || 0)) * (this.punct ? 0.74 : 1);
      if (this.punct) vmaxMul *= 0.6;
      // utslitna däck kan smälla
      else if (this.tyre.wear > 105 && Math.random() < dt * 0.25) { this.punct = Math.random() < 0.5 ? -1 : 1; R.events('puncture', this, 'blow'); }
      grip *= this.turnK * (1 + st.df * (v / st.vmax) ** 2);
      vmaxMul *= (1 + 0.07 * this.tow) * (this.drs ? 1.075 : 1);
      // slitage: sträcka + sladd + utanför banan, skalat mot loppets längd
      const off = surf !== 'road' && surf !== 'shoulder' ? 1 : 0;
      this.tyre.wear += (v * dt * 0.0026 + Math.max(0, this.slip - 25) * dt * 0.05 + off * v * dt * 0.002) * COMPOUNDS[this.tyre.c].wear * (R.wearScale || 1);
    }
    if (this.oilT > 0) { this.oilT -= dt; grip *= st.tank ? 0.6 : 0.14; }
    if (this.tackleT > 0) { this.tackleT -= dt; grip *= st.tank ? 0.7 : 0.22; }
    if (this.empT > 0) { this.empT -= dt; vmaxMul *= 0.5; }
    if (this.punkT > 0) { this.punkT -= dt; vmaxMul *= 0.7; grip *= 0.85; }
    if (this.glueT > 0) { this.glueT -= dt; vmaxMul *= 0.38; }
    if (this.burnT > 0) { this.burnT -= dt; R.damage(this, 5 * dt, this.burnBy, 'fire'); }
    if (this.blindT > 0) this.blindT -= dt;
    if (this.coolF > 0) this.coolF -= dt;
    if (this.coolR > 0) this.coolR -= dt;
    if (this.nitroT > 0) this.nitroT -= dt;
    if (this.smokeT > 0) this.smokeT -= dt;
    if (this.firing > 0) this.firing -= dt;
    if (st.repair && this.dmg > 0) this.dmg = Math.max(0, this.dmg - st.repair * dt);

    // styrning (mjukad för digital input)
    let steerIn = inp.steer;
    if (this.empT > 0) steerIn += Math.sin(R.time * 23 + this.x) * 0.5;
    if (this.punct && !this.pitPhase) steerIn += this.punct * 0.14 * Math.min(1, Math.abs(this.vf || 0) / 80); // punkan drar åt sidan
    this.steer += (steerIn - this.steer) * Math.min(1, dt * (Math.abs(steerIn) > Math.abs(this.steer) ? 10 : 16));
    const fx = Math.cos(this.ang), fy = Math.sin(this.ang);
    let vf = this.vx * fx + this.vy * fy;
    if (!this.air) {
      const av = Math.abs(vf);
      const sc = st.tank ? 1 - 0.35 * Math.min(1, av / st.vmax) : Math.min(1, av / 55) * (1 - (st.tf || 0.3) * Math.min(1, av / st.vmax));
      this.ang += this.steer * st.turn * (this.turnK || 1) * sc * (vf < -5 ? -1 : 1) * dt;
    }
    this.ang += this.angVel * dt;
    this.angVel *= Math.exp(-(this.air ? 1 : st.hover ? 1.8 : 3.5) * dt);
    const c = Math.cos(this.ang), s = Math.sin(this.ang);
    const rx = -s, ry = c;
    vf = this.vx * c + this.vy * s;
    let vr = this.vx * rx + this.vy * ry;
    if (!this.air) {
      const nitro = this.nitroT > 0;
      let vmax = st.vmax * vmaxMul * (1 - this.dmg * 0.0022) * (nitro ? 1.3 : 1) * this.rubber;
      if (this.vcap) vmax = Math.min(vmax, this.vcap);
      if (inp.gas > 0) {
        if (vf < vmax) {
          const t = Math.max(0, vf) / vmax;
          vf += st.acc * (nitro ? 1.8 : 1) * inp.gas * (1 - t * t * 0.92) * dt;
          if (vf > vmax) vf = vmax;
        }
      }
      if (vf > vmax) vf -= (vf - vmax) * 1.6 * dt;
      if (inp.brake > 0) {
        if (vf > 8) vf -= (st.hover ? 300 : st.brk || 560) * inp.brake * dt;
        else vf = Math.max(vf - 220 * inp.brake * dt, -vmax * 0.38);
      }
      if (!(inp.gas > 0) && !(inp.brake > 0)) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (st.hover ? 20 : 55) * dt);
      vf -= vf * S.drag * dt;
      // sidogrepp (Coulomb): glid när svängen kräver mer än greppet
      const ga = st.grip * grip * dt;
      this.slip = Math.abs(vr);
      if (Math.abs(vr) <= ga) vr = 0; else { vr -= Math.sign(vr) * ga; vf -= Math.sign(vf) * Math.min(Math.abs(vf), Math.abs(vr) * (st.hover ? 0.15 : 0.6) * dt); }
    } else {
      this.slip = 0;
    }
    this.vf = vf; this.vr = vr;
    this.vx = c * vf + rx * vr; this.vy = s * vf + ry * vr;
    const ox = this.x, oy = this.y;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < 30) this.x = 30; if (this.y < 30) this.y = 30;
    if (this.x > W.W - 30) this.x = W.W - 30; if (this.y > W.H - 30) this.y = W.H - 30;

    // höjd: följ marken, lyft från krön, fall från kanter
    const g = this.ground(W, this.x, this.y);
    const wet = W.gw;
    if (!this.air) {
      if (g < this.z - 3.5) { this.air = true; this.vz = Math.max(0, this.vzg); }
      else {
        const vzg = (g - this.z) / dt;
        this.vzg += (vzg - this.vzg) * Math.min(1, dt * 20);
        this.z = g;
        if (wet) { R.splash(this); return; }
      }
    }
    if (this.air) {
      this.vz -= grav * dt; this.z += this.vz * dt;
      if (this.z <= g) {
        if (wet) { this.z = g; R.splash(this); return; }
        const hit = -this.vz;
        this.z = g; this.air = false; this.vz = 0; this.vzg = 0;
        this.landed = Math.min(1, hit / 200);
        if (hit > 170) R.damage(this, (hit - 170) * 0.14, null, 'land');
        if (hit > 90) R.events('land', this, hit);
      }
    }
    // väggar i höjdkartan (branta slänter, klippor, skogsbryn)
    this.terrainCollide(W, ox, oy, R);
    // räcken (i vägkoordinater)
    const fl = T.flags[this.si];
    const lim = this.hw + 4.6 - this.wid * 0.5;
    if ((fl & 2) && this.d > lim) this.railHit(T, 1, this.d - lim, R);
    else if ((fl & 4) && this.d < -lim) this.railHit(T, -1, -lim - this.d, R);
    // depåmuren mellan banan och depåfilen
    if (T.pit && pitStraight(T, this.s)) {
      const P = T.pit, sd = this.d * P.side, gap = sd - P.wall, need = this.wid / 2 + 1.2;
      if (Math.abs(gap) < need) {
        const dir = (gap < 0 ? -1 : 1) * P.side, pen = need - Math.abs(gap);
        const nx = T.NX[this.si] * dir, ny = T.NY[this.si] * dir;
        this.x += nx * pen; this.y += ny * pen;
        const vn = this.vx * nx + this.vy * ny;
        if (vn < 0) { this.vx -= nx * vn * 1.3; this.vy -= ny * vn * 1.3; if (-vn > 60) { R.damage(this, (-vn - 60) * 0.05, null, 'wall'); R.sparks(this.x - nx * 5, this.y - ny * 5, this.z + 3, 4); } }
      }
    }
    if (!this.air && this.dist < this.hw + 2 && !wet) this.lastGood = this.si;

    // fel håll
    const dot = this.vx * T.TX[this.si] + this.vy * T.TY[this.si];
    this.wrongT = dot < -30 ? this.wrongT + dt : 0;
  }

  railHit(T, side, pen, R) {
    const nx = T.NX[this.si] * side, ny = T.NY[this.si] * side; // pekar utåt
    this.x -= nx * pen; this.y -= ny * pen;
    const vn = this.vx * nx + this.vy * ny;
    if (vn > 0) {
      this.vx -= nx * vn * 1.35; this.vy -= ny * vn * 1.35;
      const k = 0.985; this.vx *= k; this.vy *= k;
      if (vn > 60) R.damage(this, (vn - 60) * 0.05, null, 'wall');
      if (vn > 25) R.sparks(this.x + nx * 6, this.y + ny * 6, this.z + 3, 4 + (vn / 30) | 0);
      this.scrape = Math.max(this.scrape, Math.min(1, vn / 120));
    }
  }

  terrainCollide(W, ox, oy, R) {
    const c = Math.cos(this.ang), s = Math.sin(this.ang);
    const a0 = this.len / 2 - 0.5, b0 = this.wid / 2 - 0.5;
    const probes = [[a0, b0], [a0, -b0], [-a0, b0], [-a0, -b0], [a0 + 1, 0]];
    for (let it = 0; it < 2; it++) {
      for (const [a, b] of probes) {
        const px = this.x + c * a - s * b, py = this.y + s * a + c * b;
        const gp = this.ground(W, px, py);
        if (gp <= this.z + 3.2 || W.gdeck) continue;
        let gx = this.ground(W, px + 1.5, py) - this.ground(W, px - 1.5, py);
        let gy = this.ground(W, px, py + 1.5) - this.ground(W, px, py - 1.5);
        let l = Math.hypot(gx, gy);
        let nx, ny;
        if (l < 0.3) { nx = this.x - px; ny = this.y - py; l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; }
        else { nx = -gx / l; ny = -gy / l; }
        let k = 0;
        while (k < 8 && this.ground(W, px + nx * k * 0.7, py + ny * k * 0.7) > this.z + 3.2) k++;
        this.x += nx * k * 0.7; this.y += ny * k * 0.7;
        const vn = this.vx * nx + this.vy * ny;
        if (vn < 0) {
          this.vx -= nx * vn * 1.35; this.vy -= ny * vn * 1.35;
          this.angVel += (a * ny - b * nx) * vn * 0.0016 * (a > 0 ? 1 : -1);
          if (-vn > 70) { R.damage(this, (-vn - 70) * 0.07, null, 'wall'); R.bumpFx(this, px, py, -vn); }
        }
      }
    }
    void ox; void oy;
  }

  wrongWay() { return this.wrongT > 1.2; }
  static wrapA = wrapA;
}
