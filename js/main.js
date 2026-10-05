// KURVKUNGEN – start, skalning, spelloop och alla skärmar (titel, menyer, garage, cuper, lopp, resultat).
import { World } from './world.js?v=1';
import { Race } from './race.js?v=1';
import { Hud, ordinal, fmtTime } from './hud.js?v=1';
import { drawRace, prewarm, carSprite } from './render.js?v=1';
import { renderCar, palette, CAR_COLORS } from './carsprites.js?v=1';
import { drawText, GRAD, panel, tw } from './text.js?v=1';
import { Menu, CUPS, PRIZES, POINTS } from './ui.js?v=1';
import { input, pollActions, driveInput, touchButtons, setPointerMap, heldTouches } from './input.js?v=1';
import { initAudio, sfx, startMusic, stopMusic, makeEngines, stopEngines, engineSet, setMusic, setSfx, audio } from './audio.js?v=1';
import { save, persist, resetSave } from './save.js?v=1';
import { CARS, CAR_ORDER, UPGRADES, UPG_ORDER, FRONT, REAR, DRIVERS } from './cars.js?v=1';
import { TRACKS, TRACK_ORDER, trackName, THEMES } from './tracks.js?v=1';
import { VERSION } from './version.js?v=1';
import { css } from './pix.js?v=1';

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
  S = Math.max(1, Math.floor(Math.min(w / 400, h / 225)));
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
    touchButtons.push({ id: 'fire', x: VW - 30, y: VH - 82, r: 17, label: 'SKJUT' }, { id: 'rear', x: VW - 72, y: VH - 78, r: 14, label: 'BAK' }, { id: 'nitro', x: VW - (input.autoGas ? 76 : 122), y: VH - 30, r: 14, label: 'NOS' });
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
  const att = R.mode === 'attract';
  const v = (o) => (att ? near(o) * 0.35 : near(o));
  switch (type) {
    case 'count': if (!att) sfx('count'); break;
    case 'go': if (!att) sfx('go'); break;
    case 'lap': if (a === P) { if (b === R.laps - 1) { hud.say('SISTA VARVET!', 2, GRAD.fire); sfx('final'); } else { hud.say('VARV ' + (b + 1), 1.4, GRAD.white); sfx('lap'); } } break;
    case 'finish': if (a === P) { hud.say('MÅL! ' + ordinal(b), 4, b === 1 ? GRAD.gold : GRAD.white); sfx('finish'); } break;
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
    case 'done': if (!att) setTimeout(() => { if (G.race === R) showResults(); }, 1800); break;
  }
}

// ---------- start ----------
async function boot() {
  resize();
  G.state = 'boot'; G.msg = 'BYGGER VÄRLDEN';
  const startTrack = Q.get('race') || 'sjoviken';
  const w = new World(Q.get('race') ? startTrack : 'sjoviken');
  await w.load();
  G.world = w;
  if (Q.get('race')) {
    input.autoGas = false;
    await startRace({ track: startTrack, laps: +(Q.get('laps') || 3), mode: Q.get('mode') || 'race', opponents: makeOpponents(CUPS[0], 5), prizeMul: 0.5, autopilot: Q.has('auto') });
    return;
  }
  startAttract();
  G.state = 'title';
  startMusic('menu');
}

function startAttract() {
  G.world.resetDynamic();
  const cars = [];
  const models = ['komet', 'muskel', 'pirat', 'raket', 'buffel', 'komet'];
  for (let k = 0; k < 6; k++) cars.push({ name: DRIVERS[k].name, carId: models[k], color: [0xd8282c, ...DRIVERS.map((d) => d.color)][k], skill: 0.5 + k * 0.08 });
  G.race = new Race(G.world, { mode: 'attract', cars, countdown: 0.01, events: onEvent });
  G.hud = new Hud(G.race);
  G.follow = G.race.cars[0]; G.followT = 0;
  const c = G.follow; G.cam.x = c.x; G.cam.y = c.y; G.cam.z = c.z;
}

