// Ljud med WebAudio: surrande chipmotor med växlar, däckskrik, effekter och chiptune-musik.
let ac = null, master, sfxBus, musicBus, noiseBuf = null;
export const audio = { music: true, sfx: true, ready: false };

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = audio.sfx ? 0.55 : 0; sfxBus.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = audio.music ? 0.2 : 0; musicBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  audio.ready = true;
  if (pendingSong) startMusic(pendingSong);
  document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });
}
export function setMusic(on) { audio.music = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.2 : 0, ac.currentTime, 0.05); }
export function setSfx(on) { audio.sfx = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, ac.currentTime, 0.05); }

function noise(t, dur, { f = 2000, q = 1, type = 'bandpass', g = 0.4, f2 = null, bus = sfxBus } = {}) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const gn = ac.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(fl); fl.connect(gn); gn.connect(bus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(t, dur, f, { type = 'square', g = 0.2, f2 = null, bus = sfxBus, attack = 0.005 } = {}) {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(g, t + attack); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gn); gn.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}

const last = {};
export function sfx(name, vol = 1) {
  if (!ac || !audio.sfx) return;
  const t = ac.currentTime;
  if (last[name] && t - last[name] < 0.03) return;
  last[name] = t;
  const v = vol;
  switch (name) {
    case 'count': tone(t, 0.22, 523, { g: 0.22 * v }); break;
    case 'go': tone(t, 0.55, 1046, { g: 0.24 * v }); tone(t, 0.55, 523, { g: 0.14 * v }); break;
    case 'gun': noise(t, 0.05, { f: 2400, q: 0.8, g: 0.3 * v }); tone(t, 0.04, 220, { g: 0.08 * v, f2: 90 }); break;
    case 'missile': noise(t, 0.5, { f: 600, f2: 3000, q: 2, g: 0.35 * v }); break;
    case 'boom': noise(t, 0.8, { f: 900, f2: 80, type: 'lowpass', q: 0.7, g: 0.9 * v }); tone(t, 0.4, 90, { type: 'sine', g: 0.6 * v, f2: 35 }); break;
    case 'crash': noise(t, 0.2, { f: 1400, f2: 300, q: 0.9, g: 0.55 * v }); tone(t, 0.16, 120, { type: 'triangle', g: 0.35 * v, f2: 50 }); break;
    case 'bump': noise(t, 0.12, { f: 700, f2: 200, q: 1, g: 0.35 * v }); break;
    case 'scrape': noise(t, 0.12, { f: 3200, q: 3, g: 0.18 * v }); break;
    case 'pick': [784, 988, 1319].forEach((f, k) => tone(t + k * 0.05, 0.09, f, { g: 0.13 * v })); break;
    case 'cash': tone(t, 0.07, 988, { g: 0.13 * v }); tone(t + 0.07, 0.25, 1319, { g: 0.13 * v }); break;
    case 'repair': tone(t, 0.3, 300, { g: 0.14 * v, f2: 1200 }); break;
    case 'nitro': noise(t, 1.2, { f: 400, f2: 2400, q: 1.2, g: 0.4 * v }); tone(t, 1.0, 70, { type: 'sawtooth', g: 0.12 * v, f2: 140 }); break;
    case 'splash': noise(t, 0.9, { f: 3000, f2: 300, type: 'lowpass', q: 0.5, g: 0.7 * v }); break;
    case 'lap': tone(t, 0.12, 659, { g: 0.16 * v }); tone(t + 0.12, 0.2, 988, { g: 0.16 * v }); break;
    case 'final': [659, 784, 988, 1319].forEach((f, k) => tone(t + k * 0.09, 0.14, f, { g: 0.16 * v })); break;
    case 'finish': [523, 659, 784, 1046, 784, 1046].forEach((f, k) => tone(t + k * 0.11, k === 5 ? 0.6 : 0.14, f, { g: 0.18 * v })); break;
    case 'menu': tone(t, 0.05, 880, { g: 0.08 * v }); break;
    case 'ok': tone(t, 0.06, 660, { g: 0.1 * v }); tone(t + 0.06, 0.1, 1320, { g: 0.1 * v }); break;
    case 'back': tone(t, 0.1, 440, { g: 0.1 * v, f2: 220 }); break;
    case 'buy': [523, 784, 1046, 1568].forEach((f, k) => tone(t + k * 0.06, 0.12, f, { g: 0.12 * v })); break;
    case 'deny': tone(t, 0.18, 160, { g: 0.14 * v, type: 'sawtooth' }); break;
    case 'cone': tone(t, 0.07, 340, { type: 'triangle', g: 0.25 * v, f2: 180 }); break;
    case 'drop': tone(t, 0.06, 200, { g: 0.12 * v, f2: 100 }); noise(t, 0.05, { f: 1500, g: 0.12 * v }); break;
    case 'oil': noise(t, 0.4, { f: 800, f2: 2000, q: 4, g: 0.25 * v }); break;
    case 'hit': noise(t, 0.04, { f: 4000, q: 2, g: 0.2 * v }); break;
    case 'land': noise(t, 0.15, { f: 300, type: 'lowpass', g: 0.5 * v }); break;
    case 'cannon': tone(t, 0.45, 90, { type: 'sine', g: 0.8 * v, f2: 30 }); noise(t, 0.5, { f: 1200, f2: 120, type: 'lowpass', g: 0.7 * v }); break;
    case 'laser': tone(t, 0.06, 1300 + Math.random() * 200, { type: 'square', g: 0.06 * v, f2: 900 }); break;
    case 'flame': noise(t, 0.09, { f: 500 + Math.random() * 300, q: 0.8, g: 0.22 * v }); break;
    case 'zap': noise(t, 0.35, { f: 5000, type: 'highpass', g: 0.35 * v }); tone(t, 0.3, 2200, { type: 'square', g: 0.12 * v, f2: 120 }); break;
    case 'spike': tone(t, 0.08, 1800, { type: 'triangle', g: 0.2 * v }); noise(t, 0.3, { f: 2500, f2: 600, q: 2, g: 0.3 * v }); break;
    case 'glue': tone(t, 0.25, 220, { type: 'sine', g: 0.3 * v, f2: 70 }); noise(t, 0.2, { f: 400, type: 'lowpass', g: 0.25 * v }); break;
    case 'splat': noise(t, 0.14, { f: 500, f2: 150, type: 'lowpass', g: 0.6 * v }); tone(t, 0.1, 160, { type: 'sine', g: 0.4 * v, f2: 55 }); break;
    case 'animalhit': tone(t, 0.1, 120, { type: 'sine', g: 0.5 * v, f2: 50 }); tone(t + 0.02, 0.16, 620, { type: 'square', g: 0.08 * v, f2: 380 }); break;
    case 'moose': tone(t, 0.35, 75, { type: 'sine', g: 0.9 * v, f2: 28 }); noise(t, 0.35, { f: 900, f2: 120, type: 'lowpass', g: 0.8 * v }); noise(t + 0.03, 0.2, { f: 1600, q: 0.8, g: 0.4 * v }); break;
    case 'thud': noise(t, 0.12, { f: 260, type: 'lowpass', g: 0.5 * v }); break;
    case 'fell': noise(t, 0.06, { f: 3000, type: 'highpass', g: 0.4 * v }); tone(t, 0.2, 260, { type: 'triangle', g: 0.3 * v, f2: 80 }); noise(t + 0.05, 0.5, { f: 2200, q: 0.5, g: 0.15 * v }); break;
    case 'horn': tone(t, 0.38, 440, { type: 'square', g: 0.14 * v }); tone(t, 0.38, 554, { type: 'square', g: 0.11 * v }); break;
  }
}

