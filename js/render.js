// Ritar loppet: terräng → markdekaler och skuggor → djupsorterade sprites → partiklar.
import { isoX, isoY, SHX, SHY } from './iso.js?v=1';
import { renderCar, renderShadow, burnt, palette, ANGLES, SPR_OX, SPR_OY } from './carsprites.js?v=1';
import { CARS } from './cars.js?v=1';
import { PICKUPS, MINE } from './props.js?v=1';
import { css } from './pix.js?v=1';

// ---------- spritebank för bilar (ritas vid behov, cachas) ----------
const bank = new Map(), shadows = new Map();
function carSet(model, color) {
  const key = model + ':' + color;
  let s = bank.get(key);
  if (!s) { s = { model, pal: palette(color), spr: new Array(ANGLES), burnt: new Array(ANGLES) }; bank.set(key, s); }
  return s;
}
export function angIndex(a) { return ((Math.round(a / (Math.PI * 2) * ANGLES) % ANGLES) + ANGLES) % ANGLES; }
export function carSprite(model, color, a, wreck = false) {
  const s = carSet(model, color), k = angIndex(a);
  if (!s.spr[k]) s.spr[k] = renderCar(model, s.pal, (k / ANGLES) * Math.PI * 2);
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
    const model = CARS[c.carId].model;
    for (let k = 0; k < ANGLES; k++) { carSprite(model, c.color, (k / ANGLES) * Math.PI * 2); shadowSprite(model, (k / ANGLES) * Math.PI * 2); if (k % 8 === 7) yield; }
  }
}

const list = [], props = [];
export function drawRace(ctx, R, cam, vw, vh, t) {
  const W = R.world, th = W.th;
  const x0 = Math.round(isoX(cam.x, cam.y) - vw / 2 + (cam.shx || 0)), y0 = Math.round(isoY(cam.x, cam.y, cam.z) - vh / 2 + (cam.shy || 0));
  ctx.fillStyle = css(th.outside); ctx.fillRect(0, 0, vw, vh);
  W.drawTerrain(ctx, x0, y0, vw, vh);
  const P = (x, y, z) => [Math.round(isoX(x, y) - x0), Math.round(isoY(x, y, z) - y0)];

  // markdekaler: olja
  for (const o of R.oils) {
    const [sx, sy] = P(o.x, o.y, o.z);
    if (o.t < 2 && ((t * 8) | 0) % 2) continue;
    ctx.drawImage(o.spr.cv, sx - o.spr.ox, sy - o.spr.oy);
  }
  // bilskuggor
  for (const c of R.cars) {
    if (c.sinkT > 0) continue;
    const model = CARS[c.carId].model;
    const g = c.air ? W.groundAt(c.x, c.y, c.si) : c.z, h = Math.max(0, c.z - g);
    const [sx, sy] = P(c.x + SHX * h, c.y + SHY * h, g);
    ctx.drawImage(shadowSprite(model, c.ang), sx - SPR_OX, sy - SPR_OY);
  }
  // upplockningar: skugga
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
    }
  }
  // kulor
  ctx.fillStyle = '#fff2a0';
  for (const b of R.bullets) {
    const [sx, sy] = P(b.x, b.y, b.z);
    const l = Math.hypot(b.vx, b.vy) || 1, dx = b.vx / l, dy = b.vy / l;
    const ex = (dx - dy) * 3, ey = (dx + dy) * 1.5;
    for (let k = 0; k < 3; k++) ctx.fillRect(Math.round(sx - ex * k / 2), Math.round(sy - ey * k / 2), 1, 1);
  }
  R.fx.draw(ctx, x0, y0);
  return { x0, y0 };
}

function drawCar(ctx, R, c, P, t) {
  if (c.inv > 0 && ((t * 12) | 0) % 2 && c.wreckT <= 0) return;
  const model = CARS[c.carId].model;
  const spr = carSprite(model, c.color, c.ang, c.wreckT > 0);
  const [sx, sy] = P(c.x, c.y, c.z);
  // terräng framför bilen (t.ex. när den ramlat ner bakom ett krön) döljer den nedre delen
  let occ = -1e9;
  if (c.air || c.dist > c.hw + 6 || c.sinkT > 0) {
    const W = R.world;
    for (let d = 1.5; d < 80; d += 1.5) { const h = W.groundAt(c.x + d, c.y + d, c.si) - d; if (h > occ) occ = h; }
    if (c.sinkT > 0) occ = Math.max(occ, 0);
  }
  const hide = occ - c.z;
  if (hide > 0.5) {
    const cut = Math.round(SPR_OY - hide);
    if (cut <= 0) return;
    ctx.drawImage(spr, 0, 0, spr.width, cut, sx - SPR_OX, sy - SPR_OY, spr.width, cut);
  } else ctx.drawImage(spr, sx - SPR_OX, sy - SPR_OY);
  if (c.hitFlash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(spr, sx - SPR_OX, sy - SPR_OY); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
}
