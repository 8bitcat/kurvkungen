// Gästens spegel av loppet: tar emot värdens tillståndsbilder, interpolerar bilarna ~0,1 s bakåt
// i tiden och återskapar effekter (rök, eld, damm, sladdspår, explosioner, blod) lokalt.
import { nearest } from './trackgeo.js?v=1';
import { oilSprite, glueSprite, CONE_DOWN } from './props.js?v=1';
import { ANIM_STATES } from './net.js?v=1';
import { SPECIES } from './animals.js?v=1';

const lerpA = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
const oilCache = new Map(), glueCache = new Map();
const oilOf = (s) => { if (!oilCache.has(s)) oilCache.set(s, oilSprite(s)); return oilCache.get(s); };
const glueOf = (s) => { if (!glueCache.has(s)) glueCache.set(s, glueSprite(s)); return glueCache.get(s); };

export class Mirror {
  constructor(R, me) {
    this.R = R; this.me = me; this.buf = []; this.q = {};
    R.mirror = true;
    R.cars.forEach((c, k) => { c.isPlayer = k === me; c.ai = null; });
    R.player = R.cars[me];
    R.animals.on = false;
  }
  push(s) { this.buf.push({ s, at: performance.now() }); if (this.buf.length > 6) this.buf.shift(); }
  update(dt) {
    const R = this.R, B = this.buf;
    R.fx.update(dt);
    if (!B.length) return;
    const now = performance.now() - 110;
    let a = B[0], b = B[B.length - 1], t = 1;
    for (let k = 0; k + 1 < B.length; k++) if (B[k].at <= now && B[k + 1].at >= now) { a = B[k]; b = B[k + 1]; t = (now - a.at) / Math.max(1, b.at - a.at); break; }
    if (now < B[0].at) { a = b = B[0]; t = 1; }
    const sa = a.s, sb = b.s;
    R.phase = sb.ph; R.countdown = sb.cd; R.raceTime = sa.time + (sb.time - sa.time) * t; R.time = sb.rt;
    R.cars.forEach((c, k) => {
      const p = sa.cars[k], n = sb.cars[k];
      if (!p || !n) return;
      c.x = p[0] + (n[0] - p[0]) * t; c.y = p[1] + (n[1] - p[1]) * t; c.z = p[2] + (n[2] - p[2]) * t;
      c.ang = lerpA(p[3], n[3], t); c.vx = n[4]; c.vy = n[5]; c.dmg = n[6];
      const f = n[7];
      c.air = !!(f & 1); c.wreckT = f & 2 ? 1 : 0; c.sinkT = f & 4 ? 1 : 0; c.inv = f & 8 ? 1 : 0; c.nitroT = f & 16 ? 1 : 0;
      c.burnT = f & 32 ? 1 : 0; c.empT = f & 64 ? 1 : 0; c.hitFlash = f & 128 ? 0.1 : 0; c.smokeT = f & 256 ? 1 : 0; c.sliding = !!(f & 512);
      c.wrongT = f & 1024 ? 2 : 0; c.finished = !!(f & 2048);
      if (k !== this.me) c.inp.gas = f & 4096 ? 1 : 0;
      c.lap = n[8]; c.place = n[9]; c.progress = n[10]; c.ammoF = n[11]; c.ammoR = n[12]; c.nitro = n[13]; c.money = n[14]; c.bestLap = n[15] || 0;
      c.surf = n[16] ? 'grass' : 'road'; c.slip = n[17];
      nearest(R.T, c.x, c.y, c.si, 12, this.q); c.si = this.q.i; c.dist = this.q.dist; c.hw = this.q.hw; c.d = this.q.d;
    });
    if (b !== this.applied) { this.applied = b; this.lists(sb); }
    this.effects(dt);
  }
  lists(s) {
    const R = this.R;
    R.bullets = s.bu.map(([x, y, z, vx, vy]) => ({ x, y, z, vx, vy }));
    R.missiles = s.mi.map(([x, y, z, ang]) => ({ x, y, z, ang }));
    R.shells = s.sh.map(([x, y, z]) => ({ x, y, z }));
    R.mines = s.mn.map(([x, y, z, arm]) => ({ x, y, z, arm }));
    R.oils = s.oi.map(([x, y, z, tt, r, seed]) => ({ x, y, z, t: tt, r, spr: oilOf(seed) }));
    R.glues = s.gl.map(([x, y, z, tt, r, seed]) => ({ x, y, z, t: tt, r, spr: glueOf(seed) }));
    R.spikes = s.sp.map(([x, y, z, ang, len]) => ({ x, y, z, ang, len }));
    R.barrels = s.ba.map(([x, y, z]) => ({ x, y, z }));
    R.beams = s.be.map(([x0, y0, x1, y1, z, hit]) => ({ x0, y0, x1, y1, z, hit }));
    R.bolts = s.bo.map(([x0, y0, z0, x1, y1, z1, seed]) => ({ x0, y0, z0, x1, y1, z1, seed }));
    R.animals.list = s.an.map(([type, x, y, z, ang, st, frameT, fl]) => ({ type, S: SPECIES[type], x, y, z, ang, state: ANIM_STATES[st], frameT, burnt: !!(fl & 1), flyAway: !!(fl & 2), idle: fl & 4 ? 1 : 0, si: 0 }));
    R.picks.forEach((p, k) => { p.respawn = s.pk[k] === '1' ? 1 : 0; });
  }
  effects(dt) {
    const R = this.R, W = R.world;
    for (const c of R.cars) {
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang), back = c.len / 2;
      if (c.nitroT > 0) for (const side of [-2, 2]) R.fx.add('flame', c.x - fx * (back + 1) - fy * side, c.y - fy * (back + 1) + fx * side, c.z + 2.5, -fx * 60 + c.vx * 0.6, -fy * 60 + c.vy * 0.6, 0, 0.16, 2, 0, 3);
      if (c.smokeT > 0 && Math.random() < 0.9) R.fx.smoke(c.x - fx * (back + 2), c.y - fy * (back + 2), c.z + 3, 2, false, 8);
      if (c.wreckT > 0) { if (Math.random() < 0.5) R.fx.smoke(c.x, c.y, c.z + 6, 1, true, 6); }
      else if (c.dmg > 55 && Math.random() < (c.dmg - 50) / 140) R.fx.smoke(c.x + fx * 7, c.y + fy * 7, c.z + 7, 1, c.dmg > 78);
      if (c.burnT > 0 && Math.random() < 0.6) R.fx.add('fire', c.x + (Math.random() - 0.5) * c.wid, c.y + (Math.random() - 0.5) * c.wid, c.z + 6, 0, 0, 30, 0.35, 2, -20, 1);
      const sp = Math.hypot(c.vx, c.vy);
      if (!c.air && c.wreckT <= 0) {
        if (c.surf !== 'road' && sp > 40 && Math.random() < 0.6) R.fx.dust(c.x - fx * back, c.y - fy * back, c.z, W.th.ground === 'snow' ? 0xf4f6ff : 0x9a7a4a, 1);
        if (c.sliding && c.surf === 'road') { const ry = c.wid / 2 - 1, rf = c.len / 2 - 3; for (const side of [-ry, ry]) W.mark(c.x - fx * rf - fy * side, c.y - fy * rf + fx * side, c.z, '#2a2630', 0.32); }
      }
    }
    void dt;
  }
  // engångseffekter från värdens händelser
  fxEvent(type, a, b, c, d, e) {
    const R = this.R, W = R.world;
    switch (type) {
      case 'wreck': if (a) { R.fx.explosion(a.x, a.y, a.z, a.color, 1); for (let k = 0; k < 20; k++) W.mark(a.x + (Math.random() - 0.5) * 18, a.y + (Math.random() - 0.5) * 18, a.z, '#1a1418', 0.5, 2); } break;
      case 'boom': if (a) { R.fx.explosion(a.x, a.y, a.z || W.groundAt(a.x, a.y, 0), 0x8a8890, 0.55); for (let k = 0; k < 10; k++) W.mark(a.x + (Math.random() - 0.5) * 12, a.y + (Math.random() - 0.5) * 12, a.z || 0, '#201a1c', 0.4, 2); } break;
      case 'crash': if (d != null) R.fx.sparks(d, e, (a ? a.z : 0) + 4, 4 + (b / 22) | 0); break;
      case 'bump': if (a) R.fx.sparks(a.x, a.y, a.z + 3, 3); break;
      case 'splash': if (a) R.fx.splash(a.x, a.y, 0, 40); break;
      case 'splat': if (a) { R.animals.blood(a.x, a.y, a.z, 9, b ? b.vx : 0, b ? b.vy : 0); for (let k = 0; k < 8; k++) R.fx.add('blood', a.x, a.y, a.z + 1, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 30 + Math.random() * 60, 0.5, 1, 400, 0.5); } break;
      case 'animal': case 'moose': if (a) for (let k = 0; k < 10; k++) R.fx.add('blood', a.x, a.y, a.z + 6, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 40 + Math.random() * 80, 0.6, 1, 400, 0.4); break;
      case 'thud': if (a) R.animals.blood(a.x, a.y, a.z, 7, 0, 0); break;
      case 'cone': { const p = W.props[d]; if (p) { p.down = true; p.vx = e[0]; p.vy = e[1]; p.vz = e[2]; p.zz = 0; p.spr = CONE_DOWN; p.r = 0; } break; }
      case 'fell': { const p = W.props[d]; if (p) { W.fell(p); for (let k = 0; k < 18; k++) R.fx.add('leaf', p.x, p.y, p.z + 10 + Math.random() * 14, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, Math.random() * 60, 0.8 + Math.random() * 0.6, 2, 160, 2); } break; }
      case 'pick': { const p = R.picks[d]; if (p) R.fx.sparks(p.x, p.y, p.z + 6, 8, 80); break; }
      case 'zap': if (b) R.fx.sparks(b.x, b.y, b.z + 5, 16, 140); break;
      case 'cannon': if (a) R.fx.smoke(a.x + Math.cos(a.ang) * a.len * 0.6, a.y + Math.sin(a.ang) * a.len * 0.6, a.z + 6, 6, false, 6); break;
      case 'spike': if (a) R.fx.sparks(a.x, a.y, a.z + 2, 6, 80); break;
    }
  }
  // flygande koner
  tickProps(dt) {
    for (const p of this.R.world.props) {
      if (!p.down || !(p.vx || p.vy || p.zz > 0 || p.vz > 0)) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= 500 * dt; p.zz = Math.max(0, (p.zz || 0) + p.vz * dt);
      if (p.zz === 0) { p.vx *= 0.9; p.vy *= 0.9; p.vz = Math.abs(p.vz) > 40 ? -p.vz * 0.3 : 0; }
      if (Math.abs(p.vx) + Math.abs(p.vy) < 3 && p.zz === 0) { p.vx = p.vy = 0; }
      p.depth = p.x + p.y;
    }
  }
}
