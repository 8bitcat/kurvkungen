// Ett lopp: startuppställning, nedräkning, fast tidssteg, krockar bil–bil och bil–rekvisita,
// vapen och projektiler, upplockningar, varv, placeringar, vrak och återinsättning.
import { Car } from './car.js?v=1';
import { prepareAI, makeAI, aiDrive } from './ai.js?v=1';
import { FX } from './fx.js?v=1';
import { idxAt } from './trackgeo.js?v=1';
import { CONE_DOWN, oilSprite } from './props.js?v=1';
import { css } from './pix.js?v=1';

const STEP = 1 / 120;
const PICK_KINDS = ['pengar', 'pengar', 'reparera', 'ammo', 'nitro', 'pengar'];

export class Race {
  constructor(world, opt) {
    this.world = world; this.T = world.T; this.q = {};
    this.laps = opt.laps || 3;
    this.mode = opt.mode || 'race'; // race | attract | time
    this.fx = new FX();
    this.events = opt.events || (() => {});
    this.cars = [];
    this.time = 0; this.raceTime = 0; this.phase = 'countdown'; this.countdown = opt.countdown ?? 3.6;
    this.acc = 0; this.finishOrder = []; this.endT = 0;
    this.bullets = []; this.missiles = []; this.mines = []; this.oils = []; this.smokes = [];
    this.tmp = [];
    prepareAI(this.T);
    const T = this.T;
    // startrutor bakom linjen (två led)
    const grid = [];
    for (let k = 0; k < 8; k++) {
      const s = T.L - 26 - k * 28;
      grid.push({ i: idxAt(T, s), lat: (k & 1 ? -1 : 1) * T.HW[0] * 0.44 });
    }
    opt.cars.forEach((c, k) => {
      const car = new Car(c);
      const g = grid[k];
      car.placeAt(T, g.i, g.lat);
      car.s = g.i * T.sp; car.progress = car.s - T.L;
      car.gridIndex = k;
      if (!car.isPlayer || this.mode === 'attract' || opt.autopilot) car.ai = makeAI(c.skill ?? 0.5);
      this.cars.push(car);
    });
    this.player = this.cars.find((c) => c.isPlayer) || null;
    this.order = [...this.cars].sort((a, b) => b.progress - a.progress);
    this.order.forEach((c, k) => { c.place = k + 1; });
    // upplockningar längs banan
    this.picks = [];
    if (this.mode !== 'time') {
      const spacing = 330;
      for (let s = 260, k = 0; s < T.L - 120; s += spacing, k++) {
        const i = idxAt(T, s);
        if (T.flags[i] & 1) continue;
        const kind = PICK_KINDS[k % PICK_KINDS.length];
        for (const lat of k % 2 ? [-0.45, 0.45] : [0]) {
          this.picks.push({ kind, x: T.X[i] + T.NX[i] * lat * T.HW[i], y: T.Y[i] + T.NY[i] * lat * T.HW[i], z: T.Z[i], respawn: 0, si: i });
        }
      }
    }
  }

  get leader() { return this.order ? this.order[0] : this.cars[0]; }

