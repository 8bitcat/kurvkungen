// HUD i spelpixlar: placering, skademätare, varv, fart, vapen/nitro, pengar, minikarta och meddelanden.
import { drawText, GRAD, panel, tw } from './text.js?v=1';
import { isoX, isoY } from './iso.js?v=1';
import { css } from './pix.js?v=1';
import { FRONT, REAR } from './cars.js?v=1';
import { input } from './input.js?v=1';
import { COMPOUNDS, TEAMS } from './f1.js?v=1';
import { relS, idxAt } from './trackgeo.js?v=1';

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
    if (R.f1) { this.drawF1(ctx, vw, vh, t, car); return; }
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
  // ---------- Grand Prix ----------
  drawF1(ctx, vw, vh, t, car) {
    const R = this.R;
    if (!car) return;
    const time = R.mode === 'time';
    // placering
    if (!time) {
      const w = drawText(ctx, 'P' + (car.place || 1), 6, 6, { big: true, scale: 2, grad: car.place === 1 ? GRAD.gold : GRAD.white });
      drawText(ctx, '/' + R.cars.length, 9 + w, 13, { color: 0xd8d4e0 });
    } else {
      drawText(ctx, 'KVAL', 6, 6, { big: true, scale: 2, grad: GRAD.gold });
      drawText(ctx, 'BÄSTA VARVET RÄKNAS', 6, 26, { color: 0xd8d4e0 });
      if (R.poleRef) drawText(ctx, 'POLETID CA ' + fmtTime(R.poleRef), 6, 35, { color: 0xffe080 });
    }
    // tidtabell
    if (!time) this.tower(ctx, vw, vh, t, car);
    // varv och tider
    const lapN = Math.min(R.laps, Math.max(1, car.lap + 1));
    drawText(ctx, `VARV ${lapN}/${R.laps}`, vw / 2, 5, { color: 0xffffff, align: 'c' });
    drawText(ctx, fmtTime(R.raceTime), vw / 2, 13, { color: 0xd8d4e0, align: 'c' });
    const last = car.lapTimes[car.lapTimes.length - 1];
    if (last) drawText(ctx, 'SENASTE ' + fmtTime(last) + (car.bestLap ? '   BÄSTA ' + fmtTime(car.bestLap) : ''), vw / 2, 21, { color: 0xa8d0ff, align: 'c' });
    // däck
    this.tyrePanel(ctx, vw, vh, t, car);
    // fart och växel
    const sp = car.kmh, gears = [0, 0.16, 0.28, 0.4, 0.52, 0.64, 0.76, 0.88, 2];
    const f = car.speed / car.st.vmax; let g = 1; while (g < 8 && f > gears[g]) g++;
    drawText(ctx, 'KM/H', vw - (input.touch ? 30 : 6), input.touch ? 70 : vh - 30, { color: 0xd8d4e0, align: 'r' });
    drawText(ctx, String(sp), vw - (input.touch ? 30 : 6), input.touch ? 78 : vh - 22, { big: true, scale: 2, grad: car.drs ? GRAD.green : GRAD.white, align: 'r' });
    drawText(ctx, car.speed < 3 ? 'N' : String(g), vw - (input.touch ? 82 : 58), input.touch ? 78 : vh - 22, { big: true, scale: 2, grad: GRAD.gold, align: 'r' });
    // DRS och slipstream
    const bx = Math.round(vw / 2 - 40), by = vh - 18;
    panel(ctx, bx, by, 80, 14, 'rgba(20,16,40,0.8)', car.drs ? '#3ae84a' : car.drsOk ? '#f2f0ea' : '#5a5468');
    drawText(ctx, 'DRS', bx + 6, by + 5, { color: car.drs ? 0x6aff6a : car.drsOk ? 0xffffff : 0x6a6480 });
    ctx.fillStyle = '#2a2640'; ctx.fillRect(bx + 26, by + 5, 48, 4);
    if (car.tow > 0.05) { ctx.fillStyle = car.tow > 0.6 ? '#a8e0ff' : '#5a9ad8'; ctx.fillRect(bx + 26, by + 5, Math.round(48 * car.tow), 4); }
    drawText(ctx, 'SUG', bx + 50, by - 6, { color: car.tow > 0.05 ? 0xa8e0ff : 0x5a5468, align: 'c' });
    // depå
    if (car.pitPhase === 'stop') {
      this.center(ctx, vw, vh * 0.3, (Math.max(0, car.pitT)).toFixed(1), GRAD.gold, t, false, 3);
      if (car.pitWork) {
        const txt = car.pitWork.map(([n, s]) => `${n} ${s.toFixed(1)}`).join('  +  '), w = tw(txt) + 12;
        panel(ctx, Math.round(vw / 2 - w / 2), Math.round(vh * 0.3 + 26), w, 13, 'rgba(14,10,26,0.85)', '#5a5468');
        drawText(ctx, txt, vw / 2, vh * 0.3 + 30, { color: 0xffffff, align: 'c' });
      }
    }
    else if (car.pitPhase) drawText(ctx, 'DEPÅ – FARTBEGRÄNSARE', vw / 2, vh * 0.3, { big: true, grad: GRAD.gold, align: 'c' });
    else if (car.boxing) {
      if (((t * 3) | 0) % 2) drawText(ctx, car.punct ? 'PUNKA – BOXA DETTA VARV' : car.wingLost ? 'UTAN FRAMVINGE – BOXA DETTA VARV' : 'BOXA DETTA VARV', vw / 2, vh * 0.3, { big: true, grad: GRAD.fire, align: 'c' });
      // hur långt kvar till depåinfarten (bilen är 24 enheter ≈ 5,6 m)
      const T = R.T, left = ((relS(T, T.pit.s0 - car.s) % T.L) + T.L) % T.L;
      const txt = left < 260 ? 'DEPÅINFART – HÅLL KVAR, BILEN SVÄNGER IN' : `DEPÅINFART OM ${Math.round(left * 0.233 / 10) * 10} M  (FÖLJ DE GULA PILARNA)`;
      drawText(ctx, txt, vw / 2, vh * 0.3 + 20, { color: 0xffe080, align: 'c' });
    }
    if (car.wrongWay() && !car.finished) this.center(ctx, vw, vh * 0.32, 'FEL HÅLL!', GRAD.red, t, true);
    // minikarta nere till vänster
    // (på pekskärm ligger styrknapparna där – tidtabellen och varvet överst räcker)
    if (!input.touch) {
      this.drawMap(ctx, 4, vh - this.map.MH - 34, t, car);
      drawText(ctx, `VARV`, 6, vh - 30, { color: 0xd8d4e0 });
      drawText(ctx, `${lapN}/${R.laps}`, 6, vh - 22, { big: true, scale: 2 });
    }
    // startljus
    if (time && (R.phase === 'countdown' || R.raceTime < 4)) {
      this.center(ctx, vw, vh * 0.42, 'KVAL', GRAD.gold, t, false, 3);
      drawText(ctx, 'DU KÖR ENSAM 3 VARV – BÄSTA VARVET GER DIN STARTRUTA', vw / 2, vh * 0.42 + 32, { color: 0xffffff, align: 'c' });
      drawText(ctx, 'SEDAN STARTAR LOPPET MOT 21 BILAR. DEPÅN ÖPPNAR I LOPPET.', vw / 2, vh * 0.42 + 42, { color: 0xffe080, align: 'c' });
    }
    if (R.phase === 'countdown') this.f1Lights(ctx, vw, R.lights, false);
    else if (R.raceTime < 1.2 && !time) { this.f1Lights(ctx, vw, 0, true); this.center(ctx, vw, vh * 0.22, 'KÖR!', GRAD.green, t, false, 3); }
    let y = vh * 0.38;
    for (const m of this.msgs) {
      if (m.t < 0.12 && ((m.t * 30) | 0) % 2) continue;
      drawText(ctx, m.text, vw / 2, y, { big: m.big, scale: m.big ? 2 : 1, grad: m.grad, align: 'c' });
      y += m.big ? 22 : 10;
    }
  }
  f1Lights(ctx, vw, n, out) {
    const x0 = Math.round(vw / 2 - 46), y0 = 30;
    panel(ctx, x0, y0, 92, 18, 'rgba(14,10,22,0.92)', '#3a3448');
    for (let k = 0; k < 5; k++) {
      const on = k < n;
      ctx.fillStyle = out ? '#1a1a22' : on ? '#ff2a1a' : '#3a1a1e';
      ctx.fillRect(x0 + 6 + k * 17, y0 + 4, 12, 10);
      if (on) { ctx.fillStyle = 'rgba(255,200,180,0.6)'; ctx.fillRect(x0 + 7 + k * 17, y0 + 5, 4, 3); }
    }
  }
  tyrePanel(ctx, vw, vh, t, car) {
    const x = vw - 92, y = 6;
    panel(ctx, x, y, 86, 53, 'rgba(20,16,40,0.82)', '#5a5468');
    const C = COMPOUNDS[car.tyre.c];
    // ring med bokstav
    const cx = x + 13, cy = y + 13;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const r = Math.hypot(dx, dy); if (r <= 8) { ctx.fillStyle = r > 5.6 ? css(C.color) : r > 4.6 ? '#1a1426' : '#2a2830'; ctx.fillRect(cx + dx, cy + dy, 1, 1); } }
    drawText(ctx, C.letter, cx, cy - 2, { color: 0xffffff, align: 'c' });
    const w = Math.min(100, car.tyre.wear);
    drawText(ctx, C.name, x + 26, y + 5, { color: 0xffffff });
    ctx.fillStyle = '#2a2640'; ctx.fillRect(x + 26, y + 14, 54, 5);
    ctx.fillStyle = w > 80 ? '#e83a2a' : w > 55 ? '#f0c020' : '#48c838';
    ctx.fillRect(x + 26, y + 14, Math.max(1, Math.round(54 * (1 - w / 100))), 5);
    drawText(ctx, Math.round(100 - w) + '%', x + 80, y + 22, { color: 0xd8d4e0, align: 'r' });
    const N = COMPOUNDS[car.nextTyre];
    drawText(ctx, 'NÄSTA', x + 6, y + 30, { color: 0x9a94b0 });
    ctx.fillStyle = css(N.color); ctx.fillRect(x + 32, y + 29, 7, 7);
    drawText(ctx, N.letter + (input.touch ? '' : ' (1-3)'), x + 42, y + 30, { color: 0xffffff });
    const ok = car.used.size >= 2 || this.R.laps < 3;
    drawText(ctx, `STOPP ${car.stops}`, x + 6, y + 38, { color: 0xd8d4e0 });
    drawText(ctx, ok ? '2 BLANDN. OK' : '2 BLANDN. !', x + 82, y + 38, { color: ok ? 0x7ae06a : 0xffa060, align: 'r' });
    // skador
    const blink = ((t * 4) | 0) % 2;
    if (car.punct) drawText(ctx, 'PUNKA!', x + 6, y + 46, { color: blink ? 0xff5040 : 0xffd040 });
    else drawText(ctx, 'DÄCK HELA', x + 6, y + 46, { color: 0x7ae06a });
    const wl = car.wingLost ? 'VINGE BORTA' : car.wing > 3 ? `VINGE ${Math.round(car.wing)}%` : 'VINGE OK';
    drawText(ctx, wl, x + 82, y + 46, { color: car.wingLost ? (blink ? 0xff5040 : 0xffd040) : car.wing > 40 ? 0xffa060 : car.wing > 3 ? 0xffe080 : 0x7ae06a, align: 'r' });
  }
  tower(ctx, vw, vh, t, me) {
    const R = this.R, order = R.order || R.cars;
    const rows = Math.max(6, Math.min(order.length, Math.floor((vh - 110) / 8)));
    const mi = order.indexOf(me);
    let from = 0;
    if (rows < order.length && mi >= rows - 2) from = Math.min(order.length - rows, mi - Math.floor(rows / 2));
    const lead = order[0], y0 = 26, x0 = 4, W = 78;
    ctx.fillStyle = 'rgba(14,10,26,0.72)'; ctx.fillRect(x0, y0 - 2, W, rows * 8 + 3);
    for (let r = 0; r < rows && from + r < order.length; r++) {
      const c = order[from + r], k = from + r, y = y0 + r * 8;
      if (c === me) { ctx.fillStyle = 'rgba(200,38,46,0.85)'; ctx.fillRect(x0, y - 1, W, 8); }
      drawText(ctx, String(k + 1), x0 + 10, y, { color: 0xffffff, align: 'r', outline: null, shadow: false });
      const team = TEAMS[c.teamIdx] || TEAMS[0];
      ctx.fillStyle = css(team.c1); ctx.fillRect(x0 + 13, y, 2, 6);
      drawText(ctx, c.code || c.name.slice(0, 3).toUpperCase(), x0 + 18, y, { color: 0xffffff, outline: null, shadow: false });
      let gap;
      if (k === 0) gap = c.finished ? 'MÅL' : 'LEDARE';
      else if (c.pitPhase) gap = 'DEPÅ';
      else if (c.finished) gap = '+' + (c.finishTime - lead.finishTime).toFixed(1);
      else { const dl = lead.progress - c.progress; gap = dl > R.T.L ? '+' + Math.floor(dl / R.T.L) + ' V' : '+' + (dl / Math.max(120, (lead.speed + c.speed) / 2 || 200)).toFixed(1); }
      drawText(ctx, gap, x0 + 62, y, { color: c.pitPhase ? 0xffd040 : 0xd8d4e8, align: 'r', outline: null, shadow: false });
      ctx.fillStyle = css(COMPOUNDS[c.tyre.c].color); ctx.fillRect(x0 + 68, y + 1, 5, 5);
      ctx.fillStyle = '#1a1426'; ctx.fillRect(x0 + 69, y + 2, 3, 3);
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
    drawText(ctx, f.energy ? Math.round(car.ammoF / car.maxF * 100) + '%' : String(car.ammoF), x + 60, y + 6, { color: 0xffe080, align: 'r' });
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
    // depåinfarten blinkar när spelaren ska boxa
    const R = this.R;
    if (R.f1 && R.T.pit && me && me.boxing && ((t * 4) | 0) % 2) {
      const i = idxAt(R.T, R.T.pit.s0), px = R.T.X[i], py = R.T.Y[i], pz = R.T.Z[i];
      const sx = Math.round(isoX(px, py) * m.sc + m.ox) + x, sy = Math.round(isoY(px, py, pz) * m.sc + m.oy) + y;
      ctx.fillStyle = '#1a1426'; ctx.fillRect(sx - 3, sy - 3, 7, 7); ctx.fillStyle = '#ffd628'; ctx.fillRect(sx - 2, sy - 2, 5, 5);
    }
    const cars = [...this.R.cars].sort((a) => (a === me ? 1 : -1));
    for (const c of cars) {
      const sx = Math.round(isoX(c.x, c.y) * m.sc + m.ox) + x, sy = Math.round(isoY(c.x, c.y, c.z) * m.sc + m.oy) + y;
      if (c === me) { ctx.fillStyle = '#1a1426'; ctx.fillRect(sx - 2, sy - 2, 5, 5); ctx.fillStyle = ((t * 4) | 0) % 2 ? '#ffffff' : css(c.color); ctx.fillRect(sx - 1, sy - 1, 3, 3); }
      else { ctx.fillStyle = '#1a1426'; ctx.fillRect(sx - 1, sy - 1, 4, 4); ctx.fillStyle = css(c.color); ctx.fillRect(sx - 1, sy - 1, 3, 3); }
    }
  }
}
