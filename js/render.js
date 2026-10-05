// Ritar loppet: terräng → markdekaler och skuggor → djupsorterade sprites → partiklar → mörker/ljus.
import { isoX, isoY, SHX, SHY } from './iso.js?v=1';
import { renderCar, renderShadow, burnt, palette, lookKey, ANGLES } from './carsprites.js?v=1';
import { PICKUPS, MINE, BARREL } from './props.js?v=1';
import { css } from './pix.js?v=1';

// ---------- spritebank för fordon (ritas vid behov, cachas) ----------
const bank = new Map(), shadows = new Map();
export function lookOf(c) {
  if (!c._look) c._look = { pal: palette(c.color), pattern: c.pattern || 'rander', spoiler: !!(c.acc && c.acc.spoiler), ramm: (c.upg && c.upg.ramm) || 0 };
  return c._look;
}
export function angIndex(a) { return ((Math.round(a / (Math.PI * 2) * ANGLES) % ANGLES) + ANGLES) % ANGLES; }
export function carSprite(model, look, a, wreck = false) {
  const key = model + ':' + lookKey(look);
  let s = bank.get(key);
  if (!s) { s = { spr: new Array(ANGLES), burnt: new Array(ANGLES) }; bank.set(key, s); }
  const k = angIndex(a);
  if (!s.spr[k]) s.spr[k] = renderCar(model, look, (k / ANGLES) * Math.PI * 2);
  if (wreck) { if (!s.burnt[k]) s.burnt[k] = burnt(s.spr[k]); return s.burnt[k]; }
  return s.spr[k];
}
export function shadowSprite(model, a) {
  let s = shadows.get(model);
  if (!s) { s = new Array(ANGLES); shadows.set(model, s); }
  const k = angIndex(a);
  if (!s[k]) s[k] = renderShadow(model, (k / ANGLES) * Math.PI * 2);
  return s[k];
}
// Förrendera alla vinklar för loppets bilar (anropas under laddningen, i bitar)
export function* prewarm(cars) {
  for (const c of cars) {
    for (let k = 0; k < ANGLES; k++) { carSprite(c.model, lookOf(c), (k / ANGLES) * Math.PI * 2); shadowSprite(c.model, (k / ANGLES) * Math.PI * 2); if (k % 8 === 7) yield; }
  }
}

