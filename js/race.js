// Ett lopp: startuppställning, nedräkning, fast tidssteg, krockar och tacklingar, rekvisita,
// vapen och projektiler, djur, upplockningar, varv, placeringar, vrak och återinsättning.
import { Car } from './car.js?v=1';
import { prepareAI, makeAI, aiDrive } from './ai.js?v=1';
import { FX } from './fx.js?v=1';
import { idxAt } from './trackgeo.js?v=1';
import { CONE_DOWN, oilSprite, glueSprite } from './props.js?v=1';
import { Animals } from './animals.js?v=1';
import { css } from './pix.js?v=1';
import { gpSetup, gpCountdown, gpAero, gpCar, gpFinish } from './gp.js?v=1';

const STEP = 1 / 120;
const PICK_KINDS = ['pengar', 'pengar', 'reparera', 'ammo', 'nitro', 'pengar'];
const TACKLE = 1.9; // hur mycket extra knuff en tackling ger (1 = ren fysik)
const TREES_FELL = new Set(['lov', 'gran', 'bjork', 'snogran', 'buske', 'kaktus', 'torr', 'palm', 'hostlov', 'lampa']);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export class Race {
  constructor(world, opt) {
    this.world = world; this.T = world.T; this.q = {};
    this.laps = opt.laps || 3;
    this.mode = opt.mode || 'race'; // race | attract | time
    this.night = !!opt.night;
    this.fx = new FX();
    this.events = opt.events || (() => {});
    this.cars = [];
    this.time = 0; this.raceTime = 0; this.phase = 'countdown'; this.countdown = opt.countdown ?? 3.6;
    this.acc = 0; this.finishOrder = []; this.endT = 0;
    this.bullets = []; this.missiles = []; this.mines = []; this.oils = []; this.smokes = [];
    this.shells = []; this.spikes = []; this.barrels = []; this.glues = []; this.beams = []; this.bolts = [];
    this.tmp = [];
    prepareAI(this.T);
    const T = this.T;
    // startrutor bakom linjen (två led)
    const grid = [];
    const GS = opt.f1 ? 28 : 30;
    for (let k = 0; k < Math.max(10, opt.cars.length); k++) {
      const s = T.L - 26 - k * GS;
      grid.push({ i: idxAt(T, s), lat: (k & 1 ? -1 : 1) * T.HW[0] * 0.44 });
    }
    opt.cars.forEach((c, k) => {
      const car = new Car(c);
      const g = grid[k];
      car.placeAt(T, g.i, g.lat);
      car.s = g.i * T.sp; car.progress = car.s - T.L;
      car.gridIndex = k;
      const human = car.isPlayer || car.human;
      if (!human || this.mode === 'attract' || (car.isPlayer && opt.autopilot)) car.ai = makeAI(c.skill ?? 0.5);
      this.cars.push(car);
    });
    this.player = this.cars.find((c) => c.isPlayer) || null;
    this.order = [...this.cars].sort((a, b) => b.progress - a.progress);
    this.order.forEach((c, k) => { c.place = k + 1; });
    // upplockningar längs banan
    this.picks = [];
    if (this.mode !== 'time' && !opt.f1) {
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
    this.animals = new Animals(this, opt.animals !== false && this.mode !== 'time' && !opt.f1);
    if (opt.f1) gpSetup(this, opt);
  }

  get leader() { return this.order ? this.order[0] : this.cars[0]; }

  update(dt) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) { this.acc -= STEP; this.tick(STEP); }
    this.fx.update(dt);
  }

  tick(dt) {
    this.time += dt;
    if (this.phase === 'countdown' && this.hold) { /* väntar på gästerna */ }
    else if (this.phase === 'countdown' && this.f1) gpCountdown(this, dt);
    else if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after >= 0 && after <= 3) this.events(after === 0 ? 'go' : 'count', after);
      if (this.countdown <= 0) { this.phase = 'race'; for (const c of this.cars) c.lapStart = 0; }
    } else this.raceTime += dt;
    const racing = this.phase === 'race' || this.phase === 'finish';
    const ref = this.player && !this.player.finished && !this.f1 ? this.player : null;
    if (this.f1 && racing) gpAero(this);
    for (const c of this.cars) {
      if (c.ai) aiDrive(c, this, dt);
      if (this.f1) gpCar(this, c, dt);
      if (!racing) { c.inp.fire = c.inp.rear = c.inp.nitro = false; }
      if (c.ai && ref && this.mode === 'race') {
        const gap = c.progress - ref.progress;
        const sk = c.ai.skill;
        c.rubber = gap < -120 ? 1 + Math.min(0.12, (-gap - 120) / 2500) : gap > 200 ? 1 - Math.min(0.1 - sk * 0.05, (gap - 200) / 3000) : 1;
      } else c.rubber = 1;
      if (!racing) { c.vx = c.vy = 0; continue; }
      if (c.finished && (c.isPlayer || c.human) && this.mode !== 'attract') { c.inp.gas = 0.4; c.inp.brake = 0; c.inp.fire = c.inp.rear = false; }
      c.step(dt, this);
      this.rescue(c, dt);
      this.weapons(c, dt);
      this.carEffects(c, dt);
    }
    this.animals.update(dt, racing);
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
    if (c.wreckT > 0 || c.sinkT > 0 || this.raceTime < 3 || c.pitPhase) { c.progT = 0; c.progMark = c.progress; return; }
    c.progT = (c.progT || 0) + dt;
    if (c.progMark === undefined) c.progMark = c.progress;
    const off = c.dist > c.hw + 8;
    const hum = (c.isPlayer || c.human) && !c.ai;
    const limit = off ? (hum ? 3.5 : 2.5) : (hum ? 1e9 : 5);
    if (c.progT > limit) {
      if (c.progress - c.progMark < 50) { this.respawn(c); if (c.isPlayer) this.events('rescue', c); }
      c.progT = 0; c.progMark = c.progress;
    }
  }

  // ---------- skada, vrak, återinsättning ----------
  damage(car, amt, by, why, info) {
    if (car.inv > 0 || car.wreckT > 0 || amt <= 0) return;
    if (this.f1) { this.f1Damage(car, amt, why, info || {}); return; }
    car.dmg += amt * car.st.armor * (why === 'ram' ? car.st.ramArmor : 1);
    car.hitFlash = 0.15;
    if (by && by !== car) { car.lastHitBy = by; car.lastHitT = this.time; }
    if (car.dmg >= 100) this.wreck(car, why);
  }
  // Grand Prix: framvingen skadas eller lossnar, däcken kan punkteras. Lagas i depån.
  f1Damage(car, amt, why, info) {
    car.hitFlash = 0.12;
    if (car.pitPhase === 'stop' || car.f1 !== true) return;
    const front = info.front ?? (why !== 'ram');
    if (front) {
      car.wing = Math.min(100, car.wing + amt * 2.2);
      if (!car.wingLost && (car.wing >= 100 || amt > 13)) {
        car.wingLost = true; car.wing = 100;
        const fx = Math.cos(car.ang), fy = Math.sin(car.ang), x = car.x + fx * 12, y = car.y + fy * 12;
        for (let i = 0; i < 9; i++) { const a = Math.random() * 6.283, s = 40 + Math.random() * 90; this.fx.add('debris', x, y, car.z + 2, car.vx * 0.5 + Math.cos(a) * s, car.vy * 0.5 + Math.sin(a) * s, 50 + Math.random() * 70, 0.8 + Math.random() * 0.6, 2, 420, 0.5, i % 3 ? car.pal.paint : car.pal.stripe); }
        this.fx.sparks(x, y, car.z + 2, 10, 120);
        this.events('wingoff', car);
      }
    }
    // punka: hjul mot hjul från sidan, eller en riktigt hård smäll
    if (!car.punct && (info.side || amt > 11) && Math.random() < Math.min(0.45, (amt - 4) * 0.045)) {
      car.punct = Math.random() < 0.5 ? -1 : 1;
      this.fx.sparks(car.x, car.y, car.z + 2, 8, 90);
      this.events('puncture', car, 'hit');
    }
  }
  wreck(car) {
    car.dmg = 100; car.wreckT = 2.4; car.air = true; car.vz = 150;
    car.angVel += (Math.random() - 0.5) * 8;
    car.burnT = 0; car.empT = 0;
    this.fx.explosion(car.x, car.y, car.z, car.color, 1);
    for (let k = 0; k < 20; k++) this.world.mark(car.x + (Math.random() - 0.5) * 18, car.y + (Math.random() - 0.5) * 18, car.z, '#1a1418', 0.5, 2);
    const killer = car.lastHitBy && this.time - car.lastHitT < 4 ? car.lastHitBy : null;
    if (killer) { killer.kills++; killer.money += 150; }
    this.events('wreck', car, killer);
    for (const o of this.cars) {
      if (o === car) continue;
      const d = Math.hypot(o.x - car.x, o.y - car.y);
      if (d < 40) { this.damage(o, (40 - d) * 0.4, car, 'blast'); this.push(o, o.x - car.x, o.y - car.y, (40 - d) * 5); }
    }
    this.animals.blast(car.x, car.y, 40);
  }
  splash(car) {
    if (car.sinkT > 0 || car.wreckT > 0) return;
    if (this.world.th.lava) {
      // lava: bilen brinner upp
      car.lastGood = car.lastGood || car.si;
      this.fx.add('fire', car.x, car.y, 2, 0, 0, 60, 0.6, 3, -10, 1);
      this.wreck(car); car.vz = 220;
      this.events('lava', car);
      return;
    }
    car.sinkT = 1.3; car.vx *= 0.2; car.vy *= 0.2; car.air = false;
    this.fx.splash(car.x, car.y, 0, 40);
    this.events('splash', car);
  }
  respawn(car) {
    const T = this.T;
    let i = car.lastGood;
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
    car.inv = 2; car.wreckT = 0; car.sinkT = 0; car.oilT = 0; car.burnT = 0; car.empT = 0; car.glueT = 0; car.tackleT = 0;
    if (car.dmg >= 100) car.dmg = 35;
    if (car.pitPhase) { car.pitPhase = null; car.vcap = 0; }
    this.events('respawn', car);
  }
  push(car, dx, dy, imp) {
    const l = Math.hypot(dx, dy) || 1;
    car.vx += dx / l * imp / car.st.mass; car.vy += dy / l * imp / car.st.mass;
    car.tackleT = Math.max(car.tackleT, Math.min(0.7, imp / car.st.mass / 400));
  }
  sparks(x, y, z, n) { this.fx.sparks(x, y, z, n); }
  bumpFx(car, x, y, v) { this.fx.sparks(x, y, car.z + 3, 3 + (v / 40) | 0); this.events('bump', car, v); }

  // ---------- krockar och tacklingar ----------
  collideCars() {
    const cs = this.cars;
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
      const A = cs[a], B = cs[b];
      if (A.sinkT > 0 || B.sinkT > 0) continue;
      if (A.pitPhase && B.pitPhase) continue; // depåfilen: inga krockar mellan bilar som är inne
      if (Math.abs(A.z - B.z) > 9) continue;
      const dx0 = B.x - A.x, dy0 = B.y - A.y, reach = (A.len + B.len) / 2 + 4;
      if (dx0 * dx0 + dy0 * dy0 > reach * reach) continue;
      const ca = [Math.cos(A.ang), Math.sin(A.ang)], cb = [Math.cos(B.ang), Math.sin(B.ang)];
      let hitMax = 0, hx = 0, hy = 0;
      for (const oa of A.co) for (const ob of B.co) {
        const ax = A.x + ca[0] * oa, ay = A.y + ca[1] * oa, bx = B.x + cb[0] * ob, by = B.y + cb[1] * ob;
        const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy, R = A.cr + B.cr;
        if (d2 >= R * R || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = R - d;
        const ma = A.mass * (A.wreckT > 0 ? 2 : 1), mb = B.mass * (B.wreckT > 0 ? 2 : 1), im = 1 / ma + 1 / mb;
        A.x -= nx * pen * (1 / ma) / im; A.y -= ny * pen * (1 / ma) / im;
        B.x += nx * pen * (1 / mb) / im; B.y += ny * pen * (1 / mb) / im;
        const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rv >= 0) continue;
        const j = -(1 + 0.45) * rv / im;
        // tackling: extra knuff, den lätta åker längst, rambock förstärker
        const big = -rv > 40 && !this.f1;
        const kA = big ? 1 + (TACKLE - 1) * B.st.ram : 1, kB = big ? 1 + (TACKLE - 1) * A.st.ram : 1;
        const dvA = j / ma * kA, dvB = j / mb * kB;
        A.vx -= nx * dvA; A.vy -= ny * dvA; B.vx += nx * dvB; B.vy += ny * dvB;
        A.angVel += (ca[0] * ny - ca[1] * nx) * oa * j * 0.0016 / ma;
        B.angVel -= (cb[0] * ny - cb[1] * nx) * ob * j * 0.0016 / mb;
        if (big) {
          A.tackleT = Math.max(A.tackleT, Math.min(0.85, dvA / 260));
          B.tackleT = Math.max(B.tackleT, Math.min(0.85, dvB / 260));
          // lätta bilar lyfter av riktigt hårda smällar
          if (dvB > 230 && mb < 1.3 && !B.air) { B.air = true; B.vz = Math.min(170, dvB * 0.4); B.angVel += (Math.random() - 0.5) * 6; }
          if (dvA > 230 && ma < 1.3 && !A.air) { A.air = true; A.vz = Math.min(170, dvA * 0.4); A.angVel += (Math.random() - 0.5) * 6; }
        }
        const hit = -rv;
        if (hit > 55) {
          const dmg = (hit - 55) * 0.075;
          // var på bilen träffen satt: nosen (framvingen) eller sidan (hjul mot hjul → punka)
          const fa = ca[0] * nx + ca[1] * ny, fb = -(cb[0] * nx + cb[1] * ny);
          this.damage(A, dmg * mb / (ma + mb) * 1.8 * B.st.ram, B, 'ram', { front: fa > 0.55, side: Math.abs(fa) < 0.55 });
          this.damage(B, dmg * ma / (ma + mb) * 1.8 * A.st.ram, A, 'ram', { front: fb > 0.55, side: Math.abs(fb) < 0.55 });
          this.fx.sparks((ax + bx) / 2, (ay + by) / 2, A.z + 4, 4 + (hit / 22) | 0);
        }
        if (hit > hitMax) { hitMax = hit; hx = (ax + bx) / 2; hy = (ay + by) / 2; }
      }
      if (hitMax > 55) this.events('crash', A, hitMax, B, hx, hy);
    }
  }
  collideProps(dt) {
    const W = this.world, near = this.tmp;
    for (const c of this.cars) {
      if (c.sinkT > 0) continue;
      W.propsNear(c.x, c.y, 24 + c.len / 2, near);
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
      for (const p of near) {
        if (!p.r || p.down) continue;
        if (c.z > p.z + 14) continue;
        for (const o of c.co) {
          const cx = c.x + fx * o, cy = c.y + fy * o;
          const dx = cx - p.x, dy = cy - p.y, R = c.cr + p.r, d2 = dx * dx + dy * dy;
          if (d2 >= R * R) continue;
          const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d;
          if (p.dyn) { // kon: flyger iväg
            p.down = true; p.vx = c.vx * 1.1 + nx * -40 + (Math.random() - 0.5) * 60; p.vy = c.vy * 1.1 + ny * -40 + (Math.random() - 0.5) * 60; p.vz = 60 + Math.random() * 60; p.zz = 0; p.spr = CONE_DOWN; p.r = 0;
            this.events('cone', c, null, null, this.world.props.indexOf(p), [Math.round(p.vx), Math.round(p.vy), Math.round(p.vz)]);
            break;
          }
          // tunga fordon knäcker träd och buskar
          if (c.mass >= 2.3 && c.speed > 110 && TREES_FELL.has(p.kind)) {
            this.world.fell(p);
            for (let k = 0; k < 18; k++) this.fx.add('leaf', p.x, p.y, p.z + 10 + Math.random() * 14, (Math.random() - 0.5) * 120 + c.vx * 0.3, (Math.random() - 0.5) * 120 + c.vy * 0.3, Math.random() * 60, 0.8 + Math.random() * 0.6, 2, 160, 2);
            c.vx *= 0.85; c.vy *= 0.85;
            this.events('fell', c, null, null, this.world.props.indexOf(p));
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
    for (const p of W.props) {
      if (!p.down || p.vz === undefined || p.vz === null) continue;
      if (p.vx || p.vy || p.zz > 0 || p.vz > 0) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= 500 * dt; p.zz = Math.max(0, (p.zz || 0) + p.vz * dt);
        if (p.zz === 0) { p.vx *= 0.9; p.vy *= 0.9; p.vz = Math.abs(p.vz) > 40 ? -p.vz * 0.3 : 0; }
        if (Math.abs(p.vx) + Math.abs(p.vy) < 3 && p.zz === 0) { p.vx = p.vy = 0; }
        p.depth = p.x + p.y;
      }
    }
  }

  // ---------- vapen ----------
  nose(c, f = 0.5) { const fx = Math.cos(c.ang), fy = Math.sin(c.ang); return [c.x + fx * (c.len * f + 1), c.y + fy * (c.len * f + 1)]; }
  weapons(c, dt) {
    if (c.wreckT > 0 || c.sinkT > 0) return;
    const inp = c.inp, fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    if (inp.nitro && c.nitro > 0 && c.nitroT <= 0) { c.nitro--; c.nitroT = 1.8; this.events('nitro', c); }
    const lvlF = 1 + 0.22 * c.frontLvl, lvlR = 1 + 0.2 * c.rearLvl;
    if (inp.fire && c.ammoF > 0 && c.coolF <= 0) {
      const [nx, ny] = this.nose(c);
      switch (c.frontW) {
        case 'kulspruta': {
          c.ammoF--; c.coolF = 0.085;
          const a = c.ang + (Math.random() - 0.5) * 0.05, sp = 900;
          for (const side of [-2.4, 2.4]) this.bullets.push({ x: nx - fy * side, y: ny + fx * side, z: c.z + 4, vx: Math.cos(a) * sp + c.vx, vy: Math.sin(a) * sp + c.vy, t: 0.32, by: c, dmg: 1.5 * lvlF });
          this.events('gun', c);
          break;
        }
        case 'raketer':
          c.ammoF--; c.coolF = 0.55;
          this.missiles.push({ x: nx, y: ny, z: c.z + 5, ang: c.ang, sp: c.speed + 120, t: 2.6, by: c, dmg: 24 * lvlF, target: this.findTarget(c, 1) });
          this.events('missile', c);
          break;
        case 'kanon':
          c.ammoF--; c.coolF = 1.0;
          this.shells.push({ x: nx, y: ny, z: c.z + 6, vx: fx * 780 + c.vx, vy: fy * 780 + c.vy, t: 0.9, by: c, dmg: 30 * lvlF });
          this.fx.smoke(nx, ny, c.z + 6, 6, false, 6); this.fx.sparks(nx, ny, c.z + 6, 8, 120);
          this.push(c, -fx, -fy, 60 * c.mass);
          this.events('cannon', c);
          break;
        case 'laser': this.fireBeam(c, dt, lvlF); break;
        case 'eld': this.fireFlame(c, dt, lvlF); break;
        case 'blixt': {
          c.ammoF--; c.coolF = 1.2;
          const tg = this.findTarget(c, 0.5, 340);
          if (tg) {
            this.bolts.push({ x0: nx, y0: ny, z0: c.z + 6, x1: tg.x, y1: tg.y, z1: tg.z + 5, t: 0.3, seed: Math.random() * 99 });
            this.damage(tg, 12 * lvlF, c, 'zap'); tg.empT = 2.2 + 0.4 * c.frontLvl; tg.hitFlash = 0.3;
            this.fx.sparks(tg.x, tg.y, tg.z + 5, 16, 140);
            this.events('zap', c, tg);
          } else {
            this.bolts.push({ x0: nx, y0: ny, z0: c.z + 6, x1: nx + fx * 120, y1: ny + fy * 120, z1: c.z, t: 0.3, seed: Math.random() * 99 });
            this.events('zap', c, null);
          }
          break;
        }
      }
    }
    if (inp.rear && c.ammoR > 0 && c.coolR <= 0) {
      c.ammoR--; c.coolR = 0.6;
      const bx = c.x - fx * (c.len / 2 + 3), by = c.y - fy * (c.len / 2 + 3);
      switch (c.rearW) {
        case 'minor': this.mines.push({ x: bx, y: by, z: c.z, arm: 0.7, by: c, t: 40, dmg: 22 * lvlR }); break;
        case 'olja': { const sd = (Math.random() * 99) | 0; this.oils.push({ x: bx - fx * 8, y: by - fy * 8, z: c.z, t: 14, r: 15 + c.rearLvl * 2, seed: sd, spr: oilSprite(sd), by: c }); break; }
        case 'rok': c.smokeT = 2.6 + c.rearLvl * 0.6; break;
        case 'spikar': this.spikes.push({ x: bx - fx * 4, y: by - fy * 4, z: c.z, ang: c.ang + Math.PI / 2, len: 24 + c.rearLvl * 3, t: 18, by: c }); break;
        case 'fat': this.barrels.push({ x: bx, y: by, z: c.z, vx: c.vx * 0.3 - fx * 30, vy: c.vy * 0.3 - fy * 30, t: 30, by: c, dmg: 24 * lvlR, arm: 0.5 }); break;
        case 'lim': { const sd = (Math.random() * 99) | 0; this.glues.push({ x: bx - fx * 8, y: by - fy * 8, z: c.z, t: 14, r: 16 + c.rearLvl * 2, seed: sd, spr: glueSprite(sd), by: c }); break; }
        case 'bakraket':
          this.missiles.push({ x: bx, y: by, z: c.z + 5, ang: c.ang + Math.PI, sp: 140, t: 2.6, by: c, dmg: 24 * lvlR, target: this.findTarget(c, -1) });
          this.events('missile', c);
          break;
      }
      if (c.rearW !== 'bakraket') this.events('rear', c);
    }
  }
  fireBeam(c, dt, lvl) {
    c.ammoF = Math.max(0, c.ammoF - 40 * dt); c.firing = 0.05;
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    const [x0, y0] = this.nose(c);
    const z = c.z + 4.5, range = 260 + 30 * c.frontLvl;
    let hit = null, L = range;
    for (let s = 0; s < range; s += 4) {
      const x = x0 + fx * s, y = y0 + fy * s;
      if (this.world.groundAt(x, y, c.si) > z + 1) { L = s; break; }
      for (const o of this.cars) {
        if (o === c || o.wreckT > 0 || o.sinkT > 0) continue;
        if ((o.x - x) ** 2 + (o.y - y) ** 2 < (o.cr + 1.5) ** 2 && Math.abs(o.z + 4 - z) < 9) { hit = o; L = s; break; }
      }
      if (hit) break;
      if (this.animals.hitAt(x, y, z, c, 24 * lvl * dt)) { L = s; break; }
    }
    this.beams.push({ x0, y0, x1: x0 + fx * L, y1: y0 + fy * L, z, t: 0.04, hit: !!hit });
    if (hit) { this.damage(hit, 24 * lvl * dt, c, 'laser'); if (Math.random() < 0.5) this.fx.sparks(hit.x, hit.y, z, 2, 70); if (Math.random() < 0.2) this.fx.smoke(hit.x, hit.y, z + 2, 1, true, 3); }
    this.events('laser', c);
  }
  fireFlame(c, dt, lvl) {
    c.ammoF = Math.max(0, c.ammoF - 35 * dt); c.firing = 0.05;
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    const [x0, y0] = this.nose(c);
    for (let k = 0; k < 3; k++) {
      const a = c.ang + (Math.random() - 0.5) * 0.5, sp = 200 + Math.random() * 120;
      this.fx.add('fire', x0, y0, c.z + 4, Math.cos(a) * sp + c.vx, Math.sin(a) * sp + c.vy, (Math.random() - 0.3) * 20, 0.28 + Math.random() * 0.12, Math.random() < 0.5 ? 3 : 2, -20, 2.5);
    }
    const R = 78 + 8 * c.frontLvl;
    for (const o of this.cars) {
      if (o === c || o.wreckT > 0 || o.sinkT > 0) continue;
      const dx = o.x - x0, dy = o.y - y0, d = Math.hypot(dx, dy);
      if (d > R || (dx * fx + dy * fy) / (d || 1) < 0.85) continue;
      this.damage(o, 14 * lvl * dt, c, 'fire');
      o.burnT = Math.max(o.burnT, 2.0); o.burnBy = c;
    }
    this.animals.flame(x0, y0, fx, fy, R, c);
    this.events('flame', c);
  }
  // närmaste bil framåt (dir 1) eller bakåt (dir -1) inom konen
  findTarget(c, dir = 1, range = 520) {
    const fx = Math.cos(c.ang) * Math.sign(dir), fy = Math.sin(c.ang) * Math.sign(dir), cone = Math.abs(dir) === 0.5 ? 0.5 : 0.6;
    let best = null, bd = range;
    for (const o of this.cars) {
      if (o === c || o.wreckT > 0 || o.sinkT > 0) continue;
      const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
      if (d < bd && (dx * fx + dy * fy) / (d || 1) > cone) { bd = d; best = o; }
    }
    return best;
  }
  carEffects(c, dt) {
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    const back = c.len / 2;
    if (c.smokeT > 0 && Math.random() < 0.9) {
      this.fx.smoke(c.x - fx * (back + 2), c.y - fy * (back + 2), c.z + 3, 2, false, 8);
      this.smokes.push({ x: c.x - fx * (back + 4), y: c.y - fy * (back + 4), t: 2.4, by: c });
    }
    if (c.wreckT > 0) { if (Math.random() < 0.5) this.fx.smoke(c.x, c.y, c.z + 6, 1, true, 6); if (Math.random() < 0.3) this.fx.add('fire', c.x + (Math.random() - 0.5) * 8, c.y + (Math.random() - 0.5) * 8, c.z + 6, 0, 0, 20, 0.4, 2, -10, 1); }
    else if (c.dmg > 55 && Math.random() < (c.dmg - 50) / 140) this.fx.smoke(c.x + fx * 7, c.y + fy * 7, c.z + 7, 1, c.dmg > 78);
    // punka: gnistor och gummirök från fälgen
    if (c.punct && c.speed > 40 && !c.air) {
      const ox = c.len / 2 - 5, oy = c.punct * (c.wid / 2 - 1), wx = c.x + fx * ox - fy * oy, wy = c.y + fy * ox + fx * oy;
      if (Math.random() < 0.7) this.fx.sparks(wx, wy, c.z + 1, 1, 70);
      if (Math.random() < 0.25) this.fx.smoke(wx, wy, c.z + 2, 1, true, 2);
    }
    if (c.burnT > 0 && Math.random() < 0.6) this.fx.add('fire', c.x + (Math.random() - 0.5) * c.wid, c.y + (Math.random() - 0.5) * c.wid, c.z + 6, 0, 0, 30, 0.35, 2, -20, 1);
    if (c.empT > 0 && Math.random() < 0.3) this.fx.add('flame', c.x + (Math.random() - 0.5) * c.wid, c.y + (Math.random() - 0.5) * c.wid, c.z + 6, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 40, 0.15, 1, 0, 1);
    if (c.nitroT > 0) for (const side of [-2, 2]) this.fx.add('flame', c.x - fx * (back + 1) - fy * side, c.y - fy * (back + 1) + fx * side, c.z + 2.5, -fx * 60 + c.vx * 0.6, -fy * 60 + c.vy * 0.6, 0, 0.16, 2, 0, 3);
    if (c.st.hover && !c.air && c.speed > 30 && Math.random() < 0.5) {
      const col = this.world.gm === 1 ? 0xd8e8ff : 0xc8c0b0;
      this.fx.dust(c.x - fx * back, c.y - fy * back, c.z, col, 1);
    }
    const W = this.world;
    if (!c.air && c.wreckT <= 0 && c.sinkT <= 0 && !c.st.hover) {
      const onRoad = c.surf === 'road' || c.surf === 'shoulder';
      const sliding = c.slip > 42 || (c.inp.brake > 0 && c.vf > 120) || c.oilT > 0 || c.tackleT > 0.1;
      const ry = c.wid / 2 - 1, rf = c.len / 2 - 3;
      if (sliding && onRoad) for (const side of [-ry, ry]) for (const o of [-rf, rf - 1]) W.mark(c.x + fx * o - fy * side, c.y + fy * o + fx * side, c.z, '#2a2630', 0.32);
      if (!onRoad && c.speed > 40 && Math.random() < 0.7) {
        const col = c.surf === 'snow' ? 0xf4f6ff : c.surf === 'sand' ? (W.th.ground === 'moon' ? 0xb8b8c0 : 0xe8c48a) : c.surf === 'ice' ? 0xdff0ff : 0x9a7a4a;
        this.fx.dust(c.x - fx * (back - 1), c.y - fy * (back - 1), c.z, col, 1);
        if (c.surf !== 'ice' && c.surf !== 'rock') for (const side of [-ry, ry]) W.mark(c.x - fx * rf - fy * side, c.y - fy * rf + fx * side, c.z, c.surf === 'snow' ? '#b8c4dc' : '#5a4a32', 0.18);
      }
      if (c.st.tank && onRoad && c.speed > 20 && Math.random() < 0.3) for (const side of [-ry, ry]) W.mark(c.x - fx * rf - fy * side, c.y - fy * rf + fx * side, c.z, '#3a3640', 0.25);
      if (sliding && onRoad && Math.random() < 0.4) this.fx.smoke(c.x - fx * rf, c.y - fy * rf, c.z + 1, 1, false, 6);
    }
    if (c.scrape > 0) c.scrape = Math.max(0, c.scrape - dt * 3);
    if (c.landed > 0) c.landed = Math.max(0, c.landed - dt * 2);
  }

  projectiles(dt) {
    const W = this.world;
    const hitCar = (x, y, z, by, r = 0) => {
      for (const o of this.cars) {
        if (o === by || o.wreckT > 0 || o.sinkT > 0) continue;
        if ((o.x - x) ** 2 + (o.y - y) ** 2 < (o.cr + 3 + r) ** 2 && Math.abs(o.z + 4 - z) < 10) return o;
      }
      return null;
    };
    this.bullets = this.bullets.filter((b) => {
      b.t -= dt; if (b.t <= 0) return false;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const g = W.groundAt(b.x, b.y, 0);
      if (g > b.z + 1) { this.fx.sparks(b.x, b.y, b.z, 2, 60); return false; }
      const o = hitCar(b.x, b.y, b.z, b.by, -2);
      if (o) { this.damage(o, b.dmg, b.by, 'gun'); this.fx.sparks(b.x, b.y, b.z, 3, 90); this.events('hit', o); return false; }
      if (this.animals.hitAt(b.x, b.y, b.z, b.by, b.dmg * 2)) return false;
      return true;
    });
    this.shells = this.shells.filter((s) => {
      s.t -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const g = W.groundAt(s.x, s.y, 0);
      if (Math.random() < 0.6) this.fx.smoke(s.x, s.y, s.z, 1, false, 1);
      const o = hitCar(s.x, s.y, s.z, s.by);
      if (s.t <= 0 || g > s.z + 1 || o || this.animals.hitAt(s.x, s.y, s.z, s.by, 50)) {
        this.blast(s.x, s.y, s.z, s.dmg, s.by, 34, 2.2);
        return false;
      }
      return true;
    });
    this.missiles = this.missiles.filter((m) => {
      m.t -= dt;
      m.sp = Math.min(640, m.sp + 700 * dt);
      if (m.target && m.target.wreckT <= 0) {
        const want = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        m.ang += Math.max(-3.2 * dt, Math.min(3.2 * dt, wrap(want - m.ang)));
      }
      m.x += Math.cos(m.ang) * m.sp * dt; m.y += Math.sin(m.ang) * m.sp * dt;
      const g = W.groundAt(m.x, m.y, 0);
      m.z += (Math.max(g + 4, m.z) - m.z) * Math.min(1, dt * 8);
      if (Math.random() < 0.8) this.fx.smoke(m.x - Math.cos(m.ang) * 4, m.y - Math.sin(m.ang) * 4, m.z, 1, false, 1);
      const boom = m.t <= 0 || g > m.z + 2 || hitCar(m.x, m.y, m.z, m.by, -1) || this.animals.hitAt(m.x, m.y, m.z, m.by, 30);
      if (boom) this.blast(m.x, m.y, m.z, m.dmg, m.by, 34);
      return !boom;
    });
    this.mines = this.mines.filter((m) => {
      m.t -= dt; if (m.arm > 0) m.arm -= dt;
      if (m.t <= 0) return false;
      if (m.arm > 0) return true;
      for (const o of this.cars) {
        if (o.wreckT > 0 || o.sinkT > 0 || o.air) continue;
        if ((o.x - m.x) ** 2 + (o.y - m.y) ** 2 < (o.cr + 5) ** 2) {
          this.blast(m.x, m.y, m.z, m.dmg, m.by, 30);
          o.air = true; o.vz = 190 / Math.sqrt(o.mass); o.angVel += (Math.random() - 0.5) * 9;
          return false;
        }
      }
      return true;
    });
    this.barrels = this.barrels.filter((b) => {
      b.t -= dt; if (b.arm > 0) b.arm -= dt;
      const k = Math.exp(-3 * dt); b.vx *= k; b.vy *= k;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.z = W.groundAt(b.x, b.y, 0);
      if (b.t <= 0) return false;
      if (b.arm > 0) return true;
      for (const o of this.cars) {
        if (o.wreckT > 0 || o.sinkT > 0) continue;
        if ((o.x - b.x) ** 2 + (o.y - b.y) ** 2 < (o.cr + 4) ** 2) { this.blast(b.x, b.y, b.z, b.dmg, b.by, 34, 1.6); return false; }
      }
      return true;
    });
    this.oils = this.oils.filter((o) => {
      o.t -= dt;
      for (const c of this.cars) {
        if (c.air || c.oilT > 0.3 || c.st.hover) continue;
        const dx = c.x - o.x, dy = (c.y - o.y);
        if (dx * dx + dy * dy < o.r * o.r) {
          c.oilT = c.st.spikeProof ? 0.6 : 1.3; c.angVel += (Math.random() < 0.5 ? -1 : 1) * (3 + c.speed / 60) * (c.st.tank ? 0.3 : 1);
          if (o.by !== c) { c.lastHitBy = o.by; c.lastHitT = this.time; }
          this.events('oil', c);
        }
      }
      return o.t > 0;
    });
    this.glues = this.glues.filter((o) => {
      o.t -= dt;
      for (const c of this.cars) {
        if (c.air || c.st.hover) continue;
        if ((c.x - o.x) ** 2 + (c.y - o.y) ** 2 < o.r * o.r) { if (c.glueT <= 0) this.events('glue', c); c.glueT = 0.3; }
      }
      return o.t > 0;
    });
    this.spikes = this.spikes.filter((s) => {
      s.t -= dt;
      const ux = Math.cos(s.ang), uy = Math.sin(s.ang);
      for (const c of this.cars) {
        if (c.air || c.st.hover || (c.spikeCd && this.time < c.spikeCd)) continue;
        const dx = c.x - s.x, dy = c.y - s.y, along = dx * ux + dy * uy, across = Math.abs(-dx * uy + dy * ux);
        if (Math.abs(along) < s.len / 2 + c.cr && across < 4) {
          c.spikeCd = this.time + 2;
          if (c.st.spikeProof) continue;
          c.punkT = 4.5; this.damage(c, 6, s.by, 'spike'); this.fx.sparks(c.x, c.y, c.z + 2, 6, 80);
          this.events('spike', c);
        }
      }
      return s.t > 0;
    });
    this.smokes = this.smokes.filter((s) => {
      s.t -= dt;
      for (const c of this.cars) if (c !== s.by && (c.x - s.x) ** 2 + (c.y - s.y) ** 2 < 400) c.blindT = 0.6;
      return s.t > 0;
    });
    this.beams = this.beams.filter((b) => (b.t -= dt) > 0);
    this.bolts = this.bolts.filter((b) => (b.t -= dt) > 0);
  }
  blast(x, y, z, dmg, by, r, knock = 1) {
    this.fx.explosion(x, y, z, 0x8a8890, 0.55);
    for (let k = 0; k < 10; k++) this.world.mark(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, z, '#201a1c', 0.4, 2);
    this.events('boom', { x, y });
    for (const o of this.cars) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < r && o.sinkT <= 0) {
        this.damage(o, dmg * (1 - d / r * 0.6), by, 'blast');
        this.push(o, o.x - x, o.y - y, (r - d) * 7 * knock);
        o.angVel += (Math.random() - 0.5) * 6 * knock / o.mass;
        if (!o.air && d < r * 0.6) { o.air = true; o.vz = 110 * knock / Math.sqrt(o.mass); }
      }
    }
    this.animals.blast(x, y, r);
  }

  pickups(dt) {
    for (const p of this.picks) {
      if (p.respawn > 0) { p.respawn -= dt; continue; }
      for (const c of this.cars) {
        if (c.wreckT > 0 || c.sinkT > 0) continue;
        if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 > (c.cr + 7) ** 2 || Math.abs(c.z - p.z) > 12) continue;
        p.respawn = 9;
        if (p.kind === 'pengar') c.money += 50 + ((Math.random() * 4) | 0) * 25;
        else if (p.kind === 'reparera') c.dmg = Math.max(0, c.dmg - 35);
        else if (p.kind === 'ammo') { c.ammoF = Math.min(c.maxF, c.ammoF + Math.ceil(c.maxF * 0.5)); c.ammoR = Math.min(c.maxR, c.ammoR + Math.ceil(c.maxR * 0.5)); }
        else if (p.kind === 'nitro') c.nitro = Math.min(c.st.nitro + 2, c.nitro + 1);
        this.events('pick', c, p.kind, null, this.picks.indexOf(p));
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
          if (this.f1) gpFinish(this, c);
          this.events('finish', c, this.finishOrder.length);
          if ((c.isPlayer || c.human) && this.phase !== 'finish' && this.cars.filter((h) => h.isPlayer || h.human).every((h) => h.finished)) { this.phase = 'finish'; this.endT = 0; }
          if ((c.isPlayer || c.human) && !this.firstHuman) this.firstHuman = this.raceTime;
        } else this.events('lap', c, lap);
      }
      c.lap = Math.max(c.lap, lap);
    }
    const order = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
    order.forEach((c, k) => { c.place = k + 1; });
    this.order = order;
    // flera människor: loppet tar slut senast 45 s efter att den första gått i mål
    if (this.phase === 'race' && this.firstHuman && this.raceTime - this.firstHuman > 45) { this.phase = 'finish'; this.endT = 99; }
    if (this.phase === 'finish') {
      this.endT += dt;
      const allDone = this.cars.every((c) => c.finished);
      if (allDone || this.endT > (this.f1 ? 30 : 14)) {
        for (const c of order) if (!c.finished) {
          c.finished = true;
          const left = this.laps * T.L - c.progress;
          c.finishTime = this.raceTime + left / Math.max(120, c.st.vmax * 0.75);
          if (this.f1) gpFinish(this, c);
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
