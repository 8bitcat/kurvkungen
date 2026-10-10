// Nätverk med PeerJS (laddas först när man går in i "Spela online").
// Värden kör hela loppet; gästerna skickar sina kommandon och får tillståndet ~20 ggr/s.
let PeerCls = null;
export async function loadPeer() {
  if (PeerCls) return PeerCls;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res; s.onerror = () => rej(new Error('kunde inte ladda PeerJS'));
    document.head.appendChild(s);
  });
  PeerCls = window.Peer;
  return PeerCls;
}
const PREFIX = 'kurvkungen-v2-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const randomCode = () => Array.from({ length: 4 }, () => LETTERS[(Math.random() * LETTERS.length) | 0]).join('');
const peerOpts = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };

export class Host {
  constructor() { this.conns = new Map(); this.onMsg = () => {}; this.onJoin = () => {}; this.onLeave = () => {}; this.peer = null; this.code = ''; this.nextId = 1; }
  async open() {
    const Peer = await loadPeer();
    for (let tries = 0; tries < 6; tries++) {
      const code = randomCode();
      try {
        this.peer = await new Promise((res, rej) => {
          const p = new Peer(PREFIX + code, peerOpts);
          const to = setTimeout(() => { p.destroy(); rej(new Error('tidsgräns')); }, 9000);
          p.on('open', () => { clearTimeout(to); res(p); });
          p.on('error', (e) => { clearTimeout(to); p.destroy(); rej(e); });
        });
        this.code = code;
        break;
      } catch (e) { if (!(e && e.type === 'unavailable-id') && tries > 1) throw e; }
    }
    if (!this.peer) throw new Error('kunde inte skapa rum');
    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        const id = this.nextId++;
        conn.pid = id;
        this.conns.set(id, conn);
        this.onJoin(id, conn);
      });
      conn.on('data', (d) => this.onMsg(conn.pid, d));
      conn.on('close', () => { if (this.conns.has(conn.pid)) { this.conns.delete(conn.pid); this.onLeave(conn.pid); } });
      conn.on('error', () => {});
    });
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch { /* */ } });
    return this.code;
  }
  send(id, msg) { const c = this.conns.get(id); if (c && c.open) c.send(msg); }
  broadcast(msg) { for (const c of this.conns.values()) if (c.open) c.send(msg); }
  close() { try { this.peer && this.peer.destroy(); } catch { /* */ } this.conns.clear(); }
}

export class Client {
  constructor() { this.onMsg = () => {}; this.onClose = () => {}; this.peer = null; this.conn = null; }
  async join(code) {
    const Peer = await loadPeer();
    this.peer = await new Promise((res, rej) => {
      const p = new Peer(peerOpts);
      const to = setTimeout(() => { p.destroy(); rej(new Error('tidsgräns')); }, 9000);
      p.on('open', () => { clearTimeout(to); res(p); });
      p.on('error', (e) => { clearTimeout(to); rej(e); });
    });
    this.conn = await new Promise((res, rej) => {
      const c = this.peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
      const to = setTimeout(() => rej(new Error('hittade inget rum med koden ' + code)), 10000);
      c.on('open', () => { clearTimeout(to); res(c); });
      c.on('error', (e) => { clearTimeout(to); rej(e); });
      this.peer.on('error', (e) => { clearTimeout(to); rej(new Error(e.type === 'peer-unavailable' ? 'hittade inget rum med koden ' + code : String(e.type || e))); });
    });
    this.conn.on('data', (d) => this.onMsg(d));
    this.conn.on('close', () => this.onClose());
    return true;
  }
  send(msg) { if (this.conn && this.conn.open) this.conn.send(msg); }
  close() { try { this.peer && this.peer.destroy(); } catch { /* */ } }
}

