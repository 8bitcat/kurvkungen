// Menyer ritade i spelpixlar: lista med val, vänster/höger-värden, klick/tryck och tangentbord.
import { drawText, GRAD, panel, tw } from './text.js?v=1';
import { sfx } from './audio.js?v=1';
import { input } from './input.js?v=1';

export class Menu {
  constructor(title, items, opt = {}) {
    this.title = title; this.items = items; this.sel = 0; this.opt = opt; this.hits = [];
    this.fix();
  }
  fix() { let n = 0; while (this.items[this.sel] && this.items[this.sel].dis && this.items[this.sel].dis() && n++ < this.items.length) this.sel = (this.sel + 1) % this.items.length; }
  move(d) {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const j = (this.sel + d * k + n * 4) % n;
      const it = this.items[j];
      if (!(it.dis && it.dis()) && !it.sep) { this.sel = j; sfx('menu'); return; }
    }
  }
  action(a) {
    const it = this.items[this.sel];
    if (a === 'up') this.move(-1);
    else if (a === 'down') this.move(1);
    else if (a === 'left' && it && it.left) { it.left(); sfx('menu'); }
    else if (a === 'right' && it && it.right) { it.right(); sfx('menu'); }
    else if (a === 'ok' && it && it.ok) { if (it.dis && it.dis()) { sfx('deny'); return; } it.ok(); }
    else if (a === 'back' && this.opt.back) { sfx('back'); this.opt.back(); }
    else if (a && a.tap) {
      const [x, y] = a.tap;
      for (const h of this.hits) {
        if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) {
          const it2 = this.items[h.i];
          if (it2.dis && it2.dis()) { sfx('deny'); return; }
          if (h.kind === 'l' && it2.left) { this.sel = h.i; it2.left(); sfx('menu'); return; }
          if (h.kind === 'r' && it2.right) { this.sel = h.i; it2.right(); sfx('menu'); return; }
          if (this.sel !== h.i && !this.opt.oneTap && !input.touch) { this.sel = h.i; sfx('menu'); if (!it2.ok) return; }
          this.sel = h.i;
          if (it2.ok) it2.ok(); else if (it2.right) { it2.right(); sfx('menu'); }
          return;
        }
      }
      if (this.opt.back && this.opt.tapOutsideBack) this.opt.back();
    }
  }
  draw(ctx, vw, vh, t, x = null, y = null, w = null) {
    const o = this.opt;
    const W = w || o.w || 200;
    const rowH = o.rowH || 15;
    const visible = this.items.length;
    const H = visible * rowH + (this.title ? 26 : 8) + 6;
    const X = x ?? Math.round(vw / 2 - W / 2), Y = y ?? Math.round(Math.max(8, vh / 2 - H / 2 + (o.dy || 0)));
    panel(ctx, X, Y, W, H);
    if (this.title) {
      drawText(ctx, this.title, X + W / 2, Y + 6, { big: true, scale: 1, grad: GRAD.gold, align: 'c' });
      ctx.fillStyle = 'rgba(242,194,28,0.5)'; ctx.fillRect(X + 6, Y + 17, W - 12, 1);
    }
    this.hits = [];
    let yy = Y + (this.title ? 24 : 6);
    this.items.forEach((it, i) => {
      if (it.sep) { yy += rowH; return; }
      const dis = it.dis && it.dis();
      const on = i === this.sel;
      if (on) {
        ctx.fillStyle = 'rgba(200,38,46,0.85)'; ctx.fillRect(X + 3, yy, W - 6, rowH - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(X + 3, yy, W - 6, 1);
        if (((t * 3) | 0) % 2 === 0) drawText(ctx, '>', X + 5, yy + 4, { color: 0xfff2a0 });
      }
      const col = dis ? 0x7a7488 : on ? 0xffffff : 0xd8d4e8;
      drawText(ctx, it.label, X + 12, yy + 4, { color: col });
      if (it.value) {
        const v = String(it.value());
        const hasLR = it.left || it.right;
        const rx = X + W - 8;
        if (hasLR) {
          drawText(ctx, '<', rx - tw(v) - 14, yy + 4, { color: on ? 0xfff2a0 : 0x9a94b0 });
          drawText(ctx, '>', rx, yy + 4, { color: on ? 0xfff2a0 : 0x9a94b0, align: 'r' });
          drawText(ctx, v, rx - 6, yy + 4, { color: it.vcol ? it.vcol() : on ? 0xffe080 : 0xc8c0a0, align: 'r' });
          this.hits.push({ x: X + W / 2, y: yy - 1, w: W / 4, h: rowH, i, kind: 'l' }, { x: X + W * 3 / 4, y: yy - 1, w: W / 4, h: rowH, i, kind: 'r' });
        } else drawText(ctx, v, rx, yy + 4, { color: it.vcol ? it.vcol() : on ? 0xffe080 : 0xc8c0a0, align: 'r' });
      }
      if (it.pips) {
        const p = it.pips();
        if (p) {
          const [l, m] = p, px0 = X + Math.round(W * 0.42);
          for (let k = 0; k < m; k++) {
            ctx.fillStyle = '#1a1426'; ctx.fillRect(px0 + k * 8, yy + 2, 7, 8);
            ctx.fillStyle = k < l ? '#f2c21c' : '#3a3450'; ctx.fillRect(px0 + k * 8 + 1, yy + 3, 5, 6);
            if (k < l) { ctx.fillStyle = '#fff2a0'; ctx.fillRect(px0 + k * 8 + 1, yy + 3, 5, 1); }
          }
        }
      }
      this.hits.push({ x: X, y: yy - 1, w: W, h: rowH, i, kind: 'row' });
      yy += rowH;
    });
    const it = this.items[this.sel];
    if (it && it.info) {
      const info = it.info();
      if (info) {
        const lines = Array.isArray(info) ? info : [info];
        const iw = Math.max(...lines.map((l) => tw(l))) + 12;
        panel(ctx, Math.round(vw / 2 - iw / 2), Y + H + 4, iw, lines.length * 8 + 6, 'rgba(20,16,40,0.85)', '#6a6488');
        lines.forEach((l, k) => drawText(ctx, l, vw / 2, Y + H + 8 + k * 8, { color: 0xd8d4e8, align: 'c' }));
      }
    }
    return { X, Y, W, H };
  }
}

export const CUPS = [
  { id: 'brons', name: 'BRONSCUPEN', tracks: ['sjoviken', 'kanjonen', 'fjallet'], skill: [0.15, 0.45], laps: 3, prize: 1, models: ['pirat', 'komet', 'pirat'], upg: 0, unlock: null },
  { id: 'silver', name: 'SILVERCUPEN', tracks: ['kanjonen_r', 'sjoviken_r', 'fjallet_r', 'sjoviken'], skill: [0.4, 0.7], laps: 3, prize: 1.7, models: ['komet', 'buffel', 'muskel'], upg: 1, unlock: 'brons' },
  { id: 'guld', name: 'GULDCUPEN', tracks: ['fjallet', 'kanjonen', 'sjoviken_r', 'fjallet_r', 'kanjonen_r'], skill: [0.65, 0.95], laps: 4, prize: 2.6, models: ['muskel', 'raket', 'komet'], upg: 3, unlock: 'silver' },
];
export const PRIZES = [1000, 700, 500, 350, 250, 150];
export const POINTS = [10, 7, 5, 3, 2, 1];
