// KURVKUNGEN – start, skalning, spelloop och alla skärmar (titel, menyer, garage, cuper, lopp, resultat).
import { World } from './world.js?v=1';
import { Race } from './race.js?v=1';
import { Hud, ordinal, fmtTime } from './hud.js?v=1';
import { drawRace, prewarm, carSprite } from './render.js?v=1';
import { renderCar, palette, CAR_COLORS, lookKey } from './carsprites.js?v=1';
import { drawText, GRAD, panel, tw } from './text.js?v=1';
import { Menu, CUPS, PRIZES, POINTS } from './ui.js?v=1';
import { input, pollActions, driveInput, touchButtons, setPointerMap, heldTouches } from './input.js?v=1';
import { initAudio, sfx, startMusic, stopMusic, makeEngines, stopEngines, engineSet, setMusic, setSfx, audio } from './audio.js?v=1';
import { save, persist, resetSave } from './save.js?v=1';
import { CARS, CAR_ORDER, UPGRADES, UPG_ORDER, FRONT, REAR, DRIVERS, ACCESSORIES, ACC_ORDER, PATTERNS, PATTERN_ORDER, FRONT_ORDER, REAR_ORDER, carStats } from './cars.js?v=1';
import { TRACKS, TRACK_ORDER, BASE_TRACKS, trackName, THEMES, GP_ORDER } from './tracks.js?v=1';
import { TEAMS, COMPOUNDS, COMPOUND_ORDER, POINTS as F1_POINTS, LAP_OPTIONS, teamById, f1Stats } from './f1.js?v=1';
import { lapEstimate } from './gp.js?v=1';
import { VERSION } from './version.js?v=1';
import { css } from './pix.js?v=1';
import { Host, Client, snapshot } from './net.js?v=1';
import { Mirror } from './mirror.js?v=1';
import { makeAI } from './ai.js?v=1';

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const sctx = canvas.getContext('2d');
const view = document.createElement('canvas');
const ctx = view.getContext('2d');
let S = 3, VW = 480, VH = 270, OXs = 0, OYs = 0, DPR = 1;

function resize() {
  DPR = window.devicePixelRatio || 1;
  const w = Math.round(innerWidth * DPR), h = Math.round(innerHeight * DPR);
  canvas.width = w; canvas.height = h;
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  // Grand Prix-loppen visar mer av banan (större banor, snabbare bilar)
  const [dw, dh] = G.wide ? (input.touch ? [460, 259] : [560, 315]) : [400, 225];
  S = Math.max(1, Math.floor(Math.min(w / dw, h / dh)));
  VW = Math.floor(w / S); VH = Math.floor(h / S);
  OXs = Math.floor((w - VW * S) / 2); OYs = Math.floor((h - VH * S) / 2);
  view.width = VW; view.height = VH;
  layoutTouch();
}
setPointerMap((cx, cy) => [Math.floor((cx * DPR - OXs) / S), Math.floor((cy * DPR - OYs) / S)]);
addEventListener('resize', resize);

const G = { state: 'boot', t: 0, world: null, race: null, hud: null, cam: { x: 0, y: 0, z: 0, shx: 0, shy: 0, shake: 0 }, menu: null, cfg: null, msg: '', loadP: 0, follow: null, followT: 0, results: null, stats: {} };
window.G = G;

// ---------- pekknappar ----------
function layoutTouch() {
  touchButtons.length = 0;
  if (!input.touch) return;
  if (G.state === 'race') {
    touchButtons.push({ id: 'left', x: 30, y: VH - 34, r: 22, label: '<' }, { id: 'right', x: 82, y: VH - 34, r: 22, label: '>' });
    touchButtons.push({ id: 'brake', x: VW - 32, y: VH - 32, r: 20, label: 'BROMS' });
    if (!input.autoGas) touchButtons.push({ id: 'gas', x: VW - 80, y: VH - 32, r: 20, label: 'GAS' });
    if (G.race && G.race.f1) touchButtons.push({ id: 'fire', x: VW - 30, y: VH - 82, r: 17, label: 'DRS' }, { id: 'box', x: VW - 72, y: VH - 78, r: 14, label: 'BOX' }, { id: 'tyre', x: VW - (input.autoGas ? 76 : 122), y: VH - 30, r: 14, label: 'DÄCK' });
    else touchButtons.push({ id: 'fire', x: VW - 30, y: VH - 82, r: 17, label: 'SKJUT' }, { id: 'rear', x: VW - 72, y: VH - 78, r: 14, label: 'BAK' }, { id: 'nitro', x: VW - (input.autoGas ? 76 : 122), y: VH - 30, r: 14, label: 'NOS' });
    touchButtons.push({ id: 'pause', x: VW - 16, y: 80, r: 10, label: 'II' });
  }
}
function drawTouch() {
  if (!input.touch || G.state !== 'race') return;
  const held = new Set([...heldTouches().values()].map((t) => t.b));
  for (const b of touchButtons) {
    const on = held.has(b.id);
    ctx.fillStyle = on ? 'rgba(255,240,160,0.45)' : 'rgba(20,16,40,0.35)';
    for (let y = -b.r; y <= b.r; y++) { const w = Math.round(Math.sqrt(b.r * b.r - y * y)); ctx.fillRect(b.x - w, b.y + y, w * 2, 1); }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283; ctx.fillRect(Math.round(b.x + Math.cos(a) * b.r), Math.round(b.y + Math.sin(a) * b.r), 1, 1); }
    drawText(ctx, b.label, b.x, b.y - 2, { color: 0xffffff, align: 'c', big: b.label.length === 1 });
  }
}

// ---------- ljud kopplat till loppets händelser ----------
function camDist(o) { const c = G.cam; return Math.hypot((o.x ?? 0) - c.x, (o.y ?? 0) - c.y); }
const near = (o) => Math.max(0, 1 - camDist(o) / 420);
function onEvent(type, a, b, c) {
  const R = G.race, hud = G.hud, P = R && R.player;
  if (!R || R !== G.race) return;
  G.stats[type] = (G.stats[type] || 0) + 1;
  if (NET.role === 'host' && NET_EVENTS.has(type)) NET.host.broadcast({ t: 'e', k: type, a: ser(R, a), b: ser(R, b), c: ser(R, c), d: arguments[4] ?? null, e: arguments[5] ?? null });
  const att = R.mode === 'attract';
  const v = (o) => (att ? near(o) * 0.35 : near(o));
  switch (type) {
    case 'count': if (!att) sfx('count'); break;
    case 'go': if (!att) sfx('go'); break;
    case 'lap': if (a === P) { if (b === R.laps - 1) { hud.say('SISTA VARVET!', 2, GRAD.fire); sfx('final'); } else { hud.say('VARV ' + (b + 1), 1.4, GRAD.white); sfx('lap'); } } break;
    case 'finish': if (a === P) { if (R.f1 && R.mode === 'time') hud.say('KVALET ÄR KLART', 3, GRAD.gold); else hud.say('MÅL! ' + ordinal(b), 4, b === 1 ? GRAD.gold : GRAD.white); sfx('finish'); } break;
    case 'light': if (!att) sfx('light'); break;
    case 'pitin': if (a === P) hud.say('DEPÅN – FARTBEGRÄNSAREN PÅ', 1.6, GRAD.gold, false); break;
    case 'pitstop': sfx('airgun', v(a) * (a === P ? 1 : 0.6)); break;
    case 'pitdone': if (a === P) { hud.say(`NYA ${COMPOUNDS[a.tyre.c].name} DÄCK – KÖR!`, 1.8, GRAD.green, false); sfx('go'); } break;
    case 'penalty': if (a === P) hud.say('+20 S: KÖRDE BARA EN DÄCKBLANDNING', 3.5, GRAD.red, false); break;
    case 'puncture':
      sfx('spike', v(a));
      if (a === P) { hud.say(b === 'blow' ? 'DÄCKET SMÄLLDE!' : 'PUNKA!', 2, GRAD.red); G.cam.shake = 0.2; if (!P.ai && !P.pitPhase) P.boxing = true; }
      break;
    case 'wingoff':
      sfx('crash', v(a));
      if (a === P) { hud.say('FRAMVINGEN BORTA!', 2, GRAD.red); G.cam.shake = 0.25; if (!P.ai && !P.pitPhase) P.boxing = true; }
      break;
    case 'wreck':
      sfx('boom', v(a));
      if (a === P) { hud.say('UTSLAGEN!', 2, GRAD.red); G.cam.shake = 0.5; }
      else if (b && b === P) { hud.say(`${a.name.toUpperCase()} UTSLAGEN  +150 KR`, 2, GRAD.green, false); }
      break;
    case 'splash': sfx('splash', v(a)); if (a === P) hud.say('PLASK!', 1.6, GRAD.blue); break;
    case 'crash': sfx('crash', Math.min(1, b / 200) * v(a)); if ((a === P || c === P) && b > 90) G.cam.shake = Math.min(0.35, b / 600); break;
    case 'bump': sfx('bump', Math.min(1, b / 150) * v(a)); if (a === P) G.cam.shake = 0.15; break;
    case 'pick': if (a === P) { sfx(b === 'pengar' ? 'cash' : b === 'reparera' ? 'repair' : 'pick'); hud.say({ pengar: 'PENGAR!', reparera: 'REPARERAD', ammo: 'AMMUNITION', nitro: '+1 NITRO' }[b], 1, GRAD.green, false); } break;
    case 'gun': sfx('gun', v(a) * (a === P ? 0.7 : 0.5)); break;
    case 'missile': sfx('missile', v(a)); break;
    case 'boom': sfx('boom', v(a) * 0.8); break;
    case 'rear': sfx('drop', v(a)); break;
    case 'nitro': sfx('nitro', v(a) * (a === P ? 1 : 0.5)); break;
    case 'oil': sfx('oil', v(a)); break;
    case 'cone': sfx('cone', v(a)); break;
    case 'hit': if (a === P) sfx('hit'); break;
    case 'rescue': hud.say('TILLBAKA PÅ BANAN', 1.4, GRAD.white, false); break;
    case 'cannon': sfx('cannon', v(a)); if (a === P) G.cam.shake = 0.12; break;
    case 'laser': sfx('laser', v(a) * 0.8); break;
    case 'flame': sfx('flame', v(a) * 0.8); break;
    case 'zap': sfx('zap', v(a)); if (b === P) hud.say('MOTORN SLÅR AV!', 1.4, GRAD.blue, false); break;
    case 'spike': sfx('spike', v(a)); if (a === P) hud.say('PUNKA!', 1.4, GRAD.red, false); break;
    case 'glue': sfx('glue', v(a)); if (a === P) hud.say('FAST I LIMMET!', 1.2, GRAD.green, false); break;
    case 'splat': sfx('splat', v(a)); if (b === P) { G.cam.shake = 0.06; hud.say(['MOS!', 'PANNKAKA!', 'OJ!', 'PLATT!'][(Math.random() * 4) | 0], 0.9, GRAD.red, false); } break;
    case 'animal': sfx('animalhit', v(a)); if (b === P) hud.say('VÄÄÄ!', 0.9, GRAD.red, false); break;
    case 'moose': sfx('moose', v(a)); if (b === P) { G.cam.shake = 0.5; hud.say(a.type === 'alg' ? 'ÄLGKROCK!' : a.type === 'ko' ? 'KOKROCK!' : 'KROCK!', 1.6, GRAD.red); } break;
    case 'thud': sfx('thud', v(a) * 0.7); break;
    case 'fell': sfx('fell', v(a)); break;
    case 'lava': sfx('boom', v(a)); if (a === P) hud.say('I LAVAN!', 1.6, GRAD.fire); break;
    case 'land': if (a === P) sfx('land', Math.min(1, b / 200)); break;
    case 'done': if (!att) setTimeout(() => { if (G.race === R) showResults(); }, 1800); break;
  }
}

// ---------- start ----------
async function boot() {
  resize();
  G.state = 'boot'; G.msg = 'BYGGER VÄRLDEN';
  const startTrack = Q.get('race') || Q.get('gp') || 'sjoviken';
  const w = new World(startTrack);
  await w.load();
  G.world = w;
  if (Q.get('race')) {
    input.autoGas = false;
    await startRace({ track: startTrack, laps: +(Q.get('laps') || 3), mode: Q.get('mode') || 'race', opponents: makeOpponents(CUPS[0], 5), prizeMul: 0.5, autopilot: Q.has('auto') });
    return;
  }
  if (Q.get('gp')) {
    input.autoGas = false;
    const g = gpSave();
    await startGP({ track: Q.get('gp').replace(/_n$/, ''), night: /_n$/.test(Q.get('gp')), laps: +(Q.get('laps') || 5), quali: Q.get('quali') === '1', start: Q.get('tyre') || 'medium', team: Q.get('team') || g.team, seat: +(Q.get('seat') || 0), level: +(Q.get('level') ?? 1), autopilot: Q.has('auto') });
    return;
  }
  startAttract();
  G.state = 'title';
  startMusic('menu');
}