function makeOpponents(cup, n) {
  const ds = [...DRIVERS].sort(() => Math.random() - 0.5).filter((d) => d.color !== (save.garage[save.car]?.color));
  const out = [];
  for (let k = 0; k < n; k++) {
    const d = ds[k];
    const skill = cup.skill[0] + (cup.skill[1] - cup.skill[0]) * (k / Math.max(1, n - 1));
    const up = cup.upg;
    out.push({
      name: d.name, color: d.color, carId: cup.models[k % cup.models.length], skill,
      upg: { motor: Math.min(4, up + (k > 2 ? 1 : 0)), dack: up, pansar: up, nitro: Math.min(4, up) },
      frontW: k % 3 === 2 && up > 0 ? 'raketer' : 'kulspruta', frontLvl: Math.min(3, up), rearW: ['minor', 'olja', 'rok'][k % 3], rearLvl: Math.min(3, up),
    });
  }
  return out;
}

function playerCarCfg() {
  const g = save.garage[save.car];
  return {
    name: 'Du', isPlayer: true, carId: save.car, color: g.color, upg: g.upg,
    frontW: save.weapons.front, frontLvl: save.weapons.owned[save.weapons.front] || 0,
    rearW: save.weapons.rear, rearLvl: save.weapons.owned[save.weapons.rear] || 0,
  };
}

