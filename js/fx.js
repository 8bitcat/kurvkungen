// Partiklar: rök, eld, gnistor, damm, vattenstänk, skrotbitar och nitrolåga.
// Färgerna stegar genom en palett i stället för att tona ut med alfa (Snabbfilens recept).
import { isoX, isoY } from './iso.js?v=1';
import { css, mul, mix } from './pix.js?v=1';

const PAL = {
  smoke: [0xe8e4ec, 0xc4c0cc, 0x9c98a8, 0x76728a, 0x5a566c],
  dark: [0x6a6670, 0x4c4854, 0x34303c, 0x26222e],
  fire: [0xfffbe0, 0xffe070, 0xffa830, 0xf0602a, 0xb83424, 0x5a4048, 0x3a3440],
  spark: [0xffffff, 0xfff0a0, 0xffc040, 0xf07020],
  splash: [0xffffff, 0xd8e8ff, 0xa8c4ff, 0x6a8ae8],
  flame: [0xffffff, 0xa8e0ff, 0x60a0ff, 0x8a60ff],
  oil: [0x3a3448, 0x26222e, 0x18161e],
  blood: [0xd8202c, 0xb81a24, 0x8a121a, 0x6a0e14],
  leaf: [0x6ab83a, 0x4a9a2e, 0x3a7a26, 0x2a5a1e],
};
const CSS = {};
for (const k in PAL) CSS[k] = PAL[k].map(css);

export class FX {
  constructor() { this.p = []; this.rings = []; }
  add(kind, x, y, z, vx, vy, vz, life, size = 1, grav = 0, drag = 1.5, col = null) {
    if (this.p.length > 1400) this.p.shift();
    this.p.push({ kind, x, y, z, vx, vy, vz, life, t: 0, size, grav, drag, col, gz: grav > 0 ? z - (kind === 'dust' ? 0 : 4) : -1e9 });
  }
  ring(x, y, z, r, life = 0.3) { this.rings.push({ x, y, z, r, life, t: 0 }); }
  smoke(x, y, z, n = 1, dark = false, spread = 3) {
    for (let i = 0; i < n; i++) this.add(dark ? 'dark' : 'smoke', x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 14 + Math.random() * 14, 0.8 + Math.random() * 0.8, Math.random() < 0.4 ? 3 : 2, -6, 1.2);
  }
  dust(x, y, z, col, n = 1) {
    for (let i = 0; i < n; i++) this.add('dust', x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, z, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, 8 + Math.random() * 10, 0.45 + Math.random() * 0.4, 2, 10, 2.5, col);
  }
  sparks(x, y, z, n = 6, sp = 140) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283; this.add('spark', x, y, z, Math.cos(a) * sp * Math.random(), Math.sin(a) * sp * Math.random(), 30 + Math.random() * 80, 0.2 + Math.random() * 0.3, 1, 380, 1); }
  }
  splash(x, y, z, n = 30) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = Math.random() * 60; this.add('splash', x, y, z, Math.cos(a) * s, Math.sin(a) * s, 60 + Math.random() * 110, 0.5 + Math.random() * 0.5, Math.random() < 0.3 ? 2 : 1, 420, 0.5); }
    this.ring(x, y, z, 18, 0.5);
  }
  explosion(x, y, z, color, big = 1) {
    for (let i = 0; i < 46 * big; i++) { const a = Math.random() * 6.283, s = Math.random() * 90 * big; this.add('fire', x, y, z + 3, Math.cos(a) * s, Math.sin(a) * s, 20 + Math.random() * 70, 0.4 + Math.random() * 0.7, Math.random() < 0.5 ? 3 : 2, -20, 3); }
    for (let i = 0; i < 18 * big; i++) this.smoke(x, y, z + 6, 1, true, 14);
    for (let i = 0; i < 12 * big; i++) { const a = Math.random() * 6.283, s = 60 + Math.random() * 120; this.add('debris', x, y, z + 4, Math.cos(a) * s, Math.sin(a) * s, 80 + Math.random() * 120, 0.9 + Math.random() * 0.6, 2, 420, 0.4, Math.random() < 0.5 ? color : 0x2a2830); }
    this.sparks(x, y, z + 4, 14, 200);
    this.ring(x, y, z, 26 * big, 0.28);
  }
  update(dt) {
    const p = this.p;
    let w = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      a.t += dt;
      if (a.t >= a.life) continue;
      const k = Math.exp(-a.drag * dt);
      a.vx *= k; a.vy *= k;
      a.vz -= a.grav * dt;
      a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
      if (a.z < a.gz) { a.z = a.gz; a.vz = -a.vz * 0.3; a.vx *= 0.6; a.vy *= 0.6; }
      p[w++] = a;
    }
    p.length = w;
    this.rings = this.rings.filter((r) => (r.t += dt) < r.life);
  }
  draw(ctx, x0, y0) {
    for (const r of this.rings) {
      const sx = Math.round(isoX(r.x, r.y) - x0), sy = Math.round(isoY(r.x, r.y, r.z) - y0);
      const rr = r.r * (0.3 + r.t / r.life), f = r.t / r.life;
      ctx.fillStyle = f < 0.4 ? '#fff6d0' : f < 0.7 ? '#ffc060' : '#c8c0d0';
      const n = Math.max(12, rr * 3 | 0);
      for (let k = 0; k < n; k++) { const a = k / n * 6.283; ctx.fillRect(Math.round(sx + Math.cos(a) * rr), Math.round(sy + Math.sin(a) * rr * 0.5), 1, 1); }
    }
    for (const a of this.p) {
      const sx = Math.round(isoX(a.x, a.y) - x0), sy = Math.round(isoY(a.x, a.y, a.z) - y0);
      const f = a.t / a.life;
      if (a.kind === 'debris' || a.kind === 'dust') {
        ctx.fillStyle = a.kind === 'dust' ? css(f < 0.5 ? a.col : mix(a.col, 0xc8c0b0, 0.5)) : css(f > 0.7 ? mul(a.col, 0.6) : a.col);
        if (a.kind === 'dust' && f > 0.75 && ((sx + sy) & 1)) continue;
      } else {
        const pal = CSS[a.kind];
        ctx.fillStyle = pal[Math.min(pal.length - 1, (f * pal.length) | 0)];
        if (f > 0.85 && ((sx + sy) & 1)) continue;
      }
      const s = a.kind === 'smoke' || a.kind === 'dark' ? Math.round(a.size * (0.7 + f * 0.9)) : a.size;
      ctx.fillRect(sx - (s >> 1), sy - (s >> 1), s, s);
    }
  }
}