const list = [], props = [];
let darkCv = null, dctx = null;
export function drawRace(ctx, R, cam, vw, vh, t) {
  const W = R.world, th = W.th;
  const x0 = Math.round(isoX(cam.x, cam.y) - vw / 2 + (cam.shx || 0)), y0 = Math.round(isoY(cam.x, cam.y, cam.z) - vh / 2 + (cam.shy || 0));
  ctx.fillStyle = css(th.outside); ctx.fillRect(0, 0, vw, vh);
  W.drawTerrain(ctx, x0, y0, vw, vh);
  const P = (x, y, z) => [Math.round(isoX(x, y) - x0), Math.round(isoY(x, y, z) - y0)];
  const on = (sx, sy, m = 60) => sx > -m && sx < vw + m && sy > -m && sy < vh + m;

  // markdekaler: olja, lim, spikmattor, överkörda djur
  for (const o of R.oils.concat(R.glues)) {
    const [sx, sy] = P(o.x, o.y, o.z);
    if (!on(sx, sy) || (o.t < 2 && ((t * 8) | 0) % 2)) continue;
    ctx.drawImage(o.spr.cv, sx - o.spr.ox, sy - o.spr.oy);
  }
  for (const s of R.spikes) drawSpikes(ctx, s, P, t);
  for (const a of R.animals.list) {
    if (a.state !== 'flat') continue;
    const [sx, sy] = P(a.x, a.y, a.z);
    if (!on(sx, sy)) continue;
    const s = R.animals.spriteOf(a);
    ctx.drawImage(s.cv, sx - s.ox, sy - s.oy);
  }
  // fordonsskuggor
  for (const c of R.cars) {
    if (c.sinkT > 0) continue;
    const g = c.air ? W.groundAt(c.x, c.y, c.si) : c.z, h = Math.max(0, c.z - g);
    const [sx, sy] = P(c.x + SHX * h, c.y + SHY * h, g);
    if (!on(sx, sy, 80)) continue;
    const sh = shadowSprite(c.model, c.ang);
    ctx.drawImage(sh, sx - sh.ox, sy - sh.oy);
  }
  ctx.fillStyle = 'rgba(20,12,30,.3)';
  for (const p of R.picks) {
    if (p.respawn > 0) continue;
    const [sx, sy] = P(p.x, p.y, p.z);
    ctx.fillRect(sx - 3, sy, 7, 1); ctx.fillRect(sx - 2, sy + 1, 5, 1);
  }

  // djupsorterade sprites
  list.length = 0;
  W.visibleProps(x0, y0, vw, vh, props);
  for (const p of props) list.push({ d: p.depth, k: 0, o: p });
  props.length = 0;
  for (const c of R.cars) list.push({ d: c.x + c.y, k: 1, o: c });
  for (const p of R.picks) if (p.respawn <= 0) list.push({ d: p.x + p.y, k: 2, o: p });
  for (const m of R.mines) list.push({ d: m.x + m.y - 4, k: 3, o: m });
  for (const m of R.missiles) list.push({ d: m.x + m.y, k: 4, o: m });
  for (const b of R.barrels) list.push({ d: b.x + b.y, k: 5, o: b });
  for (const a of R.animals.list) if (a.state !== 'flat' && a.state !== 'gone') list.push({ d: a.x + a.y, k: 6, o: a });
  list.sort((a, b) => a.d - b.d);
  for (const e of list) {
    const o = e.o;
    if (e.k === 0) {
      const [sx, sy] = P(o.x, o.y, o.z + (o.zz || 0));
      ctx.drawImage(o.spr.cv, sx - o.spr.ox, sy - o.spr.oy);
    } else if (e.k === 1) drawCar(ctx, R, o, P, t);
    else if (e.k === 2) {
      const [sx, sy] = P(o.x, o.y, o.z + 7 + Math.sin(t * 3 + o.x) * 1.5);
      const s = PICKUPS[o.kind];
      ctx.drawImage(s.cv, sx - s.ox, sy - s.oy);
      if (((t * 2 + o.x * 0.01) % 1) < 0.08) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 3, sy - 4, 1, 1); ctx.fillRect(sx - 4, sy - 3, 3, 1); }
    } else if (e.k === 3) {
      const [sx, sy] = P(o.x, o.y, o.z);
      const s = MINE[o.arm <= 0 && ((t * 3) % 1) < 0.5 ? 1 : 0];
      ctx.drawImage(s.cv, sx - s.ox, sy - s.oy);
    } else if (e.k === 4) {
      const [sx, sy] = P(o.x, o.y, o.z);
      const dx = Math.cos(o.ang), dy = Math.sin(o.ang);
      const ex = Math.round((dx - dy) * 3), ey = Math.round((dx + dy) * 1.5);
      ctx.fillStyle = '#2a2830'; ctx.fillRect(sx - ex - 1, sy - ey - 1, 3, 3);
      ctx.fillStyle = '#d8dce6'; ctx.fillRect(sx - 1, sy - 1, 2, 2);
      ctx.fillStyle = '#ff4030'; ctx.fillRect(sx + ex, sy + ey, 1, 1);
      ctx.fillStyle = (t * 20 | 0) % 2 ? '#fff0a0' : '#ffa030'; ctx.fillRect(sx - ex * 2, sy - ey * 2, 2, 2);
    } else if (e.k === 5) {
      const [sx, sy] = P(o.x, o.y, o.z);
      ctx.drawImage(BARREL.cv, sx - BARREL.ox, sy - BARREL.oy);
    } else if (e.k === 6) {
      const [sx, sy] = P(o.x, o.y, o.z);
      if (!on(sx, sy)) continue;
      const s = R.animals.spriteOf(o);
      if (o.state === 'fly') { ctx.fillStyle = 'rgba(20,12,30,.28)'; const g = W.groundAt(o.x, o.y, o.si); const [gx, gy] = P(o.x, o.y, g); ctx.fillRect(gx - 4, gy, 9, 2); }
      ctx.drawImage(s.cv, sx - s.ox, sy - s.oy);
    }
  }
  // kulor och granater
  ctx.fillStyle = '#fff2a0';
  for (const b of R.bullets) {
    const [sx, sy] = P(b.x, b.y, b.z);
    const l = Math.hypot(b.vx, b.vy) || 1, dx = b.vx / l, dy = b.vy / l;
    const ex = (dx - dy) * 3, ey = (dx + dy) * 1.5;
    for (let k = 0; k < 3; k++) ctx.fillRect(Math.round(sx - ex * k / 2), Math.round(sy - ey * k / 2), 1, 1);
  }
  for (const s of R.shells) {
    const [sx, sy] = P(s.x, s.y, s.z);
    ctx.fillStyle = '#1c1a20'; ctx.fillRect(sx - 1, sy - 1, 3, 3);
    ctx.fillStyle = '#ffd060'; ctx.fillRect(sx, sy - 1, 1, 1);
  }
  for (const b of R.beams) drawBeam(ctx, b, P, t);
  for (const b of R.bolts) drawBolt(ctx, b, P, t);
  R.fx.draw(ctx, x0, y0);
  if (R.night) drawNight(ctx, R, P, vw, vh, t, x0, y0);
  return { x0, y0 };
}