// ---------- motorn ----------
class Engine {
  constructor(vol) {
    this.o1 = ac.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = ac.createOscillator(); this.o2.type = 'square';
    this.f = ac.createBiquadFilter(); this.f.type = 'lowpass'; this.f.Q.value = 3;
    this.g = ac.createGain(); this.g.gain.value = 0;
    this.o1.connect(this.f); this.o2.connect(this.f); this.f.connect(this.g); this.g.connect(sfxBus);
    this.o1.start(); this.o2.start();
    this.vol = vol;
    // däckskrik
    this.ns = ac.createBufferSource(); this.ns.buffer = noiseBuf; this.ns.loop = true;
    this.nf = ac.createBiquadFilter(); this.nf.type = 'bandpass'; this.nf.frequency.value = 1500; this.nf.Q.value = 6;
    this.ng = ac.createGain(); this.ng.gain.value = 0;
    this.ns.connect(this.nf); this.nf.connect(this.ng); this.ng.connect(sfxBus); this.ns.start();
  }
  set(speedFrac, throttle, slip, nitro, vol = 1) {
    const t = ac.currentTime;
    const gears = [0, 0.2, 0.38, 0.56, 0.74, 0.92, 2];
    let gI = 0; while (speedFrac > gears[gI + 1]) gI++;
    const within = (speedFrac - gears[gI]) / (gears[gI + 1] - gears[gI]);
    const rpm = Math.min(1.15, 0.22 + within * 0.8 + (throttle ? 0.08 : 0));
    const f = 42 + rpm * 120 + gI * 6 + (nitro ? 25 : 0);
    this.o1.frequency.setTargetAtTime(f, t, 0.04);
    this.o2.frequency.setTargetAtTime(f * 0.501, t, 0.04);
    this.f.frequency.setTargetAtTime(500 + rpm * 1600 + (throttle ? 600 : 0), t, 0.05);
    this.g.gain.setTargetAtTime((0.05 + (throttle ? 0.07 : 0.03)) * this.vol * vol, t, 0.05);
    this.ng.gain.setTargetAtTime(Math.min(0.16, Math.max(0, slip - 40) * 0.0016) * vol, t, 0.04);
  }
  stop() { try { this.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); this.ng.gain.setTargetAtTime(0, ac.currentTime, 0.05); const s = [this.o1, this.o2, this.ns]; setTimeout(() => s.forEach((o) => o.stop()), 300); } catch { /* */ } }
}
let engines = [];
export function makeEngines(n) {
  stopEngines();
  if (!ac) return [];
  engines = Array.from({ length: n }, (_, k) => new Engine(k === 0 ? 1 : 0.45));
  return engines;
}
export function stopEngines() { engines.forEach((e) => e.stop()); engines = []; }
export function engineSet(k, ...a) { if (engines[k]) engines[k].set(...a); }