// ---------- tillståndsbilder ----------
const r1 = (v) => Math.round(v * 10) / 10;
export const PIT_PH = [null, 'in', 'stop', 'out'];
const CO = ['soft', 'medium', 'hard'];
// Grand Prix: däck, depå, DRS, skador och mållinjetid per bil
function f1Snap(R) {
  return R.cars.map((c) => [
    CO.indexOf(c.tyre.c), Math.round(c.tyre.wear), PIT_PH.indexOf(c.pitPhase || null),
    (c.boxing ? 1 : 0) | (c.drs ? 2 : 0) | (c.drsOk ? 4 : 0) | (c.wingLost ? 8 : 0) | (c.punct > 0 ? 16 : c.punct < 0 ? 32 : 0) | (c.penalty ? 64 : 0),
    c.stops, Math.round(c.wing), CO.indexOf(c.nextTyre), r1(c.pitT || 0), CO.reduce((m, k, i) => m | (c.used.has(k) ? 1 << i : 0), 0), Math.round((c.tow || 0) * 10), r1(c.finishTime || 0),
  ]);
}
export const ANIM_STATES = ['walk', 'idle', 'flee', 'fly', 'dead', 'flat', 'gone'];
export function snapshot(R) {
  const cars = R.cars.map((c) => [
    r1(c.x), r1(c.y), r1(c.z), Math.round(c.ang * 1000) / 1000, r1(c.vx), r1(c.vy), Math.round(c.dmg),
    (c.air ? 1 : 0) | (c.wreckT > 0 ? 2 : 0) | (c.sinkT > 0 ? 4 : 0) | (c.inv > 0 ? 8 : 0) | (c.nitroT > 0 ? 16 : 0) | (c.burnT > 0 ? 32 : 0) | (c.empT > 0 ? 64 : 0) | (c.hitFlash > 0 ? 128 : 0) | (c.smokeT > 0 ? 256 : 0) | (c.slip > 42 || c.tackleT > 0.1 ? 512 : 0) | (c.wrongT > 1.2 ? 1024 : 0) | (c.finished ? 2048 : 0) | (c.inp.gas > 0 ? 4096 : 0),
    c.lap, c.place, Math.round(c.progress), r1(c.ammoF), c.ammoR, c.nitro, c.money, r1(c.bestLap || 0), c.surf === 'road' || c.surf === 'shoulder' ? 0 : 1, Math.round(c.slip),
  ]);
  return {
    t: 's', time: r1(R.raceTime), rt: R.time, ph: R.phase, cd: r1(R.countdown), cars,
    bu: R.bullets.map((b) => [r1(b.x), r1(b.y), r1(b.z), Math.round(b.vx), Math.round(b.vy)]),
    mi: R.missiles.map((m) => [r1(m.x), r1(m.y), r1(m.z), Math.round(m.ang * 100) / 100]),
    sh: R.shells.map((s) => [r1(s.x), r1(s.y), r1(s.z)]),
    mn: R.mines.map((m) => [r1(m.x), r1(m.y), r1(m.z), m.arm > 0 ? 1 : 0]),
    oi: R.oils.map((o) => [r1(o.x), r1(o.y), r1(o.z), r1(o.t), o.r, o.seed || 0]),
    gl: R.glues.map((o) => [r1(o.x), r1(o.y), r1(o.z), r1(o.t), o.r, o.seed || 0]),
    sp: R.spikes.map((s) => [r1(s.x), r1(s.y), r1(s.z), Math.round(s.ang * 100) / 100, s.len]),
    ba: R.barrels.map((b) => [r1(b.x), r1(b.y), r1(b.z)]),
    be: R.beams.map((b) => [r1(b.x0), r1(b.y0), r1(b.x1), r1(b.y1), r1(b.z), b.hit ? 1 : 0]),
    bo: R.bolts.map((b) => [r1(b.x0), r1(b.y0), r1(b.z0), r1(b.x1), r1(b.y1), r1(b.z1), Math.round(b.seed)]),
    an: R.animals.list.filter((a) => a.state !== 'gone').map((a) => [a.type, r1(a.x), r1(a.y), r1(a.z), Math.round(a.ang * 100) / 100, ANIM_STATES.indexOf(a.state), r1(a.frameT), (a.burnt ? 1 : 0) | (a.flyAway ? 2 : 0) | (a.idle > 0 ? 4 : 0)]),
    pk: R.picks.map((p) => (p.respawn > 0 ? 1 : 0)).join(''),
    f1: R.f1 ? f1Snap(R) : null, li: R.lights || 0,
    pw: R.f1 ? R.cars.map((c, k) => (c.pitPhase === 'stop' && c.pitWork ? [k, c.pitWork.map(([n, s]) => [n, r1(s)])] : null)).filter(Boolean) : null,
  };
}
