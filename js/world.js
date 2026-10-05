// Världen i huvudtråden: tar emot höjdkarta och rutor från arbetaren, svarar på markfrågor,
// placerar rekvisita (träd, koner, däck, räcken, portal, läktare) och ritar terrängen.
import { TRACKS, THEMES } from './tracks.js?v=1';
import { buildTrack, nearest } from './trackgeo.js?v=1';
import { TS, isoX, isoY } from './iso.js?v=1';
import { MAT, DECK } from './world-gen.js?v=1';
import { treeSprite, TREE_RADIUS, railSprite, gantrySprite, standSprite, CONE, TIRES } from './props.js?v=1';
import { css } from './pix.js?v=1';

let worker = null, genCounter = 0, current = null;
function onMsg(e) {
  const m = e.data, w = current;
  if (!w || m.gen !== w.gen) return;
  if (m.type === 'gen') w._onGen(m); else if (m.type === 'tile') w._onTile(m);
}

export class World {
  constructor(id) {
    this.id = id; this.def = TRACKS[id]; this.th = THEMES[this.def.theme];
    this.T = buildTrack(this.def);
    this.tiles = new Map(); this.tctx = new Map();
    this.q = {}; this.ready = false; this.lastReq = ''; this.lastReqT = 0;
    this.props = []; this.grid = new Map(); this.painted = 0;
  }
  load() {
    return new Promise((resolve, reject) => {
      if (!worker) {
        worker = new Worker(new URL('./world-worker.js?v=1', import.meta.url), { type: 'module' });
        worker.onmessage = onMsg;
      }
      worker.onerror = (e) => reject(e);
      this.gen = ++genCounter; current = this;
      this._resolve = resolve;
      worker.postMessage({ type: 'gen', id: this.id, gen: this.gen });
    });
  }
  _onGen(m) {
    Object.assign(this, { W: m.W, H: m.H, Hm: m.Hm, mat: m.mat, ZTOP: m.ZTOP, ZBOT: m.ZBOT, OX: m.OX, OY: m.OY, CW: m.CW, CH: m.CH });
    this.T.flags = m.flags;
    this.ntx = Math.ceil(this.CW / TS); this.nty = Math.ceil(this.CH / TS);
    this.total = this.ntx * this.nty;
    this._buildProps(m.objects);
    this.ready = true;
    const T = this.T;
    this.request(isoX(T.X[0], T.Y[0]), isoY(T.X[0], T.Y[0], T.Z[0]), true);
    this._resolve(this);
  }
  _onTile(m) {
    const cv = document.createElement('canvas');
    cv.width = TS; cv.height = TS;
    const ctx = cv.getContext('2d');
    ctx.putImageData(new ImageData(m.px, TS, TS), 0, 0);
    const key = m.ty * 1000 + m.tx;
    this.tiles.set(key, cv); this.tctx.set(key, ctx);
    this.painted = this.tiles.size;
  }
  // Be arbetaren måla rutor närmast (sx, sy) först.
  request(sx, sy, force = false) {
    if (!this.ready) return;
    const tx = Math.floor((sx + this.OX) / TS), ty = Math.floor((sy + this.OY) / TS);
    const key = tx + ',' + ty, now = performance.now();
    if (!force && key === this.lastReq && now - this.lastReqT < 1500) return;
    this.lastReq = key; this.lastReqT = now;
    const list = [];
    for (let j = 0; j < this.nty; j++) for (let i = 0; i < this.ntx; i++) if (!this.tiles.has(j * 1000 + i)) list.push([i, j, (i - tx) ** 2 + ((j - ty) * 1.6) ** 2]);
    list.sort((a, b) => a[2] - b[2]);
    worker.postMessage({ type: 'queue', gen: this.gen, list: list.map((a) => [a[0], a[1]]) });
  }
  tilesReadyAround(sx, sy, vw, vh) {
    const x0 = Math.floor((sx - vw / 2 + this.OX) / TS), x1 = Math.floor((sx + vw / 2 + this.OX) / TS);
    const y0 = Math.floor((sy - vh / 2 + this.OY) / TS), y1 = Math.floor((sy + vh / 2 + this.OY) / TS);
    let need = 0, have = 0;
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { if (i < 0 || j < 0 || i >= this.ntx || j >= this.nty) continue; need++; if (this.tiles.has(j * 1000 + i)) have++; }
    return need ? have / need : 1;
  }

