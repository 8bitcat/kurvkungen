// HUD i spelpixlar: placering, skademätare, varv, fart, vapen/nitro, pengar, minikarta och meddelanden.
import { drawText, GRAD, panel } from './text.js?v=1';
import { isoX, isoY } from './iso.js?v=1';
import { css } from './pix.js?v=1';
import { FRONT, REAR } from './cars.js?v=1';
import { input } from './input.js?v=1';

export const ordinal = (n) => n + (n === 1 || n === 2 ? ':A' : ':E');
export const fmtTime = (t) => { if (!(t >= 0)) return '-:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };

export class Hud {
  constructor(R) {
    this.R = R; this.msgs = []; this.map = null;
    this.buildMap();
  }
  say(text, dur = 1.6, grad = GRAD.gold, big = true) {
    this.msgs = this.msgs.filter((m) => m.text !== text);
    this.msgs.push({ text, t: 0, dur, grad, big });
    if (this.msgs.length > 3) this.msgs.shift();
  }
  buildMap() {
    const T = this.R.T;
    const pts = [];
    for (let i = 0; i < T.n; i += 6) pts.push([isoX(T.X[i], T.Y[i]), isoY(T.X[i], T.Y[i], T.Z[i])]);
    let ax = 1e9, ay = 1e9, bx = -1e9, by = -1e9;
    for (const [x, y] of pts) { ax = Math.min(ax, x); ay = Math.min(ay, y); bx = Math.max(bx, x); by = Math.max(by, y); }
    const MW = 92, MH = 58, sc = Math.min((MW - 6) / (bx - ax), (MH - 6) / (by - ay));
    const ox = (MW - (bx - ax) * sc) / 2 - ax * sc, oy = (MH - (by - ay) * sc) / 2 - ay * sc;
    const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH;
    const ctx = cv.getContext('2d');
    const plot = (col, w) => {
      ctx.fillStyle = col;
      for (let k = 0; k < pts.length; k++) {
        const [x1, y1] = pts[k], [x2, y2] = pts[(k + 1) % pts.length];
        const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * sc) + 1;
        for (let j = 0; j <= n; j++) {
          const x = Math.round((x1 + (x2 - x1) * j / n) * sc + ox), y = Math.round((y1 + (y2 - y1) * j / n) * sc + oy);
          ctx.fillRect(x - (w >> 1), y - (w >> 1), w, w);
        }
      }
    };
    plot('rgba(26,20,38,0.85)', 4); plot('#e8962a', 2);
    const s0 = [Math.round(pts[0][0] * sc + ox), Math.round(pts[0][1] * sc + oy)];
    ctx.fillStyle = '#ffffff'; ctx.fillRect(s0[0] - 1, s0[1] - 2, 3, 1); ctx.fillRect(s0[0] - 1, s0[1] + 1, 3, 1);
    this.map = { cv, sc, ox, oy, MW, MH };
  }

  update(dt) { for (const m of this.msgs) m.t += dt; this.msgs = this.msgs.filter((m) => m.t < m.dur); }

  draw(ctx, vw, vh, t, car) {
    const R = this.R;
    if (car && R.mode !== 'attract') {
      // placering
      if (R.mode !== 'time') {
        const n = car.place || 1;
        const w = drawText(ctx, String(n), 6, 6, { big: true, scale: 3, grad: n === 1 ? GRAD.gold : GRAD.white });
        drawText(ctx, n === 1 || n === 2 ? ':A' : ':E', 8 + w, 6, { big: true, scale: 1, grad: GRAD.gold });
        drawText(ctx, 'AV ' + R.cars.length, 8 + w, 16, { color: 0xd8d4e0 });
      }
      // skada
      const dmg = Math.min(100, car.dmg);
      drawText(ctx, 'SKADA', vw - 6, 5, { color: 0xffe080, align: 'r' });
      const seg = 10, bw = 4, bx0 = vw - 6 - seg * (bw + 1) + 1, by0 = 12;
      ctx.fillStyle = 'rgba(16,12,28,0.8)'; ctx.fillRect(bx0 - 2, by0 - 2, seg * (bw + 1) + 3, 11);
      const lit = Math.ceil(dmg / 10), danger = dmg > 74 && ((t * 6) | 0) % 2;
      for (let k = 0; k < seg; k++) {
        const on = k < lit;
        const col = !on ? '#3a3448' : k < 4 ? '#48c838' : k < 7 ? '#f0c020' : '#e83a2a';
        ctx.fillStyle = danger && on ? '#ffffff' : col;
        ctx.fillRect(bx0 + k * (bw + 1), by0, bw, 7);
        if (on) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx0 + k * (bw + 1), by0, bw, 1); }
      }
      // pengar
      if (R.mode === 'race') drawText(ctx, (car.money + (car.prize || 0)) + ' KR', vw - 6, 26, { color: 0xffe080, align: 'r' });
      // varv
      const lapN = Math.min(R.laps, Math.max(1, car.lap + 1));
      const ly = input.touch ? 32 : vh - 30, sy = input.touch ? 36 : vh - 30;
      drawText(ctx, 'VARV', 6, ly, { color: 0xd8d4e0 });
      drawText(ctx, `${lapN}/${R.laps}`, 6, ly + 8, { big: true, scale: 2 });
      // fart
      const sp = String(car.kmh);
      drawText(ctx, 'KM/H', vw - (input.touch ? 30 : 6), sy, { color: 0xd8d4e0, align: 'r' });
      drawText(ctx, sp, vw - (input.touch ? 30 : 6), sy + 8, { big: true, scale: 2, grad: car.nitroT > 0 ? GRAD.blue : GRAD.white, align: 'r' });
      // tider
      drawText(ctx, fmtTime(R.raceTime), vw / 2, 5, { color: 0xffffff, align: 'c' });
      if (car.bestLap) drawText(ctx, 'BÄSTA ' + fmtTime(car.bestLap), vw / 2, 13, { color: 0xa8d0ff, align: 'c' });
      // vapen och nitro
      this.weaponPanel(ctx, vw, vh, t, car);
      // minikarta
      this.drawMap(ctx, 4, Math.round(vh / 2 - this.map.MH / 2) + (input.touch ? -6 : 4), t, car);
      if (car.wrongWay() && !car.finished) this.center(ctx, vw, vh * 0.32, 'FEL HÅLL!', GRAD.red, t, true);
    } else if (R.mode === 'attract') {
      this.drawMap(ctx, 4, Math.round(vh / 2 - this.map.MH / 2) + 4, t, null);
    }
    // nedräkning
    if (R.phase === 'countdown') {
      const n = Math.ceil(R.countdown);
      if (n <= 3 && n >= 1) this.center(ctx, vw, vh * 0.2, String(n), GRAD.gold, t, false, 4);
      this.lights(ctx, vw, Math.max(0, 4 - n));
    } else if (R.raceTime < 1 && R.mode !== 'attract') { this.center(ctx, vw, vh * 0.2, 'KÖR!', GRAD.green, t, false, 4); this.lights(ctx, vw, 4); }
    // meddelanden
    let y = vh * 0.24;
    for (const m of this.msgs) {
      if (m.t < 0.12 && ((m.t * 30) | 0) % 2) continue;
      drawText(ctx, m.text, vw / 2, y, { big: m.big, scale: m.big ? 2 : 1, grad: m.grad, align: 'c' });
      y += m.big ? 22 : 10;
    }
  }
  center(ctx, vw, y, text, grad, t, blink = false, scale = 3) {
    if (blink && ((t * 3) | 0) % 2) return;
    drawText(ctx, text, vw / 2, y, { big: true, scale, grad, align: 'c' });
  }
  lights(ctx, vw, reds) {
    const x0 = Math.round(vw / 2 - 26), y0 = 22;
    panel(ctx, x0, y0, 52, 16, 'rgba(20,16,30,0.9)', '#5a5468');
    for (let k = 0; k < 3; k++) {
      const on = k < reds;
      const go = reds >= 4;
      ctx.fillStyle = go ? '#3ae84a' : on ? '#ff3a2a' : '#4a2a2e';
      ctx.fillRect(x0 + 6 + k * 15, y0 + 4, 10, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x0 + 7 + k * 15, y0 + 5, 3, 2);
    }
  }
  weaponPanel(ctx, vw, vh, t, car) {
    const np = Math.max(car.nitro, car.st.nitro);
    const PW = 118 + np * 7, x = Math.round(vw / 2 - PW / 2), y = vh - 20;
    panel(ctx, x, y, PW, 16);
    const f = FRONT[car.frontW], r = REAR[car.rearW];
    drawText(ctx, f.short, x + 5, y + 6, { color: car.ammoF ? 0xffffff : 0x7a7488 });
    drawText(ctx, String(car.ammoF), x + 60, y + 6, { color: 0xffe080, align: 'r' });
    ctx.fillStyle = 'rgba(242,194,28,0.4)'; ctx.fillRect(x + 64, y + 3, 1, 10);
    drawText(ctx, r.short, x + 68, y + 6, { color: car.ammoR ? 0xffffff : 0x7a7488 });
    drawText(ctx, String(car.ammoR), x + 104, y + 6, { color: 0xffe080, align: 'r' });
    ctx.fillStyle = 'rgba(242,194,28,0.4)'; ctx.fillRect(x + 108, y + 3, 1, 10);
    for (let k = 0; k < np; k++) {
      const on = k < car.nitro;
      ctx.fillStyle = on ? (car.nitroT > 0 && k === car.nitro - 1 ? '#ffffff' : '#4a9aff') : '#3a3448';
      ctx.fillRect(x + 112 + k * 7, y + 4, 5, 8);
      if (on) { ctx.fillStyle = '#c8e4ff'; ctx.fillRect(x + 112 + k * 7, y + 4, 5, 1); }
    }
    if (car.nitroT > 0) { ctx.fillStyle = '#4a9aff'; ctx.fillRect(x + 1, y + 14, Math.round((PW - 2) * car.nitroT / 1.8), 1); }
  }
  drawMap(ctx, x, y, t, me) {
    const m = this.map;
    ctx.globalAlpha = 0.85; ctx.drawImage(m.cv, x, y); ctx.globalAlpha = 1;
    const cars = [...this.R.cars].sort((a) => (a === me ? 1 : -1));
    for (const c of cars) {
      const sx = Math.round(isoX(c.x, c.y) * m.sc + m.ox) + x, sy = Math.round(isoY(c.x, c.y, c.z) * m.sc + m.oy) + y;
      if (c === me) { ctx.fillStyle = '#1a1426'; ctx.fillRect(sx - 2, sy - 2, 5, 5); ctx.fillStyle = ((t * 4) | 0) % 2 ? '#ffffff' : css(c.color); ctx.fillRect(sx - 1, sy - 1, 3, 3); }
      else { ctx.fillStyle = '#1a1426'; ctx.fillRect(sx - 1, sy - 1, 4, 4); ctx.fillStyle = css(c.color); ctx.fillRect(sx - 1, sy - 1, 3, 3); }
    }
  }
}