function startAttract() {
  if (G.wide) { G.wide = false; resize(); }
  G.world.resetDynamic();
  const cars = [];
  if (G.world.def.f1) {
    const ts = [...TEAMS].sort(() => Math.random() - 0.5);
    for (let k = 0; k < 10; k++) { const tm = ts[k % ts.length], d = tm.drivers[k >= ts.length ? 1 : 0]; cars.push({ f1: true, team: tm.id, seat: k >= ts.length ? 1 : 0, name: d[0], code: d[1], skill: d[2], compound: COMPOUND_ORDER[k % 3] }); }
    G.race = new Race(G.world, { mode: 'attract', cars, countdown: 0.01, events: onEvent, night: G.world.def.night, f1: true });
    G.hud = new Hud(G.race);
    G.follow = G.race.cars[0]; G.followT = 0;
    const c = G.follow; G.cam.x = c.x; G.cam.y = c.y; G.cam.z = c.z;
    return;
  }
  const models = [...CAR_ORDER].sort(() => Math.random() - 0.5).slice(0, 7);
  for (let k = 0; k < 7; k++) cars.push({ name: DRIVERS[k].name, carId: models[k], color: k === 0 ? 0xd8282c : DRIVERS[k].color, skill: 0.5 + k * 0.07, pattern: PATTERN_ORDER[(Math.random() * PATTERN_ORDER.length) | 0], frontW: FRONT_ORDER[k % FRONT_ORDER.length], rearW: REAR_ORDER[k % REAR_ORDER.length] });
  G.race = new Race(G.world, { mode: 'attract', cars, countdown: 0.01, events: onEvent, night: G.world.def.night });
  G.hud = new Hud(G.race);
  G.follow = G.race.cars[0]; G.followT = 0;
  const c = G.follow; G.cam.x = c.x; G.cam.y = c.y; G.cam.z = c.z;
}

function makeOpponents(cup, n) {
  const ds = [...DRIVERS].sort(() => Math.random() - 0.5).filter((d) => d.color !== (save.garage[save.car]?.color));
  const out = [];
  const fronts = FRONT_ORDER.slice(0, 2 + cup.upg * 2), rears = REAR_ORDER.slice(0, 3 + cup.upg * 2);
  for (let k = 0; k < n; k++) {
    const d = ds[k % ds.length];
    const skill = cup.skill[0] + (cup.skill[1] - cup.skill[0]) * (k / Math.max(1, n - 1));
    const up = cup.upg;
    out.push({
      name: d.name, color: d.color, carId: cup.models[k % cup.models.length], skill,
      upg: { motor: Math.min(4, up + (k > 2 ? 1 : 0)), dack: up, pansar: up, nitro: Math.min(4, up), ramm: Math.min(4, up + (k & 1)), ljus: 2 },
      acc: { spoiler: Math.random() < 0.3, neon: Math.random() < 0.4 },
      pattern: PATTERN_ORDER[(Math.random() * PATTERN_ORDER.length) | 0],
      frontW: fronts[(Math.random() * fronts.length) | 0], frontLvl: Math.min(3, up), rearW: rears[(Math.random() * rears.length) | 0], rearLvl: Math.min(3, up),
    });
  }
  return out;
}

export function gEntry(id) {
  const g = save.garage[id];
  if (g) {
    g.upg = { motor: 0, dack: 0, pansar: 0, nitro: 0, ramm: 0, ljus: 0, ...(g.upg || {}) };
    g.acc = g.acc || {}; g.patterns = g.patterns || ['rander', 'enfarg']; g.pattern = g.pattern || 'rander';
  }
  return g;
}
function playerCarCfg() {
  const g = gEntry(save.car);
  return {
    name: 'Du', isPlayer: true, carId: save.car, color: g.color, upg: g.upg, acc: g.acc, pattern: g.pattern,
    frontW: save.weapons.front, frontLvl: save.weapons.owned[save.weapons.front] || 0,
    rearW: save.weapons.rear, rearLvl: save.weapons.owned[save.weapons.rear] || 0,
  };
}

async function startRace(cfg) {
  G.cfg = cfg;
  if (!!G.wide !== !!cfg.f1) { G.wide = !!cfg.f1; resize(); }
  G.state = 'loading'; G.loadP = 0; G.msg = trackName(cfg.track);
  stopEngines();
  let w = G.world;
  if (!w || w.id !== cfg.track) { w = new World(cfg.track); G.msg = trackName(cfg.track); await w.load(); }
  else w.resetDynamic();
  G.world = w;
  const cars = [];
  const pc = playerCarCfg();
  if (cfg.gpGrid) cars.push(...cfg.gpGrid(w.T).map(({ q, ...c }) => c));
  else if (cfg.carsList) cars.push(...cfg.carsList.map((c, k) => (k === cfg.myIndex && NET.role !== 'guest' ? { ...pc, ...c, isPlayer: true, human: false } : { ...c })));
  else if (cfg.mode === 'time') cars.push(pc);
  else {
    // spelaren startar längst bak i mästerskapets första lopp, annars efter placering
    const opp = cfg.opponents;
    const order = cfg.grid || [...opp.map((o) => o.name), 'Du'];
    for (const name of order) cars.push(name === 'Du' ? pc : opp.find((o) => o.name === name));
  }
  G.stats = {};
  const R = new Race(w, { mode: cfg.mode, laps: cfg.laps, cars, events: onEvent, autopilot: cfg.autopilot, night: TRACKS[cfg.track].night, f1: cfg.f1, wearLaps: cfg.wearLaps });
  G.race = R; G.hud = new Hud(R);
  if (cfg.quali) R.poleRef = Math.min(...gpField(cfg.gp).filter((c) => !c.isPlayer).map((c) => lapEstimate(w.T, f1Stats(teamById(c.team).perf), c.skill)));
  if (NET.role === 'guest') { NET.mirror = new Mirror(R, cfg.myIndex); }
  const pl = R.player;
  G.cam.x = pl.x; G.cam.y = pl.y; G.cam.z = pl.z;
  // förrendera bilarna i bitar och vänta in rutorna runt start
  const it = prewarm(R.cars);
  let n = 0;
  await new Promise((res) => {
    const tick = () => {
      for (let k = 0; k < 6; k++) if (it.next().done) { n = -1; break; } else n++;
      const tiles = w.tilesReadyAround(isoXc(pl), isoYc(pl), VW + 128, VH + 128);
      G.loadP = Math.min(1, (n < 0 ? 0.5 : Math.min(0.5, n / (R.cars.length * 8 * 2))) + tiles * 0.5);
      w.request(isoXc(pl), isoYc(pl));
      if (n < 0 && tiles >= 0.99) res(); else setTimeout(tick, 16);
    };
    tick();
  });
  G.state = 'race';
  if (NET.role === 'guest') NET.client.send({ t: 'ready' });
  layoutTouch();
  startMusic(TRACKS[cfg.track].night || Math.random() < 0.5 ? 'nattpatrull' : 'race');
  makeEngines(2);
}
const isoXc = (c) => c.x - c.y, isoYc = (c) => (c.x + c.y) / 2 - c.z;

// ---------- skärmar ----------
function go(state) {
  G.state = state;
  if (state === 'menu') G.menu = mainMenu();
  layoutTouch();
}
function mainMenu() {
  return new Menu('HUVUDMENY', [
    { label: 'MÄSTERSKAP', ok: () => { sfx('ok'); G.menu = cupMenu(); G.state = 'sub'; }, info: () => 'FEM CUPER. VINN PENGAR, KÖP FORDON OCH VAPEN.' },
    { label: 'SNABBT LOPP', ok: () => { sfx('ok'); G.menu = quickMenu(); G.state = 'sub'; }, info: () => 'VÄLJ BANA OCH MOTSTÅNDARE.' },
    { label: 'GRAND PRIX', ok: () => { sfx('ok'); G.menu = gpMenu(); G.state = 'gp'; }, info: () => ['FORMEL 1 – INGA VAPEN, BARA RACING.', 'DÄCKSLITAGE, DEPÅSTOPP, SLIPSTREAM OCH DRS.'] },
    { label: 'TIDSJAKT', ok: () => { sfx('ok'); G.menu = timeMenu(); G.state = 'sub'; }, info: () => 'ENSAM PÅ BANAN. SLÅ DITT BÄSTA VARV.' },
    { label: 'SPELA ONLINE', ok: () => { sfx('ok'); G.menu = onlineMenu(); G.state = 'sub'; }, info: () => 'KÖR MOT KOMPISAR MED EN RUMSKOD.' },
    { label: 'GARAGET', ok: () => { sfx('ok'); openGarage(() => go('menu')); }, info: () => `${save.money} KR I KASSAN` },
    { label: 'INSTÄLLNINGAR', ok: () => { sfx('ok'); G.menu = settingsMenu(); G.state = 'sub'; } },
  ], { w: 190, back: () => { G.state = 'title'; } });
}
const backToMain = () => { G.menu = mainMenu(); G.state = 'menu'; };
function cupMenu() {
  const items = CUPS.map((c) => ({
    label: c.name, value: () => (save.cups[c.id] ? ordinal(save.cups[c.id].best) : c.unlock && !save.cups[c.unlock] ? 'LÅST' : 'NY'),
    dis: () => c.unlock && !(save.cups[c.unlock] && save.cups[c.unlock].best <= 3),
    info: () => [`${c.tracks.length} LOPP · ${c.laps} VARV · PRISPENGAR ×${c.prize}`, c.unlock && !(save.cups[c.unlock] && save.cups[c.unlock].best <= 3) ? 'KRÄVER TOPP 3 I ' + CUPS.find((x) => x.id === c.unlock).name : c.tracks.map(trackName).join(', ')],
    ok: () => { sfx('ok'); startChamp(c); },
  }));
  if (save.champ) items.unshift({ label: 'FORTSÄTT ' + CUPS.find((c) => c.id === save.champ.cup).name, ok: () => { sfx('ok'); preRace(); }, info: () => `LOPP ${save.champ.race + 1} AV ${CUPS.find((c) => c.id === save.champ.cup).tracks.length}` });
  items.push({ label: 'TILLBAKA', ok: backToMain });
  return new Menu('MÄSTERSKAP', items, { w: 220, back: backToMain });
}
function startChamp(cup) {
  const opp = makeOpponents(cup, cup.cars || 5);
  save.champ = { cup: cup.id, race: 0, opp, pts: Object.fromEntries([...opp.map((o) => [o.name, 0]), ['Du', 0]]), grid: [...opp.map((o) => o.name), 'Du'] };
  persist();
  preRace();
}
function preRace() {
  const ch = save.champ, cup = CUPS.find((c) => c.id === ch.cup);
  const tr = cup.tracks[ch.race];
  G.menu = new Menu(`${cup.name} – LOPP ${ch.race + 1}/${cup.tracks.length}`, [
    { label: 'KÖR!', value: () => trackName(tr), ok: () => { sfx('ok'); startRace({ track: tr, laps: cup.laps, mode: 'race', opponents: ch.opp, grid: ch.grid, prizeMul: cup.prize, champ: true }); } },
    { label: 'GARAGET', value: () => save.money + ' KR', ok: () => { sfx('ok'); openGarage(preRace); } },
    { label: 'STÄLLNING', ok: () => { sfx('ok'); G.results = { standings: true, back: preRace }; G.state = 'standings'; } },
    { label: 'AVBRYT CUPEN', ok: () => { sfx('back'); save.champ = null; persist(); backToMain(); } },
  ], { w: 250, back: () => { G.menu = cupMenu(); } });
  G.state = 'sub';
}
let qTrack = 0, qLaps = 3, qLevel = 1, qRev = false, qNight = false, qCars = 6;
const LEVELS = ['LÄTT', 'MEDEL', 'SVÅR', 'GALET'];
const qId = () => BASE_TRACKS[qTrack] + (qRev ? '_r' : '') + (qNight ? '_n' : '');
const trackItems = () => [
  { label: 'BANA', value: () => TRACKS[BASE_TRACKS[qTrack]].name.toUpperCase(), left: () => { qTrack = (qTrack + BASE_TRACKS.length - 1) % BASE_TRACKS.length; }, right: () => { qTrack = (qTrack + 1) % BASE_TRACKS.length; }, info: () => THEMES[TRACKS[BASE_TRACKS[qTrack]].theme].name.toUpperCase() },
  { label: 'RIKTNING', value: () => (qRev ? 'BAKLÄNGES' : 'FRAMÅT'), left: () => { qRev = !qRev; }, right: () => { qRev = !qRev; }, ok: () => { qRev = !qRev; } },
  { label: 'TID', value: () => (qNight ? 'NATT' : 'DAG'), left: () => { qNight = !qNight; }, right: () => { qNight = !qNight; }, ok: () => { qNight = !qNight; }, info: () => (qNight ? 'MÖRKT! STRÅLKASTARNA LYSER UPP VÄGEN.' : '') },
];
function quickMenu() {
  return new Menu('SNABBT LOPP', [
    ...trackItems(),
    { label: 'VARV', value: () => qLaps, left: () => { qLaps = Math.max(1, qLaps - 1); }, right: () => { qLaps = Math.min(9, qLaps + 1); } },
    { label: 'MOTSTÅNDARE', value: () => LEVELS[qLevel], left: () => { qLevel = (qLevel + 3) % 4; }, right: () => { qLevel = (qLevel + 1) % 4; } },
    { label: 'ANTAL BILAR', value: () => qCars + 1, left: () => { qCars = Math.max(1, qCars - 1); }, right: () => { qCars = Math.min(9, qCars + 1); } },
    { label: 'KÖR!', ok: () => { sfx('ok'); startRace({ track: qId(), laps: qLaps, mode: 'race', opponents: makeOpponents(CUPS[Math.min(CUPS.length - 1, qLevel)], qCars), prizeMul: 0.4 }); }, info: () => 'SNABBA LOPP GER LÄGRE PRISPENGAR.' },
    { label: 'TILLBAKA', ok: backToMain },
  ], { w: 280, back: backToMain, rowH: 14 });
}
function timeMenu() {
  return new Menu('TIDSJAKT', [
    ...trackItems(),
    { label: 'REKORD', value: () => fmtTime(save.records[qId()]) },
    { label: 'KÖR!', ok: () => { sfx('ok'); startRace({ track: qId(), laps: 5, mode: 'time', opponents: [], prizeMul: 0 }); } },
    { label: 'TILLBAKA', ok: backToMain },
  ], { w: 280, back: backToMain });
}
function settingsMenu() {
  let confirm = false;
  return new Menu('INSTÄLLNINGAR', [
    { label: 'MUSIK', value: () => (audio.music ? 'PÅ' : 'AV'), ok: () => toggleMusic(), left: () => toggleMusic(), right: () => toggleMusic() },
    { label: 'LJUDEFFEKTER', value: () => (audio.sfx ? 'PÅ' : 'AV'), ok: () => { setSfx(!audio.sfx); save.settings.sfx = audio.sfx; persist(); }, left: () => { setSfx(!audio.sfx); save.settings.sfx = audio.sfx; persist(); }, right: () => { setSfx(!audio.sfx); save.settings.sfx = audio.sfx; persist(); } },
    { label: 'AUTOGAS (PEK)', value: () => (input.autoGas ? 'PÅ' : 'AV'), ok: () => { input.autoGas = !input.autoGas; save.settings.autoGas = input.autoGas; persist(); }, left: () => { input.autoGas = !input.autoGas; save.settings.autoGas = input.autoGas; persist(); }, right: () => { input.autoGas = !input.autoGas; save.settings.autoGas = input.autoGas; persist(); }, info: () => 'PÅ MOBILEN GASAR BILEN SJÄLV – DU STYR, BROMSAR OCH SKJUTER.' },
    { label: 'NOLLSTÄLL SPELET', value: () => (confirm ? 'SÄKER?' : ''), ok: () => { if (!confirm) { confirm = true; sfx('deny'); return; } resetSave(); location.reload(); }, info: () => 'RADERAR PENGAR, BILAR OCH REKORD.' },
    { label: 'TILLBAKA', ok: backToMain },
  ], { w: 230, back: backToMain });
}
function toggleMusic() { setMusic(!audio.music); save.settings.music = audio.music; persist(); }