  update(dt) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) { this.acc -= STEP; this.tick(STEP); }
    this.fx.update(dt);
  }

  tick(dt) {
    this.time += dt;
    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after >= 0 && after <= 3) this.events(after === 0 ? 'go' : 'count', after);
      if (this.countdown <= 0) { this.phase = 'race'; for (const c of this.cars) c.lapStart = 0; }
    } else this.raceTime += dt;
    const racing = this.phase === 'race' || this.phase === 'finish';
    // rubberband: datorbilar nära spelaren
    const ref = this.player && !this.player.finished ? this.player : null;
    for (const c of this.cars) {
      if (c.ai) aiDrive(c, this, dt);
      if (!racing) { c.inp.gas = c.inp.gas > 0 ? c.inp.gas : 0; c.inp.fire = c.inp.rear = c.inp.nitro = false; }
      if (c.ai && ref && this.mode === 'race') {
        const gap = c.progress - ref.progress;
        const sk = c.ai.skill;
        c.rubber = gap < -120 ? 1 + Math.min(0.12, (-gap - 120) / 2500) : gap > 200 ? 1 - Math.min(0.1 - sk * 0.05, (gap - 200) / 3000) : 1;
      } else c.rubber = 1;
      if (!racing) {
        // stå still vid start (men varva motorn)
        c.vx = c.vy = 0;
        continue;
      }
      if (c.finished && c.isPlayer && this.mode !== 'attract') { c.inp.gas = 0.4; c.inp.brake = 0; }
      c.step(dt, this);
      this.rescue(c, dt);
      this.weapons(c, dt);
      this.carEffects(c, dt);
    }
    if (racing) {
      this.collideCars();
      this.collideProps(dt);
      this.projectiles(dt);
      this.pickups(dt);
      this.laps_(dt);
    }
  }

  // Bilar som fastnat eller irrar utanför banan sätts tillbaka
  rescue(c, dt) {
    if (c.finished && !c.ai) return;
    if (c.wreckT > 0 || c.sinkT > 0 || this.raceTime < 3) { c.progT = 0; c.progMark = c.progress; return; }
    c.progT = (c.progT || 0) + dt;
    if (c.progMark === undefined) c.progMark = c.progress;
    const off = c.dist > c.hw + 8;
    const limit = off ? (c.isPlayer && !c.ai ? 3.5 : 2.5) : (c.isPlayer && !c.ai ? 1e9 : 5);
    if (c.progT > limit) {
      if (c.progress - c.progMark < 50) { this.respawn(c); if (c.isPlayer) this.events('rescue', c); }
      c.progT = 0; c.progMark = c.progress;
    }
  }

  // ---------- skada, vrak, återinsättning ----------
  damage(car, amt, by, why) {
    if (car.inv > 0 || car.wreckT > 0 || amt <= 0) return;
    car.dmg += amt * car.st.armor;
    car.hitFlash = 0.15;
    if (by && by !== car) { car.lastHitBy = by; car.lastHitT = this.time; }
    if (car.dmg >= 100) this.wreck(car, why);
  }
  wreck(car) {
    car.dmg = 100; car.wreckT = 2.4; car.air = true; car.vz = 150;
    car.angVel += (Math.random() - 0.5) * 8;
    this.fx.explosion(car.x, car.y, car.z, car.color, 1);
    for (let k = 0; k < 20; k++) this.world.mark(car.x + (Math.random() - 0.5) * 18, car.y + (Math.random() - 0.5) * 18, car.z, '#1a1418', 0.5, 2);
    const killer = car.lastHitBy && this.time - car.lastHitT < 4 ? car.lastHitBy : null;
    if (killer) { killer.kills++; killer.money += 150; }
    this.events('wreck', car, killer);
    // tryckvåg
    for (const o of this.cars) {
      if (o === car) continue;
      const d = Math.hypot(o.x - car.x, o.y - car.y);
      if (d < 40) { this.damage(o, (40 - d) * 0.4, car, 'blast'); this.push(o, o.x - car.x, o.y - car.y, (40 - d) * 5); }
    }
  }
  splash(car) {
    if (car.sinkT > 0) return;
    car.sinkT = 1.3; car.vx *= 0.2; car.vy *= 0.2; car.air = false;
    this.fx.splash(car.x, car.y, 0, 40);
    this.events('splash', car);
  }
  respawn(car) {
    const T = this.T;
    let i = car.lastGood;
    // flytta fram en bit om någon står där
    let lat = 0;
    for (let tries = 0; tries < 6; tries++) {
      const x = T.X[i] + T.NX[i] * lat, y = T.Y[i] + T.NY[i] * lat;
      if (!this.cars.some((o) => o !== car && Math.hypot(o.x - x, o.y - y) < 16)) break;
      lat = lat <= 0 ? -lat + 11 : -lat;
      if (Math.abs(lat) > T.HW[i] - 8) { lat = 0; i = (i + 8) % T.n; }
    }
    const keepProg = car.progress, oldS = car.s;
    car.placeAt(T, i, lat);
    car.track(this, this.q);
    let ds = car.s - oldS;
    if (ds > T.L / 2) ds -= T.L; else if (ds < -T.L / 2) ds += T.L;
    car.progress = keepProg + Math.min(0, ds);
    const v = 70;
    car.vx = Math.cos(car.ang) * v; car.vy = Math.sin(car.ang) * v;
    car.inv = 2; car.wreckT = 0; car.sinkT = 0; car.oilT = 0;
    if (car.dmg >= 100) car.dmg = 35;
    this.events('respawn', car);
  }
  push(car, dx, dy, imp) {
    const l = Math.hypot(dx, dy) || 1;
    car.vx += dx / l * imp / car.st.mass; car.vy += dy / l * imp / car.st.mass;
  }
  sparks(x, y, z, n) { this.fx.sparks(x, y, z, n); }
  bumpFx(car, x, y, v) { this.fx.sparks(x, y, car.z + 3, 3 + (v / 40) | 0); this.events('bump', car, v); }

  // ---------- krockar ----------
  collideCars() {
    const cs = this.cars;
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
      const A = cs[a], B = cs[b];
      if (A.sinkT > 0 || B.sinkT > 0) continue;
      if (Math.abs(A.z - B.z) > 9) continue;
      const dx0 = B.x - A.x, dy0 = B.y - A.y;
      if (dx0 * dx0 + dy0 * dy0 > 30 * 30) continue;
      const ca = [Math.cos(A.ang), Math.sin(A.ang)], cb = [Math.cos(B.ang), Math.sin(B.ang)];
      for (const oa of [5.2, -5.2]) for (const ob of [5.2, -5.2]) {
        const ax = A.x + ca[0] * oa, ay = A.y + ca[1] * oa, bx = B.x + cb[0] * ob, by = B.y + cb[1] * ob;
        const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy, R = 10;
        if (d2 >= R * R || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = R - d;
        const ma = A.st.mass * (A.wreckT > 0 ? 2 : 1), mb = B.st.mass * (B.wreckT > 0 ? 2 : 1), im = 1 / ma + 1 / mb;
        A.x -= nx * pen * (1 / ma) / im; A.y -= ny * pen * (1 / ma) / im;
        B.x += nx * pen * (1 / mb) / im; B.y += ny * pen * (1 / mb) / im;
        const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rv < 0) {
          const j = -(1 + 0.35) * rv / im;
          A.vx -= nx * j / ma; A.vy -= ny * j / ma; B.vx += nx * j / mb; B.vy += ny * j / mb;
          // vridning från träffpunktens hävarm
          A.angVel += (ca[0] * ny - ca[1] * nx) * oa * j * 0.0011 / ma;
          B.angVel -= (cb[0] * ny - cb[1] * nx) * ob * j * 0.0011 / mb;
          const hit = -rv;
          if (hit > 55) {
            const dmg = (hit - 55) * 0.075;
            this.damage(A, dmg * mb / (ma + mb) * 1.6, B, 'ram'); this.damage(B, dmg * ma / (ma + mb) * 1.6, A, 'ram');
            this.fx.sparks((ax + bx) / 2, (ay + by) / 2, A.z + 4, 4 + (hit / 25) | 0);
            this.events('crash', A, hit, B);
          }
        }
      }
    }
  }
  collideProps(dt) {
    const W = this.world, near = this.tmp;
    for (const c of this.cars) {
      if (c.sinkT > 0) continue;
      W.propsNear(c.x, c.y, 24, near);
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
      for (const p of near) {
        if (!p.r || p.down) continue;
        if (c.z > p.z + 14) continue;
        for (const o of [5.2, -5.2]) {
          const cx = c.x + fx * o, cy = c.y + fy * o;
          const dx = cx - p.x, dy = cy - p.y, R = 5 + p.r, d2 = dx * dx + dy * dy;
          if (d2 >= R * R) continue;
          const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d;
          if (p.dyn) { // kon: flyger iväg
            p.down = true; p.vx = c.vx * 1.1 + nx * -40 + (Math.random() - 0.5) * 60; p.vy = c.vy * 1.1 + ny * -40 + (Math.random() - 0.5) * 60; p.vz = 60 + Math.random() * 60; p.zz = 0; p.spr = CONE_DOWN; p.r = 0;
            this.events('cone', c);
            break;
          }
          c.x += nx * (R - d); c.y += ny * (R - d);
          const vn = c.vx * nx + c.vy * ny;
          if (vn < 0) {
            c.vx -= nx * vn * 1.4; c.vy -= ny * vn * 1.4;
            c.angVel += (fx * ny - fy * nx) * o * vn * 0.004;
            if (-vn > 60) { this.damage(c, (-vn - 60) * 0.08, null, 'tree'); this.bumpFx(c, p.x, p.y, -vn); }
          }
        }
      }
    }
    // flygande koner
    for (const p of W.props) {
      if (!p.dyn || !p.down || p.vz === undefined || p.vz === null) continue;
      if (p.vx || p.vy || p.zz > 0 || p.vz > 0) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= 500 * dt; p.zz = Math.max(0, (p.zz || 0) + p.vz * dt);
        if (p.zz === 0) { p.vx *= 0.9; p.vy *= 0.9; p.vz = Math.abs(p.vz) > 40 ? -p.vz * 0.3 : 0; }
        if (Math.abs(p.vx) + Math.abs(p.vy) < 3 && p.zz === 0) { p.vx = p.vy = 0; }
        p.depth = p.x + p.y;
      }
    }
  }

  // ---------- vapen ----------
  weapons(c, dt) {
    if (c.wreckT > 0 || c.sinkT > 0) return;
    const inp = c.inp, fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    if (inp.nitro && c.nitro > 0 && c.nitroT <= 0) { c.nitro--; c.nitroT = 1.8; this.events('nitro', c); }
    if (inp.fire && c.ammoF > 0 && c.coolF <= 0) {
      if (c.frontW === 'kulspruta') {
        c.ammoF--; c.coolF = 0.085;
        const a = c.ang + (Math.random() - 0.5) * 0.05, sp = 900;
        for (const side of [-2.4, 2.4]) {
          this.bullets.push({ x: c.x + fx * 11 - fy * side, y: c.y + fy * 11 + fx * side, z: c.z + 4, vx: Math.cos(a) * sp + c.vx, vy: Math.sin(a) * sp + c.vy, t: 0.32, by: c, dmg: 1.5 * (1 + 0.25 * c.frontLvl) });
        }
        this.events('gun', c);
      } else {
        c.ammoF--; c.coolF = 0.55;
        this.missiles.push({ x: c.x + fx * 12, y: c.y + fy * 12, z: c.z + 5, ang: c.ang, sp: c.speed + 120, t: 2.6, by: c, dmg: 24 * (1 + 0.2 * c.frontLvl), target: this.findTarget(c) });
        this.events('missile', c);
      }
    }
    if (inp.rear && c.ammoR > 0 && c.coolR <= 0) {
      c.ammoR--; c.coolR = 0.6;
      const bx = c.x - fx * 13, by = c.y - fy * 13;
      if (c.rearW === 'minor') this.mines.push({ x: bx, y: by, z: c.z, arm: 0.7, by: c, t: 40, dmg: 22 * (1 + 0.2 * c.rearLvl) });
      else if (c.rearW === 'olja') this.oils.push({ x: bx - fx * 8, y: by - fy * 8, z: c.z, t: 14, r: 15 + c.rearLvl * 2, spr: oilSprite((Math.random() * 99) | 0), by: c });
      else { c.smokeT = 2.6 + c.rearLvl * 0.6; }
      this.events('rear', c);
    }
  }
  findTarget(c) {
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    let best = null, bd = 520;
    for (const o of this.cars) {
      if (o === c || o.wreckT > 0 || o.sinkT > 0) continue;
      const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
      if (d < bd && (dx * fx + dy * fy) / (d || 1) > 0.6) { bd = d; best = o; }
    }
    return best;
  }
  carEffects(c, dt) {
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    // rökridå
    if (c.smokeT > 0 && Math.random() < 0.9) {
      this.fx.smoke(c.x - fx * 12, c.y - fy * 12, c.z + 3, 2, false, 8);
      this.smokes.push({ x: c.x - fx * 14, y: c.y - fy * 14, t: 2.4, by: c });
    }
    // skaderök
    if (c.wreckT > 0) { if (Math.random() < 0.5) this.fx.smoke(c.x, c.y, c.z + 6, 1, true, 6); if (Math.random() < 0.3) this.fx.add('fire', c.x + (Math.random() - 0.5) * 8, c.y + (Math.random() - 0.5) * 8, c.z + 6, 0, 0, 20, 0.4, 2, -10, 1); }
    else if (c.dmg > 55 && Math.random() < (c.dmg - 50) / 140) this.fx.smoke(c.x + fx * 7, c.y + fy * 7, c.z + 7, 1, c.dmg > 78);
    // nitrolåga
    if (c.nitroT > 0) for (const side of [-2, 2]) this.fx.add('flame', c.x - fx * 11 - fy * side, c.y - fy * 11 + fx * side, c.z + 2.5, -fx * 60 + c.vx * 0.6, -fy * 60 + c.vy * 0.6, 0, 0.16, 2, 0, 3);
    // sladdspår, damm
    const W = this.world;
    if (!c.air && c.wreckT <= 0 && c.sinkT <= 0) {
      const onRoad = c.surf === 'road' || c.surf === 'shoulder';
      const sliding = c.slip > 42 || (c.inp.brake > 0 && c.vf > 120) || c.oilT > 0;
      if (sliding && onRoad) for (const side of [-4, 4]) for (const o of [-7, 6]) W.mark(c.x + fx * o - fy * side, c.y + fy * o + fx * side, c.z, '#2a2630', 0.32);
      if (!onRoad && c.speed > 40 && Math.random() < 0.7) {
        const col = c.surf === 'snow' ? 0xf4f6ff : c.surf === 'sand' ? 0xe8c48a : c.surf === 'ice' ? 0xdff0ff : 0x9a7a4a;
        this.fx.dust(c.x - fx * 9, c.y - fy * 9, c.z, col, 1);
        if (c.surf !== 'ice' && c.surf !== 'rock') for (const side of [-4, 4]) W.mark(c.x - fx * 7 - fy * side, c.y - fy * 7 + fx * side, c.z, c.surf === 'snow' ? '#b8c4dc' : '#5a4a32', 0.18);
      }
      if (sliding && onRoad && Math.random() < 0.4) this.fx.smoke(c.x - fx * 8, c.y - fy * 8, c.z + 1, 1, false, 6);
    }
    if (c.scrape > 0) c.scrape = Math.max(0, c.scrape - dt * 3);
    if (c.landed > 0) c.landed = Math.max(0, c.landed - dt * 2);
  }

  projectiles(dt) {
    const W = this.world;
    // kulor
    this.bullets = this.bullets.filter((b) => {
      b.t -= dt; if (b.t <= 0) return false;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const g = W.groundAt(b.x, b.y, 0);
      if (g > b.z + 1) { this.fx.sparks(b.x, b.y, b.z, 2, 60); return false; }
      for (const o of this.cars) {
        if (o === b.by || o.wreckT > 0 || o.sinkT > 0) continue;
        if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 < 64 && Math.abs(o.z + 4 - b.z) < 8) {
          this.damage(o, b.dmg, b.by, 'gun'); this.fx.sparks(b.x, b.y, b.z, 3, 90); this.events('hit', o);
          return false;
        }
      }
      return true;
    });
    // raketer
    this.missiles = this.missiles.filter((m) => {
      m.t -= dt;
      m.sp = Math.min(640, m.sp + 700 * dt);
      if (m.target && m.target.wreckT <= 0) {
        const want = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        let d = want - m.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        m.ang += Math.max(-3.2 * dt, Math.min(3.2 * dt, d));
      }
      m.x += Math.cos(m.ang) * m.sp * dt; m.y += Math.sin(m.ang) * m.sp * dt;
      const g = W.groundAt(m.x, m.y, 0);
      m.z += (Math.max(g + 4, m.z) - m.z) * Math.min(1, dt * 8);
      if (Math.random() < 0.8) this.fx.smoke(m.x - Math.cos(m.ang) * 4, m.y - Math.sin(m.ang) * 4, m.z, 1, false, 1);
      let boom = m.t <= 0 || g > m.z + 2;
      for (const o of this.cars) {
        if (o === m.by || o.wreckT > 0 || o.sinkT > 0) continue;
        if ((o.x - m.x) ** 2 + (o.y - m.y) ** 2 < 110 && Math.abs(o.z + 4 - m.z) < 10) boom = true;
      }
      if (boom) this.blast(m.x, m.y, m.z, m.dmg, m.by, 34);
      return !boom;
    });
    // minor
    this.mines = this.mines.filter((m) => {
      m.t -= dt; if (m.arm > 0) m.arm -= dt;
      if (m.t <= 0) return false;
      if (m.arm > 0) return true;
      for (const o of this.cars) {
        if (o.wreckT > 0 || o.sinkT > 0 || o.air) continue;
        if ((o.x - m.x) ** 2 + (o.y - m.y) ** 2 < 120) {
          this.blast(m.x, m.y, m.z, m.dmg, m.by, 30);
          o.air = true; o.vz = 190; o.angVel += (Math.random() - 0.5) * 9;
          return false;
        }
      }
      return true;
    });
    // olja
    this.oils = this.oils.filter((o) => {
      o.t -= dt;
      for (const c of this.cars) {
        if (c.air || c.oilT > 0.3) continue;
        const dx = c.x - o.x, dy = (c.y - o.y);
        if (dx * dx + dy * dy < o.r * o.r) {
          c.oilT = 1.3; c.angVel += (Math.random() < 0.5 ? -1 : 1) * (3 + c.speed / 60);
          if (o.by !== c) { c.lastHitBy = o.by; c.lastHitT = this.time; }
          this.events('oil', c);
        }
      }
      return o.t > 0;
    });
    // rök
    this.smokes = this.smokes.filter((s) => {
      s.t -= dt;
      for (const c of this.cars) if (c !== s.by && (c.x - s.x) ** 2 + (c.y - s.y) ** 2 < 400) c.blindT = 0.6;
      return s.t > 0;
    });
  }
  blast(x, y, z, dmg, by, r) {
    this.fx.explosion(x, y, z, 0x8a8890, 0.55);
    for (let k = 0; k < 10; k++) this.world.mark(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, z, '#201a1c', 0.4, 2);
    this.events('boom', { x, y });
    for (const o of this.cars) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < r && o.sinkT <= 0) {
        this.damage(o, dmg * (1 - d / r * 0.6), by, 'blast');
        this.push(o, o.x - x, o.y - y, (r - d) * 7);
        o.angVel += (Math.random() - 0.5) * 6;
        if (!o.air && d < r * 0.6) { o.air = true; o.vz = 110; }
      }
    }
  }

  pickups(dt) {
    for (const p of this.picks) {
      if (p.respawn > 0) { p.respawn -= dt; continue; }
      for (const c of this.cars) {
        if (c.wreckT > 0 || c.sinkT > 0) continue;
        if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 > 150 || Math.abs(c.z - p.z) > 12) continue;
        p.respawn = 9;
        if (p.kind === 'pengar') c.money += 50 + ((Math.random() * 4) | 0) * 25;
        else if (p.kind === 'reparera') c.dmg = Math.max(0, c.dmg - 35);
        else if (p.kind === 'ammo') { c.ammoF = Math.min(c.maxF, c.ammoF + Math.ceil(c.maxF * 0.5)); c.ammoR = Math.min(c.maxR, c.ammoR + Math.ceil(c.maxR * 0.5)); }
        else if (p.kind === 'nitro') c.nitro = Math.min(c.st.nitro + 2, c.nitro + 1);
        this.events('pick', c, p.kind);
        this.fx.sparks(p.x, p.y, p.z + 6, 8, 80);
        break;
      }
    }
  }

  laps_(dt) {
    const T = this.T;
    for (const c of this.cars) {
      if (c.finished) continue;
      const lap = Math.floor(c.progress / T.L);
      if (lap > c.lap && lap >= 1) {
        const lt = this.raceTime - c.lapStart;
        c.lapTimes.push(lt); c.lapStart = this.raceTime;
        if (!c.bestLap || lt < c.bestLap) c.bestLap = lt;
        c.lap = lap;
        if (lap >= this.laps && this.mode !== 'attract') {
          c.finished = true; c.finishTime = this.raceTime; this.finishOrder.push(c);
          this.events('finish', c, this.finishOrder.length);
          if (c.isPlayer) { this.phase = 'finish'; this.endT = 0; }
        } else this.events('lap', c, lap);
      }
      c.lap = Math.max(c.lap, lap);
    }
    // placeringar
    const order = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
    order.forEach((c, k) => { c.place = k + 1; });
    this.order = order;
    if (this.phase === 'finish') {
      this.endT += dt;
      const allDone = this.cars.every((c) => c.finished);
      if (allDone || this.endT > 14) {
        // uppskatta resten utifrån nuvarande försprång
        for (const c of order) if (!c.finished) {
          c.finished = true;
          const left = this.laps * T.L - c.progress;
          c.finishTime = this.raceTime + left / Math.max(120, c.st.vmax * 0.75);
          this.finishOrder.push(c);
        }
        this.finishOrder.sort((a, b) => a.finishTime - b.finishTime);
        this.finishOrder.forEach((c, k) => { c.place = k + 1; });
        this.phase = 'done';
        this.events('done');
      }
    }
  }
}
export { css };