async function startRace(cfg) {
  G.cfg = cfg;
  G.state = 'loading'; G.loadP = 0; G.msg = trackName(cfg.track);
  stopEngines();
  let w = G.world;
  if (!w || w.id !== cfg.track) { w = new World(cfg.track); G.msg = trackName(cfg.track); await w.load(); }
  else w.resetDynamic();
  G.world = w;
  const cars = [];
  const pc = playerCarCfg();
  if (cfg.mode === 'time') cars.push(pc);
  else {
    // spelaren startar längst bak i mästerskapets första lopp, annars efter placering
    const opp = cfg.opponents;
    const order = cfg.grid || [...opp.map((o) => o.name), 'Du'];
    for (const name of order) cars.push(name === 'Du' ? pc : opp.find((o) => o.name === name));
  }
  G.stats = {};
  const R = new Race(w, { mode: cfg.mode, laps: cfg.laps, cars, events: onEvent, autopilot: cfg.autopilot });
  G.race = R; G.hud = new Hud(R);
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
  layoutTouch();
  startMusic('race');
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
    { label: 'MÄSTERSKAP', ok: () => { sfx('ok'); G.menu = cupMenu(); G.state = 'sub'; }, info: () => 'TRE CUPER. VINN PENGAR, KÖP BILAR OCH VAPEN.' },
    { label: 'SNABBT LOPP', ok: () => { sfx('ok'); G.menu = quickMenu(); G.state = 'sub'; }, info: () => 'VÄLJ BANA OCH MOTSTÅNDARE.' },
    { label: 'TIDSJAKT', ok: () => { sfx('ok'); G.menu = timeMenu(); G.state = 'sub'; }, info: () => 'ENSAM PÅ BANAN. SLÅ DITT BÄSTA VARV.' },
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
  const opp = makeOpponents(cup, 5);
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
let qTrack = 0, qLaps = 3, qLevel = 1;
const LEVELS = ['LÄTT', 'MEDEL', 'SVÅR'];
function quickMenu() {
  return new Menu('SNABBT LOPP', [
    { label: 'BANA', value: () => trackName(TRACK_ORDER[qTrack]), left: () => { qTrack = (qTrack + TRACK_ORDER.length - 1) % TRACK_ORDER.length; }, right: () => { qTrack = (qTrack + 1) % TRACK_ORDER.length; } },
    { label: 'VARV', value: () => qLaps, left: () => { qLaps = Math.max(1, qLaps - 1); }, right: () => { qLaps = Math.min(9, qLaps + 1); } },
    { label: 'MOTSTÅNDARE', value: () => LEVELS[qLevel], left: () => { qLevel = (qLevel + 2) % 3; }, right: () => { qLevel = (qLevel + 1) % 3; } },
    { label: 'KÖR!', ok: () => { sfx('ok'); startRace({ track: TRACK_ORDER[qTrack], laps: qLaps, mode: 'race', opponents: makeOpponents(CUPS[qLevel], 5), prizeMul: 0.4 }); }, info: () => 'SNABBA LOPP GER HALVA PRISPENGAR.' },
    { label: 'TILLBAKA', ok: backToMain },
  ], { w: 280, back: backToMain });
}
function timeMenu() {
  return new Menu('TIDSJAKT', [
    { label: 'BANA', value: () => trackName(TRACK_ORDER[qTrack]), left: () => { qTrack = (qTrack + TRACK_ORDER.length - 1) % TRACK_ORDER.length; }, right: () => { qTrack = (qTrack + 1) % TRACK_ORDER.length; } },
    { label: 'REKORD', value: () => fmtTime(save.records[TRACK_ORDER[qTrack]]) },
    { label: 'KÖR!', ok: () => { sfx('ok'); startRace({ track: TRACK_ORDER[qTrack], laps: 5, mode: 'time', opponents: [], prizeMul: 0 }); } },
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
  const g = () => save.garage[view];
  const owned = () => !!save.garage[view];
  const cycleCar = (d) => { const i = CAR_ORDER.indexOf(view); view = CAR_ORDER[(i + d + CAR_ORDER.length) % CAR_ORDER.length]; if (owned()) { save.car = view; persist(); } };
  const colorList = [0xd8282c, ...CAR_COLORS.slice(1)];
  const upItem = (k) => ({
    label: UPGRADES[k].name.toUpperCase(),
    value: () => { if (!owned()) return '-'; const l = g().upg[k]; return l < 4 ? UPGRADES[k].prices[l] + ' KR' : 'MAX'; },
    pips: () => (owned() ? [g().upg[k], 4] : null),
    dis: () => !owned() || g().upg[k] >= 4,
    ok: () => { const l = g().upg[k], p = UPGRADES[k].prices[l]; if (save.money < p) { sfx('deny'); return; } save.money -= p; g().upg[k]++; persist(); sfx('buy'); },
    info: () => UPGRADES[k].desc.toUpperCase(),
  });
  const weapItem = (slot, TAB) => {
    const keys = Object.keys(TAB);
    return {
      label: slot === 'front' ? 'FRAMVAPEN' : 'BAKVAPEN',
      value: () => { const w = save.weapons[slot], lvl = save.weapons.owned[w] ?? -1; return TAB[w].name.toUpperCase() + (lvl >= 0 ? '' : '  ' + TAB[w].price + ' KR'); },
      pips: () => { const lvl = save.weapons.owned[save.weapons[slot]]; return lvl === undefined ? null : [lvl, 3]; },
      left: () => { const i = keys.indexOf(save.weapons[slot]); save.weapons[slot] = keys[(i + keys.length - 1) % keys.length]; },
      right: () => { const i = keys.indexOf(save.weapons[slot]); save.weapons[slot] = keys[(i + 1) % keys.length]; },
      ok: () => {
        const w = save.weapons[slot], lvl = save.weapons.owned[w];
        if (lvl === undefined) { if (save.money < TAB[w].price) { sfx('deny'); return; } save.money -= TAB[w].price; save.weapons.owned[w] = 0; sfx('buy'); }
        else if (lvl < 3) { const p = TAB[w].prices[lvl]; if (save.money < p) { sfx('deny'); return; } save.money -= p; save.weapons.owned[w]++; sfx('buy'); }
        else sfx('deny');
        persist();
      },
      info: () => { const w = save.weapons[slot], lvl = save.weapons.owned[w]; return lvl === undefined ? `KÖP FÖR ${TAB[w].price} KR (ENTER)` : lvl < 3 ? `UPPGRADERA: ${TAB[w].prices[lvl]} KR (ENTER)` : 'FULLT UPPGRADERAD'; },
    };
  };
  const finish = () => {
    // ett ägt vapen måste vara valt
    for (const [slot, TAB] of [['front', FRONT], ['rear', REAR]]) if (save.weapons.owned[save.weapons[slot]] === undefined) save.weapons[slot] = Object.keys(TAB).find((k) => save.weapons.owned[k] !== undefined);
    if (!owned()) view = save.car;
    persist(); garage = null; back();
  };
  const m = new Menu('GARAGET', [
    { label: 'BIL', value: () => CARS[view].name.toUpperCase() + (owned() ? '' : '  ' + CARS[view].price + ' KR'), left: () => cycleCar(-1), right: () => cycleCar(1), ok: () => { if (owned()) return; if (save.money < CARS[view].price) { sfx('deny'); return; } save.money -= CARS[view].price; save.garage[view] = { upg: { motor: 0, dack: 0, pansar: 0, nitro: 0 }, color: colorList[CAR_ORDER.indexOf(view) % colorList.length] }; save.car = view; persist(); sfx('buy'); }, info: () => owned() ? CARS[view].desc.toUpperCase() : `KÖP FÖR ${CARS[view].price} KR (ENTER)` },
    { label: 'FÄRG', value: () => '', vcol: () => 0xffffff, dis: () => !owned(), left: () => { const i = colorList.indexOf(g().color); g().color = colorList[(i + colorList.length - 1) % colorList.length]; persist(); }, right: () => { const i = colorList.indexOf(g().color); g().color = colorList[(i + 1) % colorList.length]; persist(); } },
    ...UPG_ORDER.map(upItem),
    weapItem('front', FRONT), weapItem('rear', REAR),
    { label: 'KLAR', ok: () => { sfx('ok'); finish(); } },
  ], { w: 250, back: finish, rowH: 14 });
  garage = { menu: m, get view() { return view; }, owned };
  G.menu = m; G.state = 'garage';
}
const bar = (l, n) => '#'.repeat(l) + '-'.repeat(n - l);
const bigCars = new Map();
function drawGarage(t) {
  const m = garage.menu, view = garage.view;
  dimBg(0.55);
  const r = m.draw(ctx, VW, VH, t, VW - 262, 8, 254);
  // förhandsvisning
  const LW = Math.max(150, VW - 262 - 16), LX = 8, LH = r.H;
  panel(ctx, LX, 8, LW, LH, 'rgba(20,16,40,0.78)', '#6a6488');
  const px = LX + Math.round(LW / 2), py = 8 + Math.round(LH * 0.42);
  const col = garage.owned() ? save.garage[view].color : 0x8a8694;
  const ang = (t * 0.6) % (Math.PI * 2);
  const k = Math.round(ang / (Math.PI * 2) * 32) % 32;
  const key = view + col + ':' + k;
  if (!bigCars.has(key)) { if (bigCars.size > 200) bigCars.clear(); bigCars.set(key, renderCar(CARS[view].model, palette(col), k / 32 * Math.PI * 2, 2)); }
  const spr = bigCars.get(key);
  // podium
  ctx.fillStyle = '#2a2640'; for (let y = -10; y <= 10; y++) { const w = Math.round(Math.sqrt(100 - y * y) * 4.2); ctx.fillRect(px - w, py + 22 + Math.round(y / 2), w * 2, 1); }
  ctx.fillStyle = '#3c3858'; for (let y = -9; y <= 9; y++) { const w = Math.round(Math.sqrt(81 - y * y) * 4.2); ctx.fillRect(px - w, py + 21 + Math.round(y / 2), w * 2, 1); }
  ctx.drawImage(spr, px - spr.width / 2, py + 22 - 27 * 2);
  drawText(ctx, CARS[view].name.toUpperCase(), px, 14, { big: true, grad: GRAD.gold, align: 'c' });
  // statistik
  const st = CARS[view];
  const rows = [['FART', st.vmax / 330], ['ACCELERATION', st.acc / 400], ['GREPP', st.grip / 1450], ['TÅLIGHET', (1.2 - st.armor) / 0.6], ['VIKT', st.mass / 1.6]];
  const bw = LW - 76;
  rows.forEach(([n, v], i) => {
    const y = 8 + LH - 50 + i * 9;
    drawText(ctx, n, LX + 8, y, { color: 0xd8d4e8 });
    ctx.fillStyle = '#2a2640'; ctx.fillRect(LX + 68, y - 1, bw, 6);
    ctx.fillStyle = '#f2c21c'; ctx.fillRect(LX + 68, y - 1, Math.round(bw * Math.max(0.05, Math.min(1, v))), 6);
    ctx.fillStyle = '#fff2a0'; ctx.fillRect(LX + 68, y - 1, Math.round(bw * Math.max(0.05, Math.min(1, v))), 1);
  });
  drawText(ctx, save.money + ' KR', VW - 12, r.Y + r.H + 6, { big: true, grad: GRAD.gold, align: 'r' });
  // färgruta i menyn
  const ci = m.items.findIndex((it) => it.label === 'FÄRG');
  if (garage.owned()) { const yy = r.Y + 24 + ci * 14 + 2; ctx.fillStyle = '#1a1426'; ctx.fillRect(r.X + r.W - 30, yy, 14, 9); ctx.fillStyle = css(save.garage[view].color); ctx.fillRect(r.X + r.W - 29, yy + 1, 12, 7); }
}

// ---------- resultat ----------
function showResults() {
  const R = G.race, cfg = G.cfg, P = R.player;
  stopEngines();
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
      if (c.isPlayer) { res.place = k + 1; res.prize = prize; res.pickup = c.money; res.money = prize + c.money; }
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
  const W = Math.min(VW - 16, 360), X = Math.round(VW / 2 - W / 2);
  if (res.standings) return drawStandings(t, X, W);
  if (res.cfg.mode === 'time') {
    panel(ctx, X, 16, W, 150);
    drawText(ctx, 'TIDSJAKT – ' + trackName(res.cfg.track), VW / 2, 24, { big: true, grad: GRAD.gold, align: 'c' });
    res.laps.forEach((lt, k) => drawText(ctx, `VARV ${k + 1}   ${fmtTime(lt)}`, VW / 2, 46 + k * 10, { color: lt === res.best ? 0xffe080 : 0xd8d4e8, align: 'c' }));
    drawText(ctx, 'BÄSTA VARV ' + fmtTime(res.best), VW / 2, 112, { big: true, grad: GRAD.white, align: 'c' });
    if (res.record && ((t * 3) | 0) % 2) drawText(ctx, 'NYTT REKORD!', VW / 2, 132, { big: true, scale: 2, grad: GRAD.fire, align: 'c' });
  } else {
    const H = 44 + res.rows.length * 12 + 40;
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
  if (res.standings) { if (res.back) res.back(); else afterRace(); return; }
  if (res.cfg.champ) { G.results = { standings: true, champEnd: res.champEnd, back: res.champEnd ? null : () => { startAttract(); preRace(); } }; if (!res.champEnd && !save.champ) { afterRace(); return; } return; }
  afterRace();
}
function afterRace() {
  // tillbaka till menyn med loppets bana som bakgrund
  G.results = null;
  startAttract();
  G.menu = mainMenu(); G.state = 'menu';
  startMusic('menu');
}

// ---------- paus ----------
function pauseMenu() {
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
  const help = input.touch ? 'STYR MED KNAPPARNA · BILEN GASAR SJÄLV (AUTOGAS)' : 'PILAR = KÖR · MELLANSLAG = SKJUT · Z = BAKVAPEN · SHIFT = NITRO · R = TILLBAKA PÅ BANAN';
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
    const racing = G.state === 'race';
    const steps = racing || R.mode === 'attract' ? (Q.has('fast') ? FAST : 1) : 0;
    if (racing && R.player && !R.player.ai) driveInput(R.player.inp);
    for (let k = 0; k < steps; k++) R.update(dt);
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
      engineSet(0, P.speed / P.st.vmax, P.inp.gas > 0 && R.phase !== 'countdown' ? 1 : R.phase === 'countdown' && P.inp.gas > 0 ? 1 : 0, P.air ? 0 : P.slip, P.nitroT > 0, P.wreckT > 0 || P.sinkT > 0 ? 0 : 1);
      let best = null, bd = 1e9;
      for (const c of R.cars) if (c !== P) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < bd) { bd = d; best = c; } }
      if (best) engineSet(1, best.speed / best.st.vmax, best.inp.gas > 0, best.slip, best.nitroT > 0, Math.max(0, 1 - bd / 260));
    }
    if (G.state === 'title') drawTitle(t);
    else if (G.state === 'menu' || G.state === 'sub') { dimBg(0.45); drawText(ctx, 'KURVKUNGEN', VW / 2, 10, { big: true, scale: 2, grad: GRAD.fire, align: 'c' }); G.menu.draw(ctx, VW, VH, t, null, null, null); drawText(ctx, save.money + ' KR', VW - 6, VH - 12, { color: 0xffe080, align: 'r' }); }
    else if (G.state === 'garage') drawGarage(t);
    else if (G.state === 'pause') { dimBg(0.5); G.menu.draw(ctx, VW, VH, t); }
    else if (G.state === 'results' || G.state === 'standings') drawResults(t);
    drawTouch();
  }
  sctx.imageSmoothingEnabled = false;
  sctx.fillStyle = '#000'; if (OXs || OYs) sctx.fillRect(0, 0, canvas.width, canvas.height);
  sctx.drawImage(view, OXs, OYs, VW * S, VH * S);
}

function handle(a) {
  if (a === 'music') { toggleMusic(); return; }
  const st = G.state;
  if (st === 'title') { if (a === 'ok' || (a && a.tap)) { sfx('ok'); G.menu = mainMenu(); G.state = 'menu'; } return; }
  if (st === 'menu' || st === 'sub' || st === 'garage' || st === 'pause') { if (a === 'pause' && st === 'pause') { G.state = 'race'; layoutTouch(); return; } if (a !== 'pause') G.menu.action(a); return; }
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
window.KK = { G, startRace, CUPS, save };
void THEMES; void TRACKS; void carSprite; void tw; void stopMusic; void REAR;