// ---------- garaget ----------
let garage = null;
function openGarage(back) {
  let view = save.car;
  const g = () => gEntry(view);
  const owned = () => !!save.garage[view];
  let pat = owned() ? g().pattern : 'rander';
  const cycleCar = (d) => { const i = CAR_ORDER.indexOf(view); view = CAR_ORDER[(i + d + CAR_ORDER.length) % CAR_ORDER.length]; if (owned()) { save.car = view; pat = g().pattern; persist(); } else pat = 'rander'; };
  const colorList = CAR_COLORS;
  const pay = (p) => { if (save.money < p) { sfx('deny'); return false; } save.money -= p; sfx('buy'); persist(); return true; };
  const upItem = (k) => ({
    label: UPGRADES[k].name.toUpperCase(),
    value: () => { if (!owned()) return '-'; const l = g().upg[k]; return l < 4 ? UPGRADES[k].prices[l] + ' KR' : 'MAX'; },
    pips: () => (owned() ? [g().upg[k], 4] : null),
    dis: () => !owned() || g().upg[k] >= 4,
    ok: () => { const l = g().upg[k]; if (pay(UPGRADES[k].prices[l])) { g().upg[k]++; persist(); } },
    info: () => UPGRADES[k].desc.toUpperCase(),
  });
  const accItem = (k) => ({
    label: ACCESSORIES[k].name.toUpperCase(),
    value: () => (!owned() ? '-' : g().acc[k] ? 'MONTERAD' : ACCESSORIES[k].price + ' KR'),
    vcol: () => (owned() && g().acc[k] ? 0x7ae06a : 0xffe080),
    dis: () => !owned() || !!g().acc[k],
    ok: () => { if (pay(ACCESSORIES[k].price)) { g().acc[k] = true; persist(); } },
    info: () => ACCESSORIES[k].desc.toUpperCase(),
  });
  const weapItem = (slot, TAB, ORDER) => ({
    label: slot === 'front' ? 'FRAMVAPEN' : 'BAKVAPEN',
    value: () => { const w = save.weapons[slot], lvl = save.weapons.owned[w] ?? -1; return TAB[w].name.toUpperCase() + (lvl >= 0 ? '' : '  ' + TAB[w].price + ' KR'); },
    pips: () => { const lvl = save.weapons.owned[save.weapons[slot]]; return lvl === undefined ? null : [lvl, 3]; },
    left: () => { const i = ORDER.indexOf(save.weapons[slot]); save.weapons[slot] = ORDER[(i + ORDER.length - 1) % ORDER.length]; },
    right: () => { const i = ORDER.indexOf(save.weapons[slot]); save.weapons[slot] = ORDER[(i + 1) % ORDER.length]; },
    ok: () => {
      const w = save.weapons[slot], lvl = save.weapons.owned[w];
      if (lvl === undefined) { if (pay(TAB[w].price)) save.weapons.owned[w] = 0; }
      else if (lvl < 3) { if (pay(TAB[w].prices[lvl])) save.weapons.owned[w]++; }
      else sfx('deny');
      persist();
    },
    info: () => { const w = save.weapons[slot], lvl = save.weapons.owned[w]; return [TAB[w].desc.toUpperCase(), lvl === undefined ? `KÖP FÖR ${TAB[w].price} KR (ENTER)` : lvl < 3 ? `UPPGRADERA: ${TAB[w].prices[lvl]} KR (ENTER)` : 'FULLT UPPGRADERAD']; },
  });
  const finish = () => {
    for (const [slot, ORDER] of [['front', FRONT_ORDER], ['rear', REAR_ORDER]]) if (save.weapons.owned[save.weapons[slot]] === undefined) save.weapons[slot] = ORDER.find((k) => save.weapons.owned[k] !== undefined);
    if (!owned()) view = save.car;
    persist(); garage = null; back();
  };
  const toMain = () => { G.menu = main; };
  const sub = (title, items) => new Menu(title, [...items, { label: 'TILLBAKA', ok: () => { sfx('back'); toMain(); } }], { w: 254, back: toMain, rowH: 14 });
  const main = new Menu('GARAGET', [
    { label: 'FORDON', value: () => CARS[view].name.toUpperCase() + (owned() ? '' : '  ' + CARS[view].price + ' KR'), left: () => cycleCar(-1), right: () => cycleCar(1), ok: () => { if (owned()) return; if (pay(CARS[view].price)) { save.garage[view] = { color: CARS[view].color }; gEntry(view); save.car = view; pat = 'rander'; persist(); } }, info: () => owned() ? CARS[view].desc.toUpperCase() : `KÖP FÖR ${CARS[view].price} KR (ENTER)` },
    { label: 'FÄRG', value: () => '', dis: () => !owned(), left: () => { const i = colorList.indexOf(g().color); g().color = colorList[(i + colorList.length - 1 + (i < 0 ? 1 : 0)) % colorList.length]; persist(); }, right: () => { const i = colorList.indexOf(g().color); g().color = colorList[(i + 1) % colorList.length]; persist(); } },
    {
      label: 'LACK', dis: () => !owned(),
      value: () => PATTERNS[pat].name.toUpperCase() + (owned() && !g().patterns.includes(pat) ? '  ' + PATTERNS[pat].price + ' KR' : ''),
      left: () => { const i = PATTERN_ORDER.indexOf(pat); pat = PATTERN_ORDER[(i + PATTERN_ORDER.length - 1) % PATTERN_ORDER.length]; if (g().patterns.includes(pat)) { g().pattern = pat; persist(); } },
      right: () => { const i = PATTERN_ORDER.indexOf(pat); pat = PATTERN_ORDER[(i + 1) % PATTERN_ORDER.length]; if (g().patterns.includes(pat)) { g().pattern = pat; persist(); } },
      ok: () => { if (g().patterns.includes(pat)) return; if (pay(PATTERNS[pat].price)) { g().patterns.push(pat); g().pattern = pat; persist(); } },
      info: () => (owned() && !g().patterns.includes(pat) ? `KÖP LACKEN FÖR ${PATTERNS[pat].price} KR (ENTER)` : 'BLÄDDRA MED VÄNSTER/HÖGER'),
    },
    { label: 'UPPGRADERINGAR  >', dis: () => !owned(), ok: () => { sfx('ok'); G.menu = sub('UPPGRADERINGAR', UPG_ORDER.map(upItem)); }, info: () => 'MOTOR, DÄCK, PANSAR, NITRO, RAMBOCK, STRÅLKASTARE' },
    { label: 'TILLBEHÖR  >', dis: () => !owned(), ok: () => { sfx('ok'); G.menu = sub('TILLBEHÖR', ACC_ORDER.map(accItem)); }, info: () => 'SPOILER, SPIKDÄCK, SJÄLVLAGNING, NEON, TUTA, TURBO' },
    { label: 'VAPEN  >', ok: () => { sfx('ok'); G.menu = sub('VAPEN', [weapItem('front', FRONT, FRONT_ORDER), weapItem('rear', REAR, REAR_ORDER)]); }, info: () => `${FRONT_ORDER.length} FRAMVAPEN OCH ${REAR_ORDER.length} BAKVAPEN` },
    { label: 'KLAR', ok: () => { sfx('ok'); finish(); } },
  ], { w: 254, back: finish, rowH: 14 });
  garage = { main, get view() { return view; }, get pat() { return pat; }, owned };
  G.menu = main; G.state = 'garage';
}
const bigCars = new Map();
function drawGarage(t) {
  const m = G.menu, view = garage.view;
  dimBg(0.55);
  const r = m.draw(ctx, VW, VH, t, VW - 262, 8, 254);
  const LW = Math.max(150, VW - 262 - 16), LX = 8, LH = Math.max(r.H, 168);
  panel(ctx, LX, 8, LW, LH, 'rgba(20,16,40,0.78)', '#6a6488');
  const px = LX + Math.round(LW / 2), py = 8 + Math.round(LH * 0.42);
  const ge = garage.owned() ? gEntry(view) : null;
  const col = ge ? ge.color : 0x8a8694;
  const look = { pal: palette(col), pattern: garage.pat, spoiler: !!(ge && ge.acc.spoiler), ramm: ge ? ge.upg.ramm : 0 };
  const ang = (t * 0.6) % (Math.PI * 2);
  const k = Math.round(ang / (Math.PI * 2) * 32) % 32;
  const key = view + lookKey(look) + ':' + k;
  if (!bigCars.has(key)) { if (bigCars.size > 160) bigCars.clear(); bigCars.set(key, renderCar(CARS[view].model, look, k / 32 * Math.PI * 2, 2)); }
  const spr = bigCars.get(key);
  ctx.fillStyle = '#2a2640'; for (let y = -10; y <= 10; y++) { const w = Math.round(Math.sqrt(100 - y * y) * 4.4); ctx.fillRect(px - w, py + 22 + Math.round(y / 2), w * 2, 1); }
  ctx.fillStyle = '#3c3858'; for (let y = -9; y <= 9; y++) { const w = Math.round(Math.sqrt(81 - y * y) * 4.4); ctx.fillRect(px - w, py + 21 + Math.round(y / 2), w * 2, 1); }
  if (ge && ge.acc.neon) { ctx.fillStyle = 'rgba(60,220,255,0.35)'; ctx.beginPath(); ctx.ellipse(px, py + 22, 30, 12, 0, 0, 7); ctx.fill(); }
  ctx.drawImage(spr, px - spr.ox, py + 22 - spr.oy);
  drawText(ctx, CARS[view].name.toUpperCase(), px, 14, { big: true, grad: GRAD.gold, align: 'c' });
  const st = ge ? carStats(view, ge.upg, ge.acc) : carStats(view);
  const rows = [['FART', st.vmax / 360], ['ACCELERATION', st.acc / 470], ['GREPP', st.grip / 1650], ['TÅLIGHET', (1.25 - st.armor) / 1.0], ['VIKT', st.mass / 3.6]];
  const bw = LW - 76;
  rows.forEach(([n, v], i) => {
    const y = 8 + LH - 50 + i * 9;
    drawText(ctx, n, LX + 8, y, { color: 0xd8d4e8 });
    ctx.fillStyle = '#2a2640'; ctx.fillRect(LX + 68, y - 1, bw, 6);
    ctx.fillStyle = '#f2c21c'; ctx.fillRect(LX + 68, y - 1, Math.round(bw * Math.max(0.05, Math.min(1, v))), 6);
    ctx.fillStyle = '#fff2a0'; ctx.fillRect(LX + 68, y - 1, Math.round(bw * Math.max(0.05, Math.min(1, v))), 1);
  });
  drawText(ctx, save.money + ' KR', VW - 12, r.Y + r.H + 6, { big: true, grad: GRAD.gold, align: 'r' });
  const ci = m.items.findIndex((it) => it.label === 'FÄRG');
  if (ci >= 0 && ge) { const yy = r.Y + 24 + ci * 14 + 2; ctx.fillStyle = '#1a1426'; ctx.fillRect(r.X + r.W - 30, yy, 14, 9); ctx.fillStyle = css(ge.color); ctx.fillRect(r.X + r.W - 29, yy + 1, 12, 7); }
}