function drawCar(ctx, R, c, P, t) {
  if (c.inv > 0 && ((t * 12) | 0) % 2 && c.wreckT <= 0) return;
  const spr = carSprite(c.model, lookOf(c), c.ang, c.wreckT > 0);
  const bob = c.st.hover && !c.air ? Math.round(Math.sin(t * 7 + c.x * 0.1) * 0.6 + 0.5) : 0;
  const [sx, sy0] = P(c.x, c.y, c.z);
  const sy = sy0 - bob;
  // terräng framför bilen (t.ex. när den ramlat ner bakom ett krön) döljer den nedre delen
  let occ = -1e9;
  if (c.air || c.dist > c.hw + 6 || c.sinkT > 0) {
    const W = R.world;
    for (let d = 1.5; d < 80; d += 1.5) { const h = W.groundAt(c.x + d, c.y + d, c.si) - d; if (h > occ) occ = h; }
    if (c.sinkT > 0) occ = Math.max(occ, 0);
  }
  const hide = occ - c.z;
  if (hide > 0.5) {
    const cut = Math.round(spr.oy - hide);
    if (cut <= 0) return;
    ctx.drawImage(spr, 0, 0, spr.width, cut, sx - spr.ox, sy - spr.oy, spr.width, cut);
  } else ctx.drawImage(spr, sx - spr.ox, sy - spr.oy);
  if (c.hitFlash > 0 || c.empT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = c.empT > 0 ? 0.25 + 0.25 * Math.sin(t * 40) : 0.6; ctx.drawImage(spr, sx - spr.ox, sy - spr.oy); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  // polisens blåljus blinkar
  if (c.model === 'polisen' && c.wreckT <= 0) {
    const ph = ((t * 6) | 0) % 2;
    ctx.fillStyle = ph ? '#5a8cff' : '#ff5a4a';
    ctx.fillRect(sx + (ph ? -2 : 1), sy - 13, 2, 1);
  }
}

function drawSpikes(ctx, s, P, t) {
  const ux = Math.cos(s.ang), uy = Math.sin(s.ang);
  const n = Math.round(s.len / 2.5);
  for (let k = 0; k <= n; k++) {
    const f = k / n - 0.5;
    const [sx, sy] = P(s.x + ux * f * s.len, s.y + uy * f * s.len, s.z);
    ctx.fillStyle = '#2a2830'; ctx.fillRect(sx - 1, sy, 3, 1);
    ctx.fillStyle = (k & 1) ? '#c8ccd4' : '#8a8e9a'; ctx.fillRect(sx, sy - 2, 1, 2);
  }
  void t;
}
function line(ctx, x0, y0, x1, y1, col, w = 1) {
  ctx.fillStyle = col;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let k = 0; k <= n; k++) { const f = n ? k / n : 0; ctx.fillRect(Math.round(x0 + (x1 - x0) * f) - (w >> 1), Math.round(y0 + (y1 - y0) * f) - (w >> 1), w, w); }
}
function drawBeam(ctx, b, P, t) {
  const [ax, ay] = P(b.x0, b.y0, b.z), [bx, by] = P(b.x1, b.y1, b.z);
  line(ctx, ax, ay, bx, by, 'rgba(255,40,60,0.55)', 3);
  line(ctx, ax, ay, bx, by, ((t * 30) | 0) % 2 ? '#ffffff' : '#ffb0c0', 1);
  if (b.hit) { ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 2, by - 2, 4, 4); }
}
function drawBolt(ctx, b, P, t) {
  const [ax, ay] = P(b.x0, b.y0, b.z0), [bx, by] = P(b.x1, b.y1, b.z1);
  const n = 7;
  let px = ax, py = ay;
  for (let k = 1; k <= n; k++) {
    const f = k / n;
    const jx = k === n ? 0 : (Math.sin(b.seed + k * 7.3 + t * 40) * 6), jy = k === n ? 0 : (Math.cos(b.seed + k * 3.1 + t * 33) * 4);
    const qx = ax + (bx - ax) * f + jx, qy = ay + (by - ay) * f + jy;
    line(ctx, px, py, qx, qy, 'rgba(140,180,255,0.6)', 3);
    line(ctx, px, py, qx, qy, '#ffffff', 1);
    px = qx; py = qy;
  }
}