// ---------- musik ----------
const NOTE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
const freq = (n) => { const m = /^([A-G])(#?)(\d)$/.exec(n); return 440 * 2 ** ((NOTE[m[1]] + (m[2] ? 1 : 0) + (+m[3] - 4) * 12) / 12); };
const bars = (...b) => b.join(' ').split(/\s+/).filter(Boolean);
const arp = (a, b, c, d, n = 4) => Array(n).fill(`${a} ${b} ${c} ${b}`).join(' ');
const SONGS = {
  race: {
    bpm: 152,
    lead: bars(
      'E5 - - - A5 - - - B5 - C6 - B5 - A5 -', 'C6 - - - A5 - - - F5 - A5 - C6 - - -', 'G5 - - - E5 - - - C5 - E5 - G5 - - -', 'D6 - - - B5 - - - G5 - A5 - B5 - D6 -',
      'A5 - C6 - E6 - - - D6 - C6 - B5 - A5 -', 'A5 - - - C6 - - - F6 - E6 - C6 - - -', 'E6 - D6 - C6 - - - G5 - - - C6 - - -', 'B5 - - - D6 - - - G6 - - - - - . .',
    ),
    arp: bars(arp('A4', 'C5', 'E5'), arp('F4', 'A4', 'C5'), arp('C5', 'E5', 'G5'), arp('G4', 'B4', 'D5'), arp('A4', 'C5', 'E5'), arp('F4', 'A4', 'C5'), arp('C5', 'E5', 'G5'), arp('G4', 'B4', 'D5')),
    bass: bars(...['A2 - A3 - A2 - A3 - A2 - A3 - G2 - A2 -', 'F2 - F3 - F2 - F3 - F2 - F3 - E2 - F2 -', 'C3 - C4 - C3 - C4 - C3 - C4 - B2 - C3 -', 'G2 - G3 - G2 - G3 - G2 - G3 - A2 - B2 -'], ...['A2 - A3 - A2 - A3 - A2 - A3 - G2 - A2 -', 'F2 - F3 - F2 - F3 - F2 - F3 - E2 - F2 -', 'C3 - C4 - C3 - C4 - C3 - C4 - B2 - C3 -', 'G2 - G3 - G2 - G3 - G2 - G3 - A2 - B2 -']),
    drum: bars(...Array(8).fill('K . H . S . H . K . H K S . H H')),
  },
  // Nattpatrull – egen låt i 80-talsstil: studsigt synthlead, slap-oktavbas, trummaskin
  nattpatrull: {
    bpm: 112,
    lead: bars(
      'D5 - . D5 F5 - G5 - . . A5 - G5 F5 - .', 'D5 - . . . . C5 - D5 - . . . . . .', 'D5 - . D5 F5 - G5 - . . C6 - A5 G5 - .', 'A5 - G5 - F5 - E5 - . . D5 - . . . .',
      'F5 - F5 - . F5 G5 - A5 - . . G5 - F5 -', 'E5 - . . C5 - . . E5 - F5 - G5 - . .', 'A5 - A5 - . A5 A#5 - A5 - . . G5 - F5 -', 'E5 - . . A4 - C#5 - E5 - . . . . . .',
    ),
    arp: bars(
      '. . F4 . . . A4 . . . F4 . . . A4 .', '. . F4 . . . A4 . . . F4 . . . A4 .', '. . D4 . . . F4 . . . D4 . . . F4 .', '. . E4 . . . G4 . . . E4 . . . G4 .',
      '. . D4 . . . F4 . . . D4 . . . F4 .', '. . E4 . . . G4 . . . E4 . . . G4 .', '. . C#4 . . . E4 . . . C#4 . . . E4 .', '. . C#4 . . . E4 . . . A4 . . . E4 .',
    ),
    bass: bars(
      'D2 . D3 D2 . . D3 . D2 . . D2 D3 . C3 .', 'D2 . D3 D2 . . D3 . D2 . . D2 D3 . F2 .', 'A#1 . A#2 A#1 . . A#2 . A#1 . . A#1 A#2 . A2 .', 'C2 . C3 C2 . . C3 . C2 . . C2 C3 . D3 .',
      'A#1 . A#2 A#1 . . A#2 . A#1 . . A#1 A#2 . A2 .', 'C2 . C3 C2 . . C3 . C2 . . C2 C3 . E2 .', 'A1 . A2 A1 . . A2 . A1 . . A1 A2 . G2 .', 'A1 . A2 A1 . . A2 . A1 . . C#2 E2 . G2 .',
    ),
    drum: bars(...Array(8).fill('K . H . S . H K . K H . S . H H')),
  },
  menu: {
    bpm: 116,
    lead: bars(
      'A4 - - - C5 - E5 - - - D5 - C5 - - -', 'F4 - - - A4 - C5 - - - A4 - - - - -', 'G4 - - - C5 - E5 - - - G5 - E5 - - -', 'D5 - - - B4 - - - G4 - - - - - - -',
      'A4 - - - C5 - E5 - A5 - - - G5 - E5 -', 'F5 - - - E5 - C5 - - - A4 - - - - -', 'E5 - - - G5 - - - C6 - - - B5 - G5 -', 'B5 - - - - - - - - - - - . . . .',
    ),
    arp: bars(arp('A3', 'C4', 'E4'), arp('F3', 'A3', 'C4'), arp('C4', 'E4', 'G4'), arp('G3', 'B3', 'D4'), arp('A3', 'C4', 'E4'), arp('F3', 'A3', 'C4'), arp('C4', 'E4', 'G4'), arp('G3', 'B3', 'D4')),
    bass: bars(...Array(2).fill(['A2 - - - - - - - A2 - - - E2 - - -', 'F2 - - - - - - - F2 - - - C2 - - -', 'C2 - - - - - - - C3 - - - G2 - - -', 'G2 - - - - - - - G2 - - - D2 - - -']).flat()),
    drum: bars(...Array(8).fill('K . . . H . . . K . K . H . . .')),
  },
};
function events(seq) {
  const out = [];
  for (let i = 0; i < seq.length; i++) {
    const n = seq[i];
    if (n === '-' || n === '.') continue;
    let len = 1; while (seq[i + len] === '-') len++;
    out[i] = { n, len };
  }
  return out;
}
let pendingSong = null, timer = 0, song = null, step = 0, nextT = 0;
export function startMusic(name) {
  pendingSong = name;
  if (!ac) return;
  if (song && song.name === name) return;
  stopMusic(); pendingSong = name;
  const S = SONGS[name];
  song = { name, bpm: S.bpm, len: S.lead.length, lead: events(S.lead), arp: events(S.arp), bass: events(S.bass), drum: S.drum };
  step = 0; nextT = ac.currentTime + 0.08;
  timer = setInterval(sched, 25);
}
export function stopMusic() { clearInterval(timer); timer = 0; song = null; }
function sched() {
  if (!song || !ac) return;
  const dt = 60 / song.bpm / 4;
  while (nextT < ac.currentTime + 0.15) {
    const t = nextT, i = step % song.len;
    const L = song.lead[i]; if (L) tone(t, L.len * dt * 0.95, freq(L.n), { g: 0.16, bus: musicBus, attack: 0.01 });
    const A = song.arp[i]; if (A) tone(t, dt * 0.8, freq(A.n), { g: 0.05, bus: musicBus });
    const B = song.bass[i]; if (B) tone(t, B.len * dt * 0.9, freq(B.n), { type: 'triangle', g: 0.42, bus: musicBus });
    const D = song.drum[i];
    if (D === 'K') tone(t, 0.14, 150, { type: 'sine', g: 0.7, f2: 40, bus: musicBus });
    else if (D === 'S') { noise(t, 0.12, { f: 2500, type: 'highpass', g: 0.32, bus: musicBus }); tone(t, 0.08, 190, { type: 'triangle', g: 0.25, bus: musicBus }); }
    else if (D === 'H') noise(t, 0.03, { f: 8000, type: 'highpass', g: 0.12, bus: musicBus });
    nextT += dt; step++;
  }
}