// ---------- resultat ----------
function showResults() {
  const R = G.race, cfg = G.cfg, P = R.player;
  stopEngines();
  NET.inRace = false;
  if (cfg.f1) { gpResults(); return; }
  if (NET.role === 'host') NET.host.broadcast({ t: 'res', order: R.finishOrder.map((c) => [R.cars.indexOf(c), c.finishTime, c.bestLap || 0, c.kills, c.roadkill, c.money]) });
  const res = { rows: [], money: 0, cfg };
  if (cfg.mode === 'time') {
    const best = P.bestLap;
    const old = save.records[cfg.track];
    res.record = best && (!old || best < old);
    if (res.record) save.records[cfg.track] = best;
    res.best = best; res.laps = P.lapTimes;
  } else {
    R.finishOrder.forEach((c, k) => {
      const prize = Math.round((PRIZES[k] || 0) * cfg.prizeMul);
      res.rows.push({ name: c.isPlayer ? 'DU' : c.name.toUpperCase(), time: c.finishTime, best: c.bestLap, prize, me: c.isPlayer, color: c.color, kills: c.kills });
      if (c.isPlayer) { res.place = k + 1; res.prize = prize; res.pickup = c.money; res.money = prize + c.money; res.roadkill = c.roadkill; res.kills = c.kills; }
    });
    save.money += res.money;
    if (P.bestLap && (!save.records[cfg.track] || P.bestLap < save.records[cfg.track])) save.records[cfg.track] = P.bestLap;
    if (cfg.champ && save.champ) {
      const ch = save.champ;
      R.finishOrder.forEach((c, k) => { ch.pts[c.isPlayer ? 'Du' : c.name] += POINTS[k] || 0; });
      ch.grid = [...R.finishOrder].reverse().map((c) => (c.isPlayer ? 'Du' : c.name));
      ch.race++;
      const cup = CUPS.find((c) => c.id === ch.cup);
      if (ch.race >= cup.tracks.length) {
        const order = Object.entries(ch.pts).sort((a, b) => b[1] - a[1]);
        const place = order.findIndex(([n]) => n === 'Du') + 1;
        res.champEnd = { cup, order, place };
        const bonus = [3000, 1500, 800][place - 1] || 0;
        res.champEnd.bonus = Math.round(bonus * cup.prize);
        save.money += res.champEnd.bonus;
        const prev = save.cups[cup.id];
        save.cups[cup.id] = { best: prev ? Math.min(prev.best, place) : place };
        save.champ = null;
      }
    }
  }
  persist();
  G.results = res;
  G.state = 'results';
  startMusic('menu');
}
function drawResults(t) {
  const res = G.results;
  dimBg(0.6);
  if (res.gpQuali) return drawGPQuali(t);
  if (res.gpRace) return drawGPResults(t);
  if (res.gpStand) return drawGPStandings(t);
  const W = Math.min(VW - 16, 360), X = Math.round(VW / 2 - W / 2);
  if (res.standings) return drawStandings(t, X, W);
  if (res.cfg.mode === 'time') {
    panel(ctx, X, 16, W, 150);
    drawText(ctx, 'TIDSJAKT – ' + trackName(res.cfg.track), VW / 2, 24, { big: true, grad: GRAD.gold, align: 'c' });
    res.laps.forEach((lt, k) => drawText(ctx, `VARV ${k + 1}   ${fmtTime(lt)}`, VW / 2, 46 + k * 10, { color: lt === res.best ? 0xffe080 : 0xd8d4e8, align: 'c' }));
    drawText(ctx, 'BÄSTA VARV ' + fmtTime(res.best), VW / 2, 112, { big: true, grad: GRAD.white, align: 'c' });
    if (res.record && ((t * 3) | 0) % 2) drawText(ctx, 'NYTT REKORD!', VW / 2, 132, { big: true, scale: 2, grad: GRAD.fire, align: 'c' });
  } else {
    const H = 44 + res.rows.length * 12 + 52;
    panel(ctx, X, 10, W, H);
    drawText(ctx, 'RESULTAT – ' + trackName(res.cfg.track), VW / 2, 18, { big: true, grad: GRAD.gold, align: 'c' });
    drawText(ctx, 'FÖRARE', X + 30, 34, { color: 0x9a94b0 }); drawText(ctx, 'TID', X + W * 0.5, 34, { color: 0x9a94b0 }); drawText(ctx, 'BÄSTA VARV', X + W * 0.68, 34, { color: 0x9a94b0 }); drawText(ctx, 'PRIS', X + W - 10, 34, { color: 0x9a94b0, align: 'r' });
    res.rows.forEach((r, k) => {
      const y = 46 + k * 12;
      if (r.me) { ctx.fillStyle = 'rgba(200,38,46,0.7)'; ctx.fillRect(X + 4, y - 3, W - 8, 11); }
      drawText(ctx, ordinal(k + 1), X + 8, y, { color: k === 0 ? 0xffd040 : 0xffffff });
      ctx.fillStyle = '#1a1426'; ctx.fillRect(X + 22, y - 1, 6, 7); ctx.fillStyle = css(r.color); ctx.fillRect(X + 23, y, 4, 5);
      drawText(ctx, r.name, X + 32, y, { color: 0xffffff });
      drawText(ctx, fmtTime(r.time), X + W * 0.5, y, { color: 0xd8d4e8 });
      drawText(ctx, fmtTime(r.best), X + W * 0.68, y, { color: 0xd8d4e8 });
      drawText(ctx, r.prize + ' KR', X + W - 10, y, { color: 0xffe080, align: 'r' });
    });
    const y = 46 + res.rows.length * 12 + 6;
    drawText(ctx, `PRIS ${res.prize} KR  +  UPPLOCKAT ${res.pickup} KR  =  ${res.money} KR`, VW / 2, y, { color: 0xffe080, align: 'c' });
    drawText(ctx, `I KASSAN: ${save.money} KR`, VW / 2, y + 12, { big: true, grad: GRAD.gold, align: 'c' });
    drawText(ctx, `UTSLAGNA BILAR: ${res.kills || 0}   ÖVERKÖRDA DJUR: ${res.roadkill || 0}`, VW / 2, y + 26, { color: 0xd8d4e8, align: 'c' });
  }
  if (((t * 2) | 0) % 2) drawText(ctx, input.touch ? 'TRYCK FÖR ATT FORTSÄTTA' : 'TRYCK ENTER', VW / 2, VH - 16, { color: 0xffffff, align: 'c' });
}
function drawStandings(t, X, W) {
  const res = G.results;
  const ch = save.champ;
  const ce = res.champEnd;
  const order = ce ? ce.order : Object.entries(ch.pts).sort((a, b) => b[1] - a[1]);
  const cup = ce ? ce.cup : CUPS.find((c) => c.id === ch.cup);
  panel(ctx, X, 14, W, 40 + order.length * 12 + (ce ? 40 : 10));
  drawText(ctx, cup.name + (ce ? ' – SLUTSTÄLLNING' : ' – STÄLLNING'), VW / 2, 22, { big: true, grad: GRAD.gold, align: 'c' });
  order.forEach(([n, p], k) => {
    const y = 40 + k * 12, me = n === 'Du';
    if (me) { ctx.fillStyle = 'rgba(200,38,46,0.7)'; ctx.fillRect(X + 4, y - 3, W - 8, 11); }
    drawText(ctx, ordinal(k + 1), X + 10, y, { color: k === 0 ? 0xffd040 : 0xffffff });
    drawText(ctx, me ? 'DU' : n.toUpperCase(), X + 34, y, { color: 0xffffff });
    drawText(ctx, p + ' P', X + W - 10, y, { color: 0xffe080, align: 'r' });
  });
  if (ce) {
    const y = 40 + order.length * 12 + 8;
    if (ce.place === 1 && ((t * 3) | 0) % 2) drawText(ctx, 'DU ÄR KURVKUNGEN!', VW / 2, y, { big: true, scale: 2, grad: GRAD.fire, align: 'c' });
    else if (ce.place > 1) drawText(ctx, ordinal(ce.place) + ' I CUPEN', VW / 2, y, { big: true, grad: GRAD.white, align: 'c' });
    if (ce.bonus) drawText(ctx, `CUPBONUS +${ce.bonus} KR`, VW / 2, y + 22, { color: 0xffe080, align: 'c' });
  }
  if (((t * 2) | 0) % 2) drawText(ctx, input.touch ? 'TRYCK FÖR ATT FORTSÄTTA' : 'TRYCK ENTER', VW / 2, VH - 16, { color: 0xffffff, align: 'c' });
}
function resultsNext() {
  const res = G.results;
  sfx('ok');
  if (res.gpQuali) { startGPRace(res.cfg.gp, res.grid); return; }
  if (res.gpRace) { if (res.cfg.gp.season) { G.results = { gpStand: true, final: res.seasonEnd, back: gpBack }; G.state = 'standings'; } else gpBack(); return; }
  if (res.gpStand) { res.back(); return; }
  if (res.standings) { if (res.back) res.back(); else afterRace(); return; }
  if (res.cfg.champ) { G.results = { standings: true, champEnd: res.champEnd, back: res.champEnd ? null : () => { startAttract(); preRace(); } }; if (!res.champEnd && !save.champ) { afterRace(); return; } return; }
  afterRace();
}
function afterRace() {
  if (NET.role) { G.results = null; startAttract(); openLobby(); startMusic('menu'); return; }
  // tillbaka till menyn med loppets bana som bakgrund
  G.results = null;
  startAttract();
  G.menu = mainMenu(); G.state = 'menu';
  startMusic('menu');
}