// ---------- natt: mörker med strålkastare och lampor ----------
function cone(dctx, P, c, L, wN, wF, z) {
  const fx = Math.cos(c.ang), fy = Math.sin(c.ang), rx = -fy, ry = fx;
  const nx = c.x + fx * (c.len / 2), ny = c.y + fy * (c.len / 2);
  const pts = [[nx + rx * wN, ny + ry * wN], [nx + fx * L + rx * wF, ny + fy * L + ry * wF], [nx + fx * L * 1.06, ny + fy * L * 1.06], [nx + fx * L - rx * wF, ny + fy * L - ry * wF], [nx - rx * wN, ny - ry * wN]];
  dctx.beginPath();
  pts.forEach(([x, y], k) => { const [sx, sy] = P(x, y, z); if (k) dctx.lineTo(sx, sy); else dctx.moveTo(sx, sy); });
  dctx.closePath(); dctx.fill();
}
function pool(dctx, sx, sy, r) { dctx.beginPath(); dctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2); dctx.fill(); }
function drawNight(ctx, R, P, vw, vh, t, x0, y0) {
  if (!darkCv || darkCv.width !== vw || darkCv.height !== vh) { darkCv = document.createElement('canvas'); darkCv.width = vw; darkCv.height = vh; dctx = darkCv.getContext('2d'); }
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, vw, vh);
  dctx.fillStyle = 'rgba(6,8,32,0.82)'; dctx.fillRect(0, 0, vw, vh);
  dctx.globalCompositeOperation = 'destination-out';
  const lights = R.world.lights || [];
  // gatlyktor
  for (const L of lights) {
    const [sx, sy] = P(L.x, L.y, L.z);
    if (sx < -80 || sx > vw + 80 || sy < -60 || sy > vh + 60) continue;
    for (const [r, a] of [[42, 0.25], [32, 0.25], [22, 0.3], [12, 0.3]]) { dctx.fillStyle = `rgba(0,0,0,${a})`; pool(dctx, sx, sy, r * (L.s || 1)); }
  }
  // bilarnas strålkastare och ljuset runt bilen
  for (const c of R.cars) {
    if (c.wreckT > 0 || c.sinkT > 0) continue;
    const Lb = 120 * c.st.light;
    for (const [f, a] of [[1, 0.22], [0.8, 0.22], [0.58, 0.25], [0.36, 0.3]]) { dctx.fillStyle = `rgba(0,0,0,${a})`; cone(dctx, P, c, Lb * f, 3.5, 16 + Lb * f * 0.32, c.z); }
    const [sx, sy] = P(c.x, c.y, c.z);
    for (const [r, a] of [[22, 0.3], [13, 0.35]]) { dctx.fillStyle = `rgba(0,0,0,${a})`; pool(dctx, sx, sy, r); }
  }
  // eld och explosioner lyser
  for (const r of R.fx.rings) { const [sx, sy] = P(r.x, r.y, r.z); dctx.fillStyle = 'rgba(0,0,0,0.7)'; pool(dctx, sx, sy, r.r * 2.4 * (1 - r.t / r.life)); }
  let nf = 0;
  for (const p of R.fx.p) {
    if (p.kind !== 'fire' && p.kind !== 'flame' && p.kind !== 'spark') continue;
    if (++nf > 90) break;
    const sx = Math.round(isoX(p.x, p.y) - x0), sy = Math.round(isoY(p.x, p.y, p.z) - y0);
    dctx.fillStyle = 'rgba(0,0,0,0.35)'; pool(dctx, sx, sy, p.kind === 'spark' ? 4 : 9);
  }
  for (const p of R.picks) { if (p.respawn > 0) continue; const [sx, sy] = P(p.x, p.y, p.z + 6); dctx.fillStyle = 'rgba(0,0,0,0.5)'; pool(dctx, sx, sy, 9); }
  for (const b of R.beams) { const [sx, sy] = P(b.x1, b.y1, b.z); dctx.fillStyle = 'rgba(0,0,0,0.6)'; pool(dctx, sx, sy, 10); }
  for (const b of R.bolts) { const [sx, sy] = P(b.x1, b.y1, b.z1); dctx.fillStyle = 'rgba(0,0,0,0.8)'; pool(dctx, sx, sy, 30); }
  dctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(darkCv, 0, 0);
  // färgat ljus ovanpå
  ctx.globalCompositeOperation = 'lighter';
  for (const c of R.cars) {
    if (c.wreckT > 0 || c.sinkT > 0) continue;
    ctx.fillStyle = 'rgba(255,224,150,0.07)';
    cone(ctx, P, c, 120 * c.st.light * 0.9, 3.5, 12 + 30 * c.st.light, c.z);
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    const [tx, ty] = P(c.x - fx * c.len / 2, c.y - fy * c.len / 2, c.z + 3);
    ctx.fillStyle = 'rgba(255,40,30,0.35)'; pool(ctx, tx, ty, 5);
    if (c.st.neon) { const [sx, sy] = P(c.x, c.y, c.z); ctx.fillStyle = c.neonCol || 'rgba(60,220,255,0.35)'; pool(ctx, sx, sy, c.len * 0.75); }
    if (c.model === 'polisen') { const [sx, sy] = P(c.x, c.y, c.z + 9); ctx.fillStyle = ((t * 6) | 0) % 2 ? 'rgba(60,110,255,0.4)' : 'rgba(255,60,50,0.4)'; pool(ctx, sx, sy, 26); }
  }
  for (const L of lights) { const [sx, sy] = P(L.x, L.y, L.z); if (sx < -60 || sx > vw + 60 || sy < -40 || sy > vh + 40) continue; ctx.fillStyle = L.col || 'rgba(255,200,120,0.12)'; pool(ctx, sx, sy, 34 * (L.s || 1)); }
  ctx.globalCompositeOperation = 'source-over';
  // lampornas glödande huvuden
  for (const L of lights) { if (!L.head) continue; const [sx, sy] = P(L.x0, L.y0, L.z + L.h); ctx.fillStyle = '#fff6c8'; ctx.fillRect(sx - 1, sy - 1, 3, 2); }
}