  // ---------- markfrågor ----------
  // Höjd att stå på vid (x, y): brodäck om det finns, annars terräng. Sätter this.gw (vatten) och this.gm (material).
  groundAt(x, y, hint = 0) {
    let ix = x | 0, iy = y | 0;
    if (ix < 0) ix = 0; else if (ix >= this.W) ix = this.W - 1;
    if (iy < 0) iy = 0; else if (iy >= this.H) iy = this.H - 1;
    const ci = iy * this.W + ix, m = this.mat[ci];
    let h = this.Hm[ci];
    this.gm = m & 15; this.gw = false; this.gdeck = false;
    if (m & DECK) {
      const q = nearest(this.T, x, y, hint, 30, this.q);
      if (q.dist < q.hw + 5.2 && (this.T.flags[q.i] & 1) && q.z > h) { this.gdeck = true; return q.z; }
    }
    if (this.gm === MAT.WATER) { this.gw = !this.th.ice; if (this.th.ice) return 0; }
    return h;
  }

  // ---------- rekvisita ----------
  _addProp(p) {
    this.props.push(p);
    const key = ((p.x >> 6) & 0xffff) * 65536 + ((p.y >> 6) & 0xffff);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key).push(p);
    p.depth = p.x + p.y + (p.dbias || 0);
  }
  propsNear(x, y, r, out) {
    out.length = 0;
    const x0 = (x - r) >> 6, x1 = (x + r) >> 6, y0 = (y - r) >> 6, y1 = (y + r) >> 6;
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const a = this.grid.get(((gx & 0xffff) * 65536) + (gy & 0xffff));
      if (a) for (const p of a) out.push(p);
    }
    return out;
  }
  _buildProps(objects) {
    const th = this.th, T = this.T;
    for (const o of objects) this._addProp({ x: o.x, y: o.y, z: o.z, spr: treeSprite(o.k, o.v, th), r: TREE_RADIUS[o.k] || 0, kind: o.k });
    const n = T.n;
    // koner på kurvornas insida, däckväggar på utsidan
    let last = -100;
    for (let i = 0; i < n; i++) {
      const K = T.K[i], aK = Math.abs(K);
      if (T.flags[i] & 1) continue;
      if (aK > 0.0062 && i - last >= 14) {
        last = i;
        const d = -Math.sign(K) * (T.HW[i] + 2.5);
        const x = T.X[i] + T.NX[i] * d, y = T.Y[i] + T.NY[i] * d;
        this._addProp({ x, y, x0: x, y0: y, z: T.Z[i], spr: CONE, r: 2.2, kind: 'kon', dyn: true, vx: 0, vy: 0, down: false });
      }
    }
    for (let i = 0; i < n; i += 5) {
      const K = T.KS[i];
      if (Math.abs(K) < 0.0058 || (T.flags[i] & 7)) continue;
      const d = Math.sign(K) * (T.HW[i] + 15);
      const x = T.X[i] + T.NX[i] * d, y = T.Y[i] + T.NY[i] * d;
      const g = this.groundAt(x, y, i);
      if (Math.abs(g - T.Z[i]) > 3 || this.gm === MAT.WATER) continue;
      this._addProp({ x, y, z: g, spr: TIRES, r: 5, kind: 'dack' });
    }
    // räcken
    for (const [bit, side] of [[2, 1], [4, -1]]) {
      for (let i = 0; i < n; i += 4) {
        if (!(T.flags[i] & bit)) continue;
        const j = (i + 4) % n;
        const da = side * (T.HW[i] + 4.6), db = side * (T.HW[j] + 4.6);
        const ax = T.X[i] + T.NX[i] * da, ay = T.Y[i] + T.NY[i] * da, bx = T.X[j] + T.NX[j] * db, by = T.Y[j] + T.NY[j] * db;
        const spr = railSprite(ax, ay, T.Z[i], bx, by, T.Z[j], 0x8fb4c8);
        this._addProp({ x: (ax + bx) / 2, y: (ay + by) / 2, z: (T.Z[i] + T.Z[j]) / 2, spr, r: 0, kind: 'racke' });
      }
    }
    // startportal och läktare
    const hw = T.HW[0];
    const lx = T.X[0] + T.NX[0] * (hw + 6), ly = T.Y[0] + T.NY[0] * (hw + 6), rx = T.X[0] - T.NX[0] * (hw + 6), ry = T.Y[0] - T.NY[0] * (hw + 6);
    this._addProp({ x: T.X[0], y: T.Y[0], z: T.Z[0], spr: gantrySprite(lx, ly, rx, ry, T.Z[0], 'KURVKUNGEN  START  MÅL'), r: 0, kind: 'portal' });
    this._addProp({ x: lx, y: ly, z: T.Z[0], spr: null, r: 2.5, kind: 'stolpe' });
    this._addProp({ x: rx, y: ry, z: T.Z[0], spr: null, r: 2.5, kind: 'stolpe' });
    const far = T.NX[0] + T.NY[0] < 0 ? 1 : -1; // vänster (+d) ligger bortåt?
    const si = Math.round(70 / T.sp);
    const sx = T.X[si] + T.NX[si] * far * (hw + 22), sy = T.Y[si] + T.NY[si] * far * (hw + 22);
    const g = this.groundAt(sx, sy, si);
    if (Math.abs(g - T.Z[si]) < 4) {
      this._addProp({ x: sx, y: sy, z: g, spr: standSprite(T.A[si], 70, -far), r: 0, kind: 'laktare', dbias: -8 });
      for (let k = -3; k <= 3; k++) {
        const j = (si + k * 5 + n) % n;
        this._addProp({ x: T.X[j] + T.NX[j] * far * (hw + 24), y: T.Y[j] + T.NY[j] * far * (hw + 24), z: g, spr: null, r: 9, kind: 'mur' });
      }
    }
  }

  // Ställ upp kullkörda koner igen
  resetDynamic() {
    for (const p of this.props) if (p.dyn) { p.x = p.x0; p.y = p.y0; p.down = false; p.spr = CONE; p.r = 2.2; p.vx = p.vy = p.vz = 0; p.zz = 0; p.depth = p.x + p.y; }
  }

  // ---------- ritning ----------
  drawTerrain(ctx, x0, y0, vw, vh) {
    const cx0 = x0 + this.OX, cy0 = y0 + this.OY;
    ctx.fillStyle = css(this.th.grass);
    for (let ty = Math.floor(cy0 / TS); ty <= Math.floor((cy0 + vh) / TS); ty++) {
      for (let tx = Math.floor(cx0 / TS); tx <= Math.floor((cx0 + vw) / TS); tx++) {
        const t = this.tiles.get(ty * 1000 + tx);
        if (t) ctx.drawImage(t, tx * TS - cx0, ty * TS - cy0);
        else if (tx >= 0 && ty >= 0 && tx < this.ntx && ty < this.nty) ctx.fillRect(tx * TS - cx0, ty * TS - cy0, TS, TS);
      }
    }
  }
  // Däckspår och brännmärken målas in i terrängrutorna för gott.
  mark(x, y, z, color, a = 1, size = 1) {
    const cx = Math.round(isoX(x, y) + this.OX), cy = Math.round(isoY(x, y, z) + this.OY);
    const key = Math.floor(cy / TS) * 1000 + Math.floor(cx / TS);
    const ctx = this.tctx.get(key);
    if (!ctx) return;
    ctx.globalAlpha = a; ctx.fillStyle = color;
    ctx.fillRect(cx - Math.floor(cx / TS) * TS, cy - Math.floor(cy / TS) * TS, size, size);
    ctx.globalAlpha = 1;
  }
  // Rekvisita som syns i vyn (iso-rektangel x0,y0,vw,vh) läggs i out.
  visibleProps(x0, y0, vw, vh, out) {
    const pts = [];
    for (const sx of [x0 - 40, x0 + vw + 40]) for (const sy of [y0 - 10, y0 + vh + 60]) for (const z of [this.ZBOT, this.ZTOP]) { const s = sy + z; pts.push([s + sx / 2, s - sx / 2]); }
    let ax = 1e9, ay = 1e9, bx = -1e9, by = -1e9;
    for (const [x, y] of pts) { ax = Math.min(ax, x); ay = Math.min(ay, y); bx = Math.max(bx, x); by = Math.max(by, y); }
    for (let gx = Math.max(0, ax >> 6); gx <= (bx >> 6); gx++) for (let gy = Math.max(0, ay >> 6); gy <= (by >> 6); gy++) {
      const a = this.grid.get(gx * 65536 + gy);
      if (!a) continue;
      for (const p of a) {
        if (!p.spr && !p.down) continue;
        const sx = isoX(p.x, p.y) - x0, sy = isoY(p.x, p.y, p.z) - y0;
        if (sx < -60 || sx > vw + 60 || sy < -10 || sy > vh + 70) continue;
        out.push(p);
      }
    }
    return out;
  }
}