// ---------- Grand Prix ----------
const GP_LEVELS = ['LÄTT', 'MEDEL', 'SVÅR'], GP_SKILL = [0.8, 0.9, 1.0];
const TYRE_INFO = { soft: 'SNABBAST MEN SLITS FORT', medium: 'BALANSERAT GREPP OCH SLITAGE', hard: 'LÅNGSAMMAST MEN HÅLLER LÄNGE' };
function gpSave() {
  if (!save.gp) save.gp = { team: 'papaya', seat: 0, track: 0, night: false, laps: 5, quali: true, start: 'medium', level: 1, season: null };
  return save.gp;
}
// alla 22 förare; spelaren tar en av stallets platser
function gpField(o) {
  const out = [];
  TEAMS.forEach((tm) => tm.drivers.forEach(([name, code, skill], seat) => {
    if (tm.id === o.team && seat === o.seat) out.push({ f1: true, team: tm.id, seat, name: 'Du', code: 'DU', skill: 0.88 * GP_SKILL[o.level ?? 1], compound: o.start || 'medium', isPlayer: true });
    else out.push({ f1: true, team: tm.id, seat, name, code, skill: skill * GP_SKILL[o.level ?? 1], compound: 'medium' });
  }));
  return out;
}
// startordning ur kvaltider: datorförarnas uppskattas ur bil och förare, spelarens körs på riktigt
function gpGrid(T, o, myTime) {
  const field = gpField(o);
  for (const c of field) {
    if (c.isPlayer && myTime !== undefined) c.q = myTime || Infinity;
    else c.q = lapEstimate(T, f1Stats(teamById(c.team).perf), c.skill) * (1 + (Math.random() - 0.5) * 0.016);
  }
  return field.sort((a, b) => a.q - b.q);
}
function startGP(o) {
  const id = o.track + (o.night ? '_n' : '');
  if (o.quali) return startRace({ track: id, laps: 3, mode: 'time', f1: true, quali: true, gp: o, wearLaps: o.laps, autopilot: o.autopilot, carsList: gpField(o).filter((c) => c.isPlayer).map((c) => ({ ...c, compound: 'soft' })) });
  return startRace({ track: id, laps: o.laps, mode: 'race', f1: true, gp: o, wearLaps: o.laps, autopilot: o.autopilot, gpGrid: (T) => gpGrid(T, o) });
}
function startGPRace(o, grid) {
  return startRace({ track: o.track + (o.night ? '_n' : ''), laps: o.laps, mode: 'race', f1: true, gp: o, wearLaps: o.laps, autopilot: o.autopilot, carsList: grid.map(({ q, ...c }) => c) });
}
function gpBack() {
  G.results = null;
  stopEngines();
  startAttract();
  G.menu = gpSave().season ? seasonMenu() : gpMenu(); G.state = 'gp';
  startMusic('menu');
  layoutTouch();
}
const lapsItem = (o) => ({
  label: 'VARV', value: () => o.laps,
  left: () => { const i = LAP_OPTIONS.indexOf(o.laps); o.laps = LAP_OPTIONS[Math.max(0, (i < 0 ? 1 : i) - 1)]; persist(); },
  right: () => { const i = LAP_OPTIONS.indexOf(o.laps); o.laps = LAP_OPTIONS[Math.min(LAP_OPTIONS.length - 1, i + 1)]; persist(); },
  info: () => (o.laps < 3 ? 'UNDER 3 VARV: INGET DEPÅKRAV' : ['DÄCKEN SLITS SOM I ETT HELT LOPP –', 'MINST ETT DEPÅSTOPP OCH TVÅ BLANDNINGAR KRÄVS']),
});
const tyreItem = (g) => ({
  label: 'STARTDÄCK', value: () => COMPOUNDS[g.start].name, vcol: () => COMPOUNDS[g.start].color,
  left: () => { g.start = COMPOUND_ORDER[(COMPOUND_ORDER.indexOf(g.start) + 2) % 3]; persist(); },
  right: () => { g.start = COMPOUND_ORDER[(COMPOUND_ORDER.indexOf(g.start) + 1) % 3]; persist(); },
  info: () => TYRE_INFO[g.start],
});
const qualiItem = (o) => ({
  label: 'KVAL', value: () => (o.quali ? 'JA' : 'NEJ'), ok: () => { o.quali = !o.quali; persist(); }, left: () => { o.quali = !o.quali; persist(); }, right: () => { o.quali = !o.quali; persist(); },
  info: () => (o.quali ? 'TRE VARV ENSAM PÅ MJUKA DÄCK – BÄSTA VARVET GER STARTRUTAN' : 'STARTRUTA EFTER BILENS STYRKA'),
});
function gpMenu() {
  const g = gpSave();
  const ti = () => TEAMS.findIndex((t) => t.id === g.team);
  const cyc = (d) => { g.team = TEAMS[(ti() + d + TEAMS.length) % TEAMS.length].id; persist(); };
  const seat = () => { g.seat ^= 1; persist(); };
  const items = [
    { label: 'STALL', value: () => teamById(g.team).name.toUpperCase(), left: () => cyc(-1), right: () => cyc(1), ok: () => cyc(1), info: () => 'DAGENS STALL – EGNA NAMN, SAMMA FÄRGER' },
    { label: 'DU ERSÄTTER', value: () => teamById(g.team).drivers[g.seat][0].toUpperCase(), left: seat, right: seat, ok: seat, info: () => 'STALLKAMRAT: ' + teamById(g.team).drivers[g.seat ^ 1][0].toUpperCase() },
    { label: 'MOTSTÅND', value: () => GP_LEVELS[g.level ?? 1], left: () => { g.level = Math.max(0, (g.level ?? 1) - 1); persist(); }, right: () => { g.level = Math.min(2, (g.level ?? 1) + 1); persist(); } },
  ];
  if (g.season) items.push({ label: 'FORTSÄTT SÄSONGEN', value: () => `${g.season.race + 1}/${GP_ORDER.length}`, ok: () => { sfx('ok'); G.menu = seasonMenu(); }, info: () => teamById(g.season.team).name.toUpperCase() + ' · ' + g.season.laps + ' VARV PER LOPP' });
  items.push(
    { label: 'NY SÄSONG', ok: () => { sfx('ok'); G.menu = newSeasonMenu(); }, info: () => [`${GP_ORDER.length} GRAND PRIX. POÄNG 25-18-15-12-10-8-6-4-2-1.`, 'FÖRAR- OCH KONSTRUKTÖRSMÄSTERSKAP.'] },
    { label: 'ENSTAKA GRAND PRIX', ok: () => { sfx('ok'); G.menu = gpQuickMenu(); }, info: () => 'VÄLJ BANA, VARV, KVAL OCH STARTDÄCK' },
    { label: 'TILLBAKA', ok: backToMain },
  );
  return new Menu('GRAND PRIX', items, { w: 250, back: backToMain, rowH: 14 });
}
function gpQuickMenu() {
  const g = gpSave();
  const back = () => { sfx('back'); G.menu = gpMenu(); };
  const tr = (d) => { g.track = (g.track + d + GP_ORDER.length) % GP_ORDER.length; persist(); };
  return new Menu('ENSTAKA GRAND PRIX', [
    { label: 'BANA', value: () => TRACKS[GP_ORDER[g.track]].name.toUpperCase(), left: () => tr(-1), right: () => tr(1), info: () => THEMES[TRACKS[GP_ORDER[g.track]].theme].name.toUpperCase() },
    { label: 'TID', value: () => (g.night ? 'NATT' : 'DAG'), ok: () => { g.night = !g.night; persist(); }, left: () => { g.night = !g.night; persist(); }, right: () => { g.night = !g.night; persist(); }, info: () => (g.night ? 'NATTLOPP UNDER STRÅLKASTARNA' : '') },
    lapsItem(g), qualiItem(g), tyreItem(g),
    { label: 'KÖR!', ok: () => { sfx('ok'); startGP({ track: GP_ORDER[g.track], night: g.night, laps: g.laps, quali: g.quali, start: g.start, team: g.team, seat: g.seat, level: g.level ?? 1 }); } },
    { label: 'TILLBAKA', ok: back },
  ], { w: 250, back, rowH: 14 });
}
function newSeasonMenu() {
  const g = gpSave();
  const back = () => { sfx('back'); G.menu = gpMenu(); };
  return new Menu('NY SÄSONG', [
    { label: 'STALL', value: () => teamById(g.team).name.toUpperCase() },
    lapsItem(g), qualiItem(g),
    {
      label: 'STARTA SÄSONGEN', ok: () => {
        sfx('ok');
        const s = { team: g.team, seat: g.seat, level: g.level ?? 1, laps: g.laps, quali: g.quali, race: 0, pts: {}, cpts: {}, res: [] };
        for (const c of gpField(s)) s.pts[c.code] = 0;
        for (const tm of TEAMS) s.cpts[tm.id] = 0;
        g.season = s; persist();
        G.menu = seasonMenu();
      },
      info: () => (g.season ? 'DIN PÅGÅENDE SÄSONG ERSÄTTS' : `${GP_ORDER.length} LOPP MED ${teamById(g.team).name.toUpperCase()}`),
    },
    { label: 'TILLBAKA', ok: back },
  ], { w: 250, back, rowH: 14 });
}
function seasonMenu() {
  const g = gpSave(), s = g.season;
  const tr = GP_ORDER[s.race], night = tr === 'hamnslingan';
  let confirm = false;
  const back = () => { sfx('back'); G.menu = gpMenu(); };
  const m = new Menu(`SÄSONG – LOPP ${s.race + 1} AV ${GP_ORDER.length}`, [
    { label: s.quali ? 'TILL KVALET!' : 'KÖR!', value: () => TRACKS[tr].name.toUpperCase() + (night ? ' (NATT)' : ''), ok: () => { sfx('ok'); startGP({ track: tr, night, laps: s.laps, quali: s.quali, start: g.start, team: s.team, seat: s.seat, level: s.level, season: true }); }, info: () => `${s.laps} VARV` + (night ? ' · NATTLOPP I HAMNEN' : '') },
    tyreItem(g),
    { label: 'STÄLLNING', ok: () => { sfx('ok'); G.results = { gpStand: true, back: () => { G.results = null; G.state = 'gp'; G.menu = seasonMenu(); } }; G.state = 'standings'; } },
    { label: 'AVBRYT SÄSONGEN', value: () => (confirm ? 'SÄKER?' : ''), ok: () => { if (!confirm) { confirm = true; sfx('deny'); return; } sfx('back'); g.season = null; persist(); G.menu = gpMenu(); } },
    { label: 'TILLBAKA', ok: back },
  ], { w: 250, back, rowH: 14 });
  m.gpTeam = s.team;
  return m;
}
const gpCars = new Map();
function drawGP(t) {
  const m = G.menu, g = gpSave();
  dimBg(0.55);
  const r = m.draw(ctx, VW, VH, t, VW - 258, 8, 250);
  const tm = teamById(m.gpTeam || g.team);
  const LW = Math.max(150, VW - 258 - 16), LX = 8, LH = Math.max(r.H, 188);
  panel(ctx, LX, 8, LW, LH, 'rgba(20,16,40,0.78)', '#6a6488');
  drawText(ctx, tm.name.toUpperCase(), LX + LW / 2, 14, { big: true, grad: GRAD.gold, align: 'c' });
  const sw = Math.min(LW - 40, 120), sx = Math.round(LX + LW / 2 - sw / 2);
  [tm.c1, tm.c2, tm.c3].forEach((c, k) => { ctx.fillStyle = css(c); ctx.fillRect(sx + Math.round(k * sw / 3), 30, Math.round(sw / 3), 3); });
  // bilen på en snurrande platta
  const px = LX + Math.round(LW / 2), py = 8 + Math.round(LH * 0.36);
  const look = { pal: { paint: tm.c1, paint2: tm.c2, stripe: tm.c3 }, tyre: COMPOUNDS[g.start].color };
  const k = Math.round(((t * 0.55) % (Math.PI * 2)) / (Math.PI * 2) * 32) % 32;
  const key = tm.id + g.start + ':' + k;
  if (!gpCars.has(key)) { if (gpCars.size > 200) gpCars.clear(); gpCars.set(key, renderCar('f1', look, k / 32 * Math.PI * 2, 2)); }
  const spr = gpCars.get(key);
  ctx.fillStyle = '#2a2640'; for (let y = -10; y <= 10; y++) { const w = Math.round(Math.sqrt(100 - y * y) * 4.4); ctx.fillRect(px - w, py + 22 + Math.round(y / 2), w * 2, 1); }
  ctx.fillStyle = '#3c3858'; for (let y = -9; y <= 9; y++) { const w = Math.round(Math.sqrt(81 - y * y) * 4.4); ctx.fillRect(px - w, py + 21 + Math.round(y / 2), w * 2, 1); }
  ctx.drawImage(spr, px - spr.ox, py + 22 - spr.oy);
  // förarna
  const seat = m.gpTeam ? g.season.seat : g.seat;
  let y = 8 + LH - 82;
  tm.drivers.forEach(([name, code], k) => {
    const me = k === seat;
    drawText(ctx, me ? 'DU' : name.toUpperCase(), LX + 10, y, { color: me ? 0xffe080 : 0xffffff });
    drawText(ctx, me ? '(ERSÄTTER ' + name.toUpperCase() + ')' : code, LX + LW - 10, y, { color: 0x9a94b0, align: 'r' });
    y += 9;
  });
  // bilens styrka och stallkamratens skicklighet jämfört med fältet
  const mate = tm.drivers[seat ^ 1];
  const rows = [['BILEN', (tm.perf - 0.72) / 0.26], ['STALLKAMRAT', (mate[2] - 0.66) / 0.32]];
  const bw = LW - 86;
  y += 3;
  rows.forEach(([n, v]) => {
    const f = Math.round(bw * Math.max(0.06, Math.min(1, v)));
    drawText(ctx, n, LX + 10, y, { color: 0xd8d4e8 });
    ctx.fillStyle = '#2a2640'; ctx.fillRect(LX + 78, y - 1, bw, 6);
    ctx.fillStyle = css(tm.c1 === 0x111114 ? tm.c3 : tm.c1); ctx.fillRect(LX + 78, y - 1, f, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(LX + 78, y - 1, f, 1);
    y += 9;
  });
  drawText(ctx, input.touch ? 'DRS · BOX · DÄCK = KNAPPARNA I LOPPET' : 'MELLANSLAG = DRS · B = BOXA · 1/2/3 = DÄCK', LX + LW / 2, 8 + LH - 12, { color: 0x9a94b0, align: 'c' });
}

// resultat: kval, lopp och mästerskap
function gpResults() {
  const R = G.race, cfg = G.cfg, P = R.player, o = cfg.gp;
  if (P.bestLap && (!save.records[cfg.track] || P.bestLap < save.records[cfg.track])) save.records[cfg.track] = P.bestLap;
  if (cfg.quali) {
    G.results = { gpQuali: true, cfg, grid: gpGrid(R.T, o, P.bestLap || Infinity), laps: P.lapTimes, best: P.bestLap };
    persist(); G.state = 'results'; startMusic('menu');
    return;
  }
  const order = R.finishOrder, lead = order[0], lapT = lead.finishTime / R.laps;
  let fastest = null;
  for (const c of order) if (c.bestLap && (!fastest || c.bestLap < fastest.bestLap)) fastest = c;
  const rows = order.map((c, k) => {
    const gap = c.finishTime - lead.finishTime;
    return { name: c.isPlayer ? 'DU' : c.name.toUpperCase(), code: c.code, team: c.team, time: c.finishTime, gap, down: Math.max(0, Math.floor((R.laps * R.T.L - c.progress) / R.T.L)), best: c.bestLap, stops: c.stops, tyres: [...c.used], pts: F1_POINTS[k] || 0, me: c.isPlayer, pen: c.penalty || 0, fl: c === fastest };
  });
  const me = rows.find((r) => r.me), place = rows.indexOf(me) + 1;
  const money = 100 + me.pts * 40;
  save.money += money;
  const res = { gpRace: true, cfg, rows, place, money };
  const g = gpSave(), s = g.season;
  if (o.season && s) {
    for (const r of rows) { s.pts[r.code] = (s.pts[r.code] || 0) + r.pts; s.cpts[r.team] = (s.cpts[r.team] || 0) + r.pts; }
    s.res.push(place);
    s.race++;
    if (s.race >= GP_ORDER.length) {
      const dOrder = Object.entries(s.pts).sort((a, b) => b[1] - a[1]), cOrder = Object.entries(s.cpts).sort((a, b) => b[1] - a[1]);
      res.seasonEnd = { ...s, place: dOrder.findIndex(([c]) => c === 'DU') + 1, cplace: cOrder.findIndex(([id]) => id === s.team) + 1 };
      res.seasonEnd.bonus = [5000, 3000, 2000][res.seasonEnd.place - 1] || 500;
      save.money += res.seasonEnd.bonus;
      g.titles = g.titles || [];
      if (res.seasonEnd.place === 1) g.titles.push(s.team);
      g.season = null;
    }
  }
  persist();
  G.results = res; G.state = 'results';
  startMusic('menu');
}
const N = { outline: null, shadow: false };
function gpRowBase(X, y, W, k, team, me) {
  if (me) { ctx.fillStyle = 'rgba(200,38,46,0.8)'; ctx.fillRect(X + 3, y - 1, W - 6, 8); }
  else if (k % 2) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(X + 3, y - 1, W - 6, 8); }
  drawText(ctx, String(k + 1), X + 18, y, { color: k === 0 ? 0xffd040 : 0xffffff, align: 'r', ...N });
  ctx.fillStyle = css(teamById(team).c1); ctx.fillRect(X + 22, y, 2, 6);
  ctx.fillStyle = css(teamById(team).c3); ctx.fillRect(X + 24, y, 1, 6);
}
function drawGPQuali(t) {
  const res = G.results, grid = res.grid;
  dimBg(0.62);
  const W = Math.min(VW - 16, 330), X = Math.round(VW / 2 - W / 2);
  const rh = Math.max(7, Math.min(9, Math.floor((VH - 70) / grid.length)));
  panel(ctx, X, 6, W, 34 + grid.length * rh + 8);
  drawText(ctx, 'KVAL – ' + trackName(res.cfg.track), VW / 2, 12, { big: true, grad: GRAD.gold, align: 'c' });
  drawText(ctx, 'FÖRARE', X + 28, 28, { color: 0x9a94b0, ...N }); drawText(ctx, 'STALL', X + W * 0.47, 28, { color: 0x9a94b0, ...N }); drawText(ctx, 'TID', X + W * 0.66, 28, { color: 0x9a94b0, ...N });
  const p0 = grid[0].q;
  grid.forEach((c, k) => {
    const y = 38 + k * rh;
    gpRowBase(X, y, W, k, c.team, c.isPlayer);
    drawText(ctx, c.isPlayer ? 'DU' : c.name.toUpperCase(), X + 28, y, { color: 0xffffff, ...N });
    drawText(ctx, teamById(c.team).short, X + W * 0.47, y, { color: 0xc8c0d8, ...N });
    drawText(ctx, isFinite(c.q) ? fmtTime(c.q) : 'INGEN TID', X + W * 0.66, y, { color: 0xffffff, ...N });
    if (k && isFinite(c.q)) drawText(ctx, '+' + (c.q - p0).toFixed(3), X + W - 8, y, { color: 0xd8d4e8, align: 'r', ...N });
  });
  const mine = grid.findIndex((c) => c.isPlayer) + 1;
  const msg = mine === 1 ? 'POLE POSITION!' : `DU STARTAR ${ordinal(mine)}`;
  if (mine > 1 || ((t * 3) | 0) % 2) drawText(ctx, msg, VW / 2, Math.min(VH - 30, 38 + grid.length * rh + 12), { big: true, grad: mine === 1 ? GRAD.fire : GRAD.white, align: 'c' });
  if (((t * 2) | 0) % 2) drawText(ctx, input.touch ? 'TRYCK FÖR ATT GÅ TILL STARTEN' : 'ENTER – TILL STARTEN', VW / 2, VH - 12, { color: 0xffffff, align: 'c' });
}
function drawGPResults(t) {
  const res = G.results, rows = res.rows;
  dimBg(0.62);
  const W = Math.min(VW - 12, 420), X = Math.round(VW / 2 - W / 2);
  const rh = Math.max(7, Math.min(9, Math.floor((VH - 76) / rows.length)));
  panel(ctx, X, 6, W, 34 + rows.length * rh + 22);
  drawText(ctx, 'RESULTAT – ' + trackName(res.cfg.track), VW / 2, 12, { big: true, grad: GRAD.gold, align: 'c' });
  const cx = [X + 28, X + W * 0.33, X + W * 0.47, X + W * 0.63, X + W * 0.79, X + W - 8];
  drawText(ctx, 'FÖRARE', cx[0], 28, { color: 0x9a94b0, ...N }); drawText(ctx, 'STALL', cx[1], 28, { color: 0x9a94b0, ...N }); drawText(ctx, 'TID', cx[2], 28, { color: 0x9a94b0, ...N });
  drawText(ctx, 'BÄSTA VARV', cx[3], 28, { color: 0x9a94b0, ...N }); drawText(ctx, 'DÄCK', cx[4], 28, { color: 0x9a94b0, ...N }); drawText(ctx, 'P', cx[5], 28, { color: 0x9a94b0, align: 'r', ...N });
  rows.forEach((r, k) => {
    const y = 38 + k * rh;
    gpRowBase(X, y, W, k, r.team, r.me);
    drawText(ctx, r.name, cx[0], y, { color: 0xffffff, ...N });
    drawText(ctx, teamById(r.team).short, cx[1], y, { color: 0xc8c0d8, ...N });
    drawText(ctx, k === 0 ? fmtTime(r.time) : r.down ? `+${r.down} V` : '+' + r.gap.toFixed(1) + (r.pen ? ' (S)' : ''), cx[2], y, { color: r.pen ? 0xffa060 : 0xffffff, ...N });
    drawText(ctx, fmtTime(r.best), cx[3], y, { color: r.fl ? 0xd070ff : 0xd8d4e8, ...N });
    r.tyres.forEach((c, i) => { ctx.fillStyle = css(COMPOUNDS[c].color); ctx.fillRect(cx[4] + i * 6, y + 1, 4, 4); });
    drawText(ctx, String(r.stops), cx[4] + 22, y, { color: 0x9a94b0, ...N });
    if (r.pts) drawText(ctx, String(r.pts), cx[5], y, { color: 0xffe080, align: 'r', ...N });
  });
  const y = 38 + rows.length * rh + 4;
  drawText(ctx, `LILA = SNABBASTE VARVET · SIFFRAN = ANTAL STOPP · (S) = STRAFF · +${res.money} KR`, VW / 2, y, { color: 0xd8d4e8, align: 'c', ...N });
  const msg = res.place === 1 ? 'SEGER!' : res.place <= 3 ? `PALLEN – ${ordinal(res.place)}!` : ordinal(res.place) + ' PLATS';
  if (res.place > 1 || ((t * 3) | 0) % 2) drawText(ctx, msg, VW / 2, Math.min(VH - 28, y + 12), { big: true, grad: res.place === 1 ? GRAD.fire : res.place <= 3 ? GRAD.gold : GRAD.white, align: 'c' });
  if (((t * 2) | 0) % 2) drawText(ctx, input.touch ? 'TRYCK FÖR ATT FORTSÄTTA' : 'TRYCK ENTER', VW / 2, VH - 12, { color: 0xffffff, align: 'c' });
}
function drawGPStandings(t) {
  const res = G.results, s = res.final || gpSave().season;
  dimBg(0.62);
  if (!s) return;
  const names = {};
  for (const c of gpField(s)) names[c.code] = c;
  const dOrder = Object.entries(s.pts).sort((a, b) => b[1] - a[1]), cOrder = Object.entries(s.cpts).sort((a, b) => b[1] - a[1]);
  const W1 = Math.min(230, Math.floor((VW - 24) * 0.55)), W2 = Math.min(190, VW - 24 - W1);
  const X1 = Math.round(VW / 2 - (W1 + W2 + 8) / 2), X2 = X1 + W1 + 8;
  const rh = Math.max(7, Math.min(9, Math.floor((VH - 70) / dOrder.length)));
  panel(ctx, X1, 6, W1, 30 + dOrder.length * rh + 6);
  panel(ctx, X2, 6, W2, 30 + cOrder.length * rh + 6);
  drawText(ctx, 'FÖRARE', X1 + W1 / 2, 12, { big: true, grad: GRAD.gold, align: 'c' });
  drawText(ctx, 'KONSTRUKTÖRER', X2 + W2 / 2, 12, { big: true, grad: GRAD.gold, align: 'c' });
  drawText(ctx, `EFTER ${s.race} AV ${GP_ORDER.length} LOPP`, X1 + W1 / 2, 26, { color: 0x9a94b0, align: 'c', ...N });
  dOrder.forEach(([code, p], k) => {
    const y = 36 + k * rh, c = names[code] || { team: 'tjur', name: code };
    gpRowBase(X1, y, W1, k, c.team, code === 'DU');
    drawText(ctx, code === 'DU' ? 'DU' : c.name.toUpperCase(), X1 + 28, y, { color: 0xffffff, ...N });
    drawText(ctx, String(p), X1 + W1 - 8, y, { color: 0xffe080, align: 'r', ...N });
  });
  cOrder.forEach(([id, p], k) => {
    const y = 36 + k * rh;
    gpRowBase(X2, y, W2, k, id, id === s.team);
    drawText(ctx, teamById(id).name.toUpperCase(), X2 + 28, y, { color: 0xffffff, ...N });
    drawText(ctx, String(p), X2 + W2 - 8, y, { color: 0xffe080, align: 'r', ...N });
  });
  const F = res.final;
  if (F) {
    const y = 36 + cOrder.length * rh + 14, cx = X2 + W2 / 2;
    if (F.place === 1) { if (((t * 3) | 0) % 2) drawText(ctx, 'VÄRLDSMÄSTARE!', cx, y, { big: true, grad: GRAD.fire, align: 'c' }); }
    else drawText(ctx, ordinal(F.place) + ' I VM', cx, y, { big: true, grad: GRAD.white, align: 'c' });
    if (F.cplace === 1) drawText(ctx, 'STALLET TOG KONSTRUKTÖRSTITELN!', cx, y + 18, { color: 0xffe080, align: 'c' });
    drawText(ctx, `SÄSONGSBONUS +${F.bonus} KR`, cx, y + 28, { color: 0xffe080, align: 'c' });
  }
  if (((t * 2) | 0) % 2) drawText(ctx, input.touch ? 'TRYCK FÖR ATT FORTSÄTTA' : 'TRYCK ENTER', VW / 2, VH - 12, { color: 0xffffff, align: 'c' });
}

// ---------- online ----------
const NET = { role: null, host: null, client: null, code: '', players: [], lobby: { track: 0, rev: false, night: false, laps: 3, ai: 3 }, mirror: null, pidCar: {}, sendT: 0, snapT: 0, err: '', typed: '', ready: new Set(), inRace: false };
const NAMES = ['KURV-KALLE', 'SLADD-STINA', 'TURBO-TAGE', 'GAS-GRETA', 'PLÅT-PER', 'NITRO-NORA', 'DÄCK-DANNE', 'KROCK-KAJSA', 'VRÅL-VERA', 'BROMS-BOSSE', 'ÄLG-ELSA', 'MOS-MATTE'];
const myName = () => save.settings.name || (save.settings.name = NAMES[(Math.random() * NAMES.length) | 0]);
const NET_EVENTS = new Set(['count', 'go', 'lap', 'finish', 'wreck', 'splash', 'crash', 'bump', 'pick', 'gun', 'missile', 'boom', 'rear', 'nitro', 'oil', 'cone', 'hit', 'rescue', 'cannon', 'laser', 'flame', 'zap', 'spike', 'glue', 'splat', 'animal', 'moose', 'thud', 'fell', 'lava', 'land']);
function ser(R, x) {
  if (x == null || typeof x !== 'object') return x ?? null;
  const ci = R.cars.indexOf(x);
  if (ci >= 0) return { c: ci };
  if ('x' in x) return { x: Math.round(x.x), y: Math.round(x.y), z: Math.round(x.z || 0), vx: x.vx ? Math.round(x.vx) : 0, vy: x.vy ? Math.round(x.vy) : 0, type: x.type };
  return null;
}
function deser(R, x) { if (x == null || typeof x !== 'object') return x; if ('c' in x) return R.cars[x.c]; return x; }
function onlineMenu() {
  return new Menu('SPELA ONLINE', [
    { label: 'SKAPA RUM', ok: () => { sfx('ok'); hostRoom(); }, info: () => 'DU BLIR VÄRD. KOMPISARNA SKRIVER IN KODEN.' },
    { label: 'GÅ MED I RUM', ok: () => { sfx('ok'); NET.typed = ''; NET.err = ''; G.state = 'code'; layoutTouch(); }, info: () => 'SKRIV IN KODEN DU FÅTT AV VÄRDEN.' },
    { label: 'DITT NAMN', value: () => myName(), left: () => { const i = NAMES.indexOf(myName()); save.settings.name = NAMES[(i + NAMES.length - 1) % NAMES.length]; persist(); }, right: () => { const i = NAMES.indexOf(myName()); save.settings.name = NAMES[(i + 1) % NAMES.length]; persist(); } },
    { label: 'TILLBAKA', ok: backToMain },
  ], { w: 240, back: backToMain });
}
function myCfg() { const c = playerCarCfg(); return { ...c, name: myName(), isPlayer: false }; }
async function hostRoom() {
  G.state = 'loading'; G.msg = 'SKAPAR RUM'; G.loadP = 0.5;
  const H = new Host();
  try { await H.open(); } catch (e) { NET.err = 'KUNDE INTE SKAPA RUM: ' + String(e.message || e).toUpperCase(); G.menu = onlineMenu(); G.state = 'sub'; G.hud && G.hud.say(NET.err, 3, GRAD.red, false); return; }
  Object.assign(NET, { role: 'host', host: H, code: H.code, players: [{ pid: 0, name: myName(), cfg: myCfg() }], inRace: false, ready: new Set() });
  H.onJoin = () => {};
  H.onLeave = (pid) => {
    NET.players = NET.players.filter((p) => p.pid !== pid);
    const R = G.race;
    if (NET.inRace && R && NET.pidCar[pid] != null) { const c = R.cars[NET.pidCar[pid]]; c.human = false; c.ai = makeAI(0.5); G.hud.say(c.name.toUpperCase() + ' LÄMNADE', 2, GRAD.white, false); }
    lobbyBroadcast();
  };
  H.onMsg = (pid, m) => {
    if (m.t === 'hello') {
      if (NET.inRace) { H.send(pid, { t: 'busy' }); return; }
      if (NET.players.length >= 8) { H.send(pid, { t: 'full' }); return; }
      NET.players.push({ pid, name: String(m.name || 'GÄST').slice(0, 14).toUpperCase(), cfg: m.cfg });
      sfx('pick'); lobbyBroadcast();
    } else if (m.t === 'i') {
      const R = G.race, k = NET.pidCar[pid];
      if (!R || k == null || !NET.inRace) return;
      const c = R.cars[k];
      if (!c || !c.human) return;
      c.inp.steer = Math.max(-1, Math.min(1, +m.s || 0)); c.inp.gas = m.g ? 1 : 0; c.inp.brake = m.b ? 1 : 0; c.inp.fire = !!m.f; c.inp.rear = !!m.r; c.inp.nitro = !!m.n;
    } else if (m.t === 'h') { const R = G.race, c = R && R.cars[NET.pidCar[pid]]; if (c && c.st.horn) R.animals.scare(c.x, c.y, 160); }
    else if (m.t === 'reset') { const R = G.race, c = R && R.cars[NET.pidCar[pid]]; if (c && R.phase === 'race' && c.wreckT <= 0) R.respawn(c); }
    else if (m.t === 'ready') NET.ready.add(pid);
  };
  openLobby();
}
const lobbyTrack = () => BASE_TRACKS[NET.lobby.track] + (NET.lobby.rev ? '_r' : '') + (NET.lobby.night ? '_n' : '');
function lobbyBroadcast() {
  if (NET.role !== 'host') return;
  NET.host.broadcast({ t: 'lobby', code: NET.code, players: NET.players.map((p) => ({ name: p.name, carId: p.cfg.carId, color: p.cfg.color })), track: lobbyTrack(), laps: NET.lobby.laps, ai: NET.lobby.ai });
}
function openLobby() {
  G.state = 'lobby';
  if (NET.role === 'host') {
    const L = NET.lobby, ch = () => { lobbyBroadcast(); };
    G.menu = new Menu('RUM ' + NET.code, [
      { label: 'BANA', value: () => TRACKS[BASE_TRACKS[L.track]].name.toUpperCase(), left: () => { L.track = (L.track + BASE_TRACKS.length - 1) % BASE_TRACKS.length; ch(); }, right: () => { L.track = (L.track + 1) % BASE_TRACKS.length; ch(); } },
      { label: 'RIKTNING', value: () => (L.rev ? 'BAKLÄNGES' : 'FRAMÅT'), left: () => { L.rev = !L.rev; ch(); }, right: () => { L.rev = !L.rev; ch(); }, ok: () => { L.rev = !L.rev; ch(); } },
      { label: 'TID', value: () => (L.night ? 'NATT' : 'DAG'), left: () => { L.night = !L.night; ch(); }, right: () => { L.night = !L.night; ch(); }, ok: () => { L.night = !L.night; ch(); } },
      { label: 'VARV', value: () => L.laps, left: () => { L.laps = Math.max(1, L.laps - 1); ch(); }, right: () => { L.laps = Math.min(9, L.laps + 1); ch(); } },
      { label: 'DATORBILAR', value: () => L.ai, left: () => { L.ai = Math.max(0, L.ai - 1); ch(); }, right: () => { L.ai = Math.min(7, L.ai + 1); ch(); } },
      { label: 'STARTA LOPPET!', ok: () => { sfx('ok'); hostStart(); }, info: () => `${NET.players.length} SPELARE + ${L.ai} DATORBILAR` },
      { label: 'STÄNG RUMMET', ok: () => { sfx('back'); leaveOnline(); } },
    ], { w: 230, back: () => leaveOnline(), rowH: 14 });
    lobbyBroadcast();
  } else {
    G.menu = new Menu('RUM ' + NET.code, [
      { label: 'GARAGET', ok: () => { sfx('ok'); openGarage(() => { NET.client.send({ t: 'hello', name: myName(), cfg: myCfg() }); openLobby(); }); }, info: () => 'BYT FORDON INNAN VÄRDEN STARTAR' },
      { label: 'LÄMNA RUMMET', ok: () => { sfx('back'); leaveOnline(); } },
    ], { w: 230, back: () => leaveOnline() });
  }
  layoutTouch();
}
function hostStart() {
  const L = NET.lobby;
  const track = lobbyTrack();
  const humans = NET.players.map((p) => ({ ...p.cfg, name: p.name, human: p.pid !== 0, isPlayer: false, pid: p.pid }));
  // samma färg på två spelare? ge den senare en ledig färg
  const used = new Set();
  for (const h of humans) { if (used.has(h.color)) h.color = CAR_COLORS.find((c) => !used.has(c)) ?? h.color; used.add(h.color); }
  const ai = (L.ai ? makeOpponents(CUPS[1], L.ai) : []).map((o) => (used.has(o.color) ? { ...o, color: CAR_COLORS.find((c) => !used.has(c) && (used.add(c), true)) ?? o.color } : (used.add(o.color), o)));
  const list = [...ai, ...humans.sort(() => Math.random() - 0.5)];
  NET.pidCar = {};
  list.forEach((c, k) => { if (c.pid != null) NET.pidCar[c.pid] = k; });
  const clean = list.map(({ pid, ...c }) => c);
  NET.ready = new Set(); NET.inRace = true;
  for (const p of NET.players) if (p.pid !== 0) NET.host.send(p.pid, { t: 'start', track, laps: L.laps, cars: clean.map((c) => ({ ...c, isPlayer: false })), me: NET.pidCar[p.pid] });
  startRace({ track, laps: L.laps, mode: 'race', carsList: clean, myIndex: NET.pidCar[0], prizeMul: 0.4, online: true }).then(() => {
    // vänta (högst 20 s) på att gästerna laddat klart innan nedräkningen går
    const R = G.race; R.countdown = 3.6; R.hold = true;
    const t0 = performance.now();
    const wait = () => { if (G.race !== R) return; if (NET.players.every((p) => p.pid === 0 || NET.ready.has(p.pid)) || performance.now() - t0 > 20000) R.hold = false; else setTimeout(wait, 100); };
    wait();
  });
}
async function joinRoom(code) {
  G.state = 'loading'; G.msg = 'ANSLUTER TILL ' + code; G.loadP = 0.5;
  const C = new Client();
  try { await C.join(code); } catch (e) { NET.err = String(e.message || e).toUpperCase(); G.state = 'code'; NET.typed = ''; return; }
  Object.assign(NET, { role: 'guest', client: C, code, players: [], inRace: false });
  C.onMsg = (m) => {
    if (m.t === 'lobby') { NET.players = m.players; NET.lobbyInfo = m; }
    else if (m.t === 'busy' || m.t === 'full') { NET.err = m.t === 'busy' ? 'LOPPET HAR REDAN BÖRJAT' : 'RUMMET ÄR FULLT'; leaveOnline(true); }
    else if (m.t === 'start') { NET.inRace = true; startRace({ track: m.track, laps: m.laps, mode: 'race', carsList: m.cars, myIndex: m.me, prizeMul: 0.4, online: true }); }
    else if (m.t === 's') { if (NET.mirror && G.race && G.race.mirror) NET.mirror.push(m); }
    else if (m.t === 'e') {
      const R = G.race;
      if (!R || !R.mirror || !NET.mirror) return;
      const A = deser(R, m.a), B = deser(R, m.b), Cc = deser(R, m.c);
      NET.mirror.fxEvent(m.k, A, B, Cc, m.d, m.e);
      if (m.k !== 'done') onEvent(m.k, A, B, Cc, m.d, m.e);
    } else if (m.t === 'res') guestResults(m.order);
  };
  C.onClose = () => { if (NET.role === 'guest') { NET.err = 'VÄRDEN LÄMNADE RUMMET'; leaveOnline(true); } };
  C.send({ t: 'hello', name: myName(), cfg: myCfg() });
  openLobby();
}
function guestResults(order) {
  const R = G.race;
  if (!R) return;
  NET.inRace = false;
  stopEngines();
  const me = NET.mirror ? NET.mirror.me : -1;
  const res = { rows: [], money: 0, cfg: G.cfg };
  order.forEach(([idx, time, best, kills, roadkill, money], k) => {
    const c = R.cars[idx], prize = Math.round((PRIZES[k] || 0) * 0.4);
    res.rows.push({ name: idx === me ? 'DU' : c.name.toUpperCase(), time, best, prize, me: idx === me, color: c.color, kills });
    if (idx === me) { res.place = k + 1; res.prize = prize; res.pickup = money; res.money = prize + money; res.roadkill = roadkill; res.kills = kills; }
  });
  save.money += res.money || 0; persist();
  G.results = res; G.state = 'results';
  NET.mirror = null;
  startMusic('menu');
}
function leaveOnline(showErr = false) {
  const wasRole = NET.role;
  if (NET.host) { NET.host.broadcast({ t: 'bye' }); NET.host.close(); }
  if (NET.client) NET.client.close();
  Object.assign(NET, { role: null, host: null, client: null, mirror: null, inRace: false, players: [] });
  stopEngines();
  if (G.race && G.race.mode !== 'attract') startAttract();
  G.menu = onlineMenu(); G.state = 'sub';
  if (showErr && NET.err) G.hud.say(NET.err, 3, GRAD.red, false);
  startMusic('menu');
  layoutTouch();
  void wasRole;
}
function codeAction(a) {
  if (a && a.ch && /^[A-Z]$/.test(a.ch) && NET.typed.length < 4) { NET.typed += a.ch; sfx('menu'); }
  else if (a === 'back' && NET.typed.length) NET.typed = NET.typed.slice(0, -1);
  else if (a === 'back' || a === 'exit') { G.menu = onlineMenu(); G.state = 'sub'; }
  else if (a === 'ok' && NET.typed.length === 4) { sfx('ok'); joinRoom(NET.typed); }
  else if (a && a.tap) {
    for (const b of codeKeys) if (a.tap[0] >= b.x && a.tap[0] < b.x + b.w && a.tap[1] >= b.y && a.tap[1] < b.y + b.h) {
      if (b.k === '<') codeAction('back'); else if (b.k === 'OK') codeAction('ok'); else if (b.k === 'X') codeAction('exit'); else codeAction({ ch: b.k });
      return;
    }
  }
}
let codeKeys = [];
function drawCode(t) {
  dimBg(0.55);
  const W = Math.min(VW - 16, 330), X = Math.round(VW / 2 - W / 2);
  panel(ctx, X, 10, W, VH - 20);
  drawText(ctx, 'GÅ MED I RUM', VW / 2, 18, { big: true, grad: GRAD.gold, align: 'c' });
  drawText(ctx, 'SKRIV RUMSKODEN', VW / 2, 32, { color: 0xd8d4e8, align: 'c' });
  for (let k = 0; k < 4; k++) {
    const bx = Math.round(VW / 2 - 52 + k * 27);
    ctx.fillStyle = '#1a1426'; ctx.fillRect(bx, 42, 22, 26);
    ctx.fillStyle = k === NET.typed.length && ((t * 3) | 0) % 2 ? '#f2c21c' : '#3a3450'; ctx.fillRect(bx + 1, 66, 20, 2);
    if (NET.typed[k]) drawText(ctx, NET.typed[k], bx + 11, 47, { big: true, scale: 2, grad: GRAD.white, align: 'c' });
  }
  if (NET.err) drawText(ctx, NET.err, VW / 2, 74, { color: 0xff7060, align: 'c' });
  // tangentbord på skärmen
  const keys = [...'ABCDEFGHJKLMNPQRSTUVWXYZ', '<', 'OK', 'X'];
  codeKeys = [];
  const kw = 22, kh = 16, cols = 9, kx0 = Math.round(VW / 2 - (cols * (kw + 3)) / 2);
  keys.forEach((k, i) => {
    const x = kx0 + (i % cols) * (kw + 3), y = 86 + Math.floor(i / cols) * (kh + 3);
    ctx.fillStyle = k === 'OK' ? '#2f8f46' : k === 'X' ? '#9e1b22' : '#2a2640'; ctx.fillRect(x, y, kw, kh);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y, kw, 1);
    drawText(ctx, k, x + kw / 2, y + 5, { color: 0xffffff, align: 'c' });
    codeKeys.push({ k, x, y, w: kw, h: kh });
  });
  drawText(ctx, input.touch ? 'TRYCK PÅ BOKSTÄVERNA' : 'SKRIV MED TANGENTBORDET · ENTER = ANSLUT · ESC = TILLBAKA', VW / 2, VH - 22, { color: 0x9a94b0, align: 'c' });
}
function drawLobby(t) {
  dimBg(0.5);
  const r = G.menu.draw(ctx, VW, VH, t, VW - 240, 10, 232);
  const LW = Math.max(150, VW - 240 - 18), LX = 8;
  panel(ctx, LX, 10, LW, Math.max(r.H, 150), 'rgba(20,16,40,0.8)', '#6a6488');
  drawText(ctx, 'RUMSKOD', LX + LW / 2, 18, { color: 0xd8d4e8, align: 'c' });
  drawText(ctx, NET.code, LX + LW / 2, 28, { big: true, scale: 3, grad: GRAD.gold, align: 'c' });
  const info = NET.role === 'host' ? { track: lobbyTrack(), laps: NET.lobby.laps, ai: NET.lobby.ai } : NET.lobbyInfo;
  if (info) drawText(ctx, `${trackName(info.track)} · ${info.laps} VARV · ${info.ai} DATORBILAR`, LX + LW / 2, 56, { color: 0xffe080, align: 'c' });
  const list = NET.role === 'host' ? NET.players.map((p) => ({ name: p.name, carId: p.cfg.carId, color: p.cfg.color })) : NET.players;
  drawText(ctx, `SPELARE (${list.length})`, LX + 8, 70, { color: 0x9a94b0 });
  list.forEach((p, k) => {
    const y = 80 + k * 10;
    ctx.fillStyle = '#1a1426'; ctx.fillRect(LX + 8, y - 1, 7, 7); ctx.fillStyle = css(p.color); ctx.fillRect(LX + 9, y, 5, 5);
    drawText(ctx, `${p.name}${k === 0 ? ' (VÄRD)' : ''}`, LX + 20, y, { color: 0xffffff });
    drawText(ctx, (CARS[p.carId] ? CARS[p.carId].name : '').toUpperCase(), LX + LW - 8, y, { color: 0xc8c0a0, align: 'r' });
  });
  if (NET.role === 'guest' && ((t * 2) | 0) % 2) drawText(ctx, 'VÄNTAR PÅ ATT VÄRDEN STARTAR...', LX + LW / 2, 80 + list.length * 10 + 8, { color: 0xd8d4e8, align: 'c' });
  if (NET.role === 'host' && list.length < 2) drawText(ctx, 'BE KOMPISARNA VÄLJA "GÅ MED I RUM"', LX + LW / 2, 80 + list.length * 10 + 8, { color: 0xd8d4e8, align: 'c' });
}

// ---------- paus ----------
function pauseMenu() {
  const back = () => { G.state = 'race'; layoutTouch(); };
  if (G.cfg && G.cfg.f1) return new Menu('PAUS', [
    { label: 'FORTSÄTT', ok: () => { sfx('ok'); back(); } },
    { label: G.cfg.quali ? 'GÖR OM KVALET' : 'STARTA OM', ok: () => { sfx('ok'); startRace(G.cfg); } },
    G.cfg.quali ? { label: 'AVSLUTA KVALET', ok: () => { sfx('ok'); showResults(); }, info: () => 'BÄSTA VARVET HITTILLS RÄKNAS' }
      : { label: 'AVSLUTA LOPPET', ok: () => { sfx('back'); gpBack(); }, info: () => (G.cfg.gp.season ? 'LOPPET RÄKNAS INTE – DU KÖR DET IGEN' : '') },
  ], { w: 190, back });
  if (NET.role) return new Menu('ONLINE', [
    { label: 'FORTSÄTT', ok: () => { sfx('ok'); G.state = 'race'; layoutTouch(); } },
    { label: 'LÄMNA LOPPET', ok: () => { sfx('back'); leaveOnline(); } },
  ], { w: 170, back: () => { G.state = 'race'; layoutTouch(); } });
  return new Menu('PAUS', [
    { label: 'FORTSÄTT', ok: () => { sfx('ok'); G.state = 'race'; layoutTouch(); } },
    { label: 'STARTA OM', ok: () => { sfx('ok'); startRace(G.cfg); } },
    { label: 'AVSLUTA LOPPET', ok: () => { sfx('back'); stopEngines(); if (G.cfg.champ) { preRaceAfterQuit(); } else afterRace(); } },
  ], { w: 170, back: () => { G.state = 'race'; layoutTouch(); } });
}
function preRaceAfterQuit() { startAttract(); preRace(); startMusic('menu'); }

// ---------- titel ----------
function drawTitle(t) {
  dimBg(0.25);
  const y = Math.round(VH * 0.24);
  const wob = Math.round(Math.sin(t * 2) * 2);
  drawText(ctx, 'KURVKUNGEN', VW / 2, y + wob, { big: true, scale: 5, grad: GRAD.fire, align: 'c' });
  drawText(ctx, 'ISOMETRISK PIXELRACING MED VAPEN', VW / 2, y + 44, { color: 0xfff2c0, align: 'c' });
  if (((t * 2) | 0) % 2) drawText(ctx, input.touch ? 'TRYCK FÖR ATT STARTA' : 'TRYCK ENTER', VW / 2, VH * 0.62, { big: true, grad: GRAD.white, align: 'c' });
  const help = input.touch ? 'STYR MED KNAPPARNA · BILEN GASAR SJÄLV (AUTOGAS)' : 'PILAR = KÖR · MELLANSLAG = SKJUT · Z = BAKVAPEN · SHIFT = NITRO · T = TUTA · R = TILLBAKA';
  drawText(ctx, help, VW / 2, VH - 26, { color: 0xd8d4e8, align: 'c' });
  drawText(ctx, 'V' + VERSION, VW - 4, VH - 10, { color: 0x9a94b0, align: 'r' });
}
function dimBg(a) { ctx.fillStyle = `rgba(14,10,30,${a})`; ctx.fillRect(0, 0, VW, VH); }

// ---------- kamera ----------
function updateCam(dt, car) {
  const c = G.cam;
  const look = 0.34, tx = car.x + car.vx * look, ty = car.y + car.vy * look;
  const k = 1 - Math.exp(-dt * 4.5);
  c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.z += (car.z - c.z) * (1 - Math.exp(-dt * 3));
  if (c.shake > 0) { c.shake -= dt; c.shx = Math.round((Math.random() - 0.5) * 4 * Math.min(1, c.shake * 4)); c.shy = Math.round((Math.random() - 0.5) * 3 * Math.min(1, c.shake * 4)); }
  else c.shx = c.shy = 0;
}

// ---------- loopen ----------
let last = performance.now();
const FAST = +(Q.get('fast') || 1);
function frame(now) {
  requestAnimationFrame(frame);
  const f0 = performance.now();
  frameBody(now);
  const ms = performance.now() - f0;
  G.ms = G.ms ? G.ms * 0.95 + ms * 0.05 : ms; G.msMax = Math.max((G.msMax || 0) * 0.995, ms);
  if (Q.has('fps')) { sctx.fillStyle = '#000'; sctx.fillRect(0, 0, 160, 22); sctx.fillStyle = '#0f0'; sctx.font = '14px monospace'; sctx.fillText(`${G.ms.toFixed(1)} ms (max ${G.msMax.toFixed(0)})`, 4, 16); }
}
function frameBody(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  G.t += dt;
  const t = G.t;
  const acts = pollActions();
  if (acts.length) initAudio();
  for (const a of acts) handle(a);
  ctx.imageSmoothingEnabled = false;
  const R = G.race;
  if (G.state === 'boot' || G.state === 'loading') {
    if (R && G.state === 'loading' && G.world && G.world.ready && R.world === G.world) { /* laddar */ }
    ctx.fillStyle = '#100c1e'; ctx.fillRect(0, 0, VW, VH);
    drawText(ctx, 'KURVKUNGEN', VW / 2, VH * 0.3, { big: true, scale: 3, grad: GRAD.fire, align: 'c' });
    drawText(ctx, G.msg, VW / 2, VH * 0.55, { big: true, grad: GRAD.gold, align: 'c' });
    const bw = 160; ctx.fillStyle = '#2a2640'; ctx.fillRect(VW / 2 - bw / 2, VH * 0.66, bw, 4);
    const p = G.state === 'boot' ? (G.world ? 1 : (t * 0.6) % 1) : G.loadP;
    ctx.fillStyle = '#f2c21c'; ctx.fillRect(VW / 2 - bw / 2, VH * 0.66, Math.round(bw * p), 4);
  } else if (R) {
    const racing = G.state === 'race' || (G.state === 'pause' && NET.role && R.mode !== 'attract');
    const steps = racing || R.mode === 'attract' ? (Q.has('fast') ? FAST : 1) : 0;
    if (G.state === 'race' && R.player && !R.player.ai) driveInput(R.player.inp);
    if (R.mirror && NET.mirror) {
      NET.mirror.update(dt); NET.mirror.tickProps(dt);
      NET.sendT -= dt;
      if (NET.sendT <= 0 && G.state === 'race') { const i = R.player.inp; NET.client.send({ t: 'i', s: +i.steer.toFixed(2), g: i.gas, b: i.brake, f: i.fire ? 1 : 0, r: i.rear ? 1 : 0, n: i.nitro ? 1 : 0 }); NET.sendT = 0.033; }
    } else for (let k = 0; k < steps; k++) R.update(dt);
    if (NET.role === 'host' && R.mode !== 'attract' && (G.state === 'race' || G.state === 'pause' || G.state === 'results')) { NET.snapT -= dt; if (NET.snapT <= 0) { NET.host.broadcast(snapshot(R)); NET.snapT = 0.05; } }
    // kamera
    let target = R.player;
    if (R.mode === 'attract') {
      G.followT += dt;
      if (!G.follow || G.followT > 14 || G.follow.wreckT > 0) { const cs = R.cars.filter((c) => c.wreckT <= 0); G.follow = G.followT > 14 ? cs[(Math.random() * cs.length) | 0] : R.leader; G.followT = 0; }
      target = G.follow;
    }
    if (target) updateCam(dt, target);
    G.world.request(G.cam.x - G.cam.y, (G.cam.x + G.cam.y) / 2 - G.cam.z);
    drawRace(ctx, R, G.cam, VW, VH, t);
    G.hud.update(dt);
    if (G.state === 'race' || G.state === 'pause') G.hud.draw(ctx, VW, VH, t, R.player);
    // motorljud
    if (racing && R.player && audio.ready) {
      const P = R.player;
      engineSet(0, P.speed / P.st.vmax, P.inp.gas > 0 && R.phase !== 'countdown' ? 1 : R.phase === 'countdown' && P.inp.gas > 0 ? 1 : 0, P.air ? 0 : P.slip, P.nitroT > 0, P.wreckT > 0 || P.sinkT > 0 ? 0 : 1, !!R.f1);
      let best = null, bd = 1e9;
      for (const c of R.cars) if (c !== P) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < bd) { bd = d; best = c; } }
      if (best) engineSet(1, best.speed / best.st.vmax, best.inp.gas > 0, best.slip, best.nitroT > 0, Math.max(0, 1 - bd / 260), !!R.f1);
    }
    if (G.state === 'title') drawTitle(t);
    else if (G.state === 'menu' || G.state === 'sub') { dimBg(0.45); drawText(ctx, 'KURVKUNGEN', VW / 2, 10, { big: true, scale: 2, grad: GRAD.fire, align: 'c' }); G.menu.draw(ctx, VW, VH, t, null, null, null); drawText(ctx, save.money + ' KR', VW - 6, VH - 12, { color: 0xffe080, align: 'r' }); }
    else if (G.state === 'garage') drawGarage(t);
    else if (G.state === 'gp') drawGP(t);
    else if (G.state === 'pause') { dimBg(0.5); G.menu.draw(ctx, VW, VH, t); }
    else if (G.state === 'results' || G.state === 'standings') drawResults(t);
    else if (G.state === 'lobby') drawLobby(t);
    else if (G.state === 'code') drawCode(t);
    drawTouch();
  }
  sctx.imageSmoothingEnabled = false;
  sctx.fillStyle = '#000'; if (OXs || OYs) sctx.fillRect(0, 0, canvas.width, canvas.height);
  sctx.drawImage(view, OXs, OYs, VW * S, VH * S);
}

function handle(a) {
  if (G.state === 'race' && a === 'back') a = 'pause'; // Esc pausar loppet
  if (G.state === 'code') { codeAction(a); return; }
  if (a === 'music') { toggleMusic(); return; }
  const st = G.state;
  if (st === 'title') { if (a === 'ok' || (a && a.tap)) { sfx('ok'); G.menu = mainMenu(); G.state = 'menu'; } return; }
  if (st === 'code') { codeAction(a); return; }
  if (st === 'lobby') { if (a !== 'pause') G.menu.action(a); return; }
  if (st === 'menu' || st === 'sub' || st === 'garage' || st === 'pause' || st === 'gp') { if (a === 'pause' && st === 'pause') { G.state = 'race'; layoutTouch(); return; } if (a !== 'pause') G.menu.action(a); return; }
  if (st === 'race' && G.race.f1) {
    const P = G.race.player;
    if (!P || P.ai || G.race.mode === 'time') { if (a !== 'pause' && a !== 'reset') return; }
    else if (a === 'box') { if (!P.pitPhase && !P.finished) { P.boxing = !P.boxing; sfx(P.boxing ? 'ok' : 'back'); G.hud.say(P.boxing ? 'BOXA, BOXA!' : 'STANNA UTE', 1.4, P.boxing ? GRAD.gold : GRAD.white, false); } return; }
    else if (a === 'tyre' || /^tyre[123]$/.test(a)) {
      P.nextTyre = a === 'tyre' ? COMPOUND_ORDER[(COMPOUND_ORDER.indexOf(P.nextTyre) + 1) % 3] : COMPOUND_ORDER[+a[4] - 1];
      sfx('menu'); G.hud.say('NÄSTA DÄCK: ' + COMPOUNDS[P.nextTyre].name, 1.2, GRAD.white, false); return;
    }
  }
  if (st === 'race' && a === 'horn') { const P = G.race.player; if (P && P.st.horn) { sfx('horn'); if (NET.role === 'guest') NET.client.send({ t: 'h' }); else G.race.animals.scare(P.x, P.y, 160); } return; }
  if (st === 'race' && NET.role === 'guest' && a === 'reset') { NET.client.send({ t: 'reset' }); return; }
  if (st === 'race') { if (a === 'reset' && G.race.player && G.race.phase === 'race' && G.race.player.wreckT <= 0) { G.race.respawn(G.race.player); return; } if (a === 'pause') { G.menu = pauseMenu(); G.state = 'pause'; layoutTouch(); stopEnginesQuiet(); } return; }
  if (st === 'results' || st === 'standings') { if (a === 'ok' || (a && a.tap)) resultsNext(); }
}
function stopEnginesQuiet() { engineSet(0, 0, 0, 0, false, 0); engineSet(1, 0, 0, 0, false, 0); }

// inställningar
if (save.settings.music === false) setMusic(false);
if (save.settings.sfx === false) setSfx(false);
input.autoGas = save.settings.autoGas ?? ('ontouchstart' in window && navigator.maxTouchPoints > 0);
if ('ontouchstart' in window && navigator.maxTouchPoints > 0) input.touch = true;

// ---------- resultat-tillstånd i ritningen ----------
G.go = go;
boot().catch((e) => { console.error(e); G.msg = 'FEL: ' + e.message; });
requestAnimationFrame(frame);

// testkrokar
window.KK = { G, startRace, CUPS, save, NET, hostRoom, joinRoom, hostStart, startGP, gpGrid, gpField, lapEstimate, f1Stats, teamById };
void THEMES; void TRACKS; void carSprite; void tw; void stopMusic; void REAR;
