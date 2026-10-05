// Fordon, uppgraderingar, tillbehör, lackmönster och vapen.
// Fart i världsenheter/s (bilen ~20 lång ≈ 4,5 m → ×0,8 ≈ km/h). mass styr knuffar och tacklingar.
export const CARS = {
  bubblan: { name: 'Bubblan', model: 'bubblan', price: 0, vmax: 228, acc: 300, grip: 1300, turn: 3.2, armor: 1.15, mass: 0.7, color: 0x2ab0d8, desc: 'Liten och kvick. Flyger iväg vid minsta knuff.' },
  pirat: { name: 'Piraten', model: 'pirat', price: 0, vmax: 240, acc: 285, grip: 1250, turn: 2.95, armor: 1.0, mass: 1.0, color: 0xd8282c, desc: 'Rallyhalvkombi. Kvick och förlåtande.' },
  traktorn: { name: 'Traktorn', model: 'traktorn', price: 3000, vmax: 195, acc: 270, grip: 1250, turn: 2.5, armor: 0.55, mass: 2.6, offroad: 1.6, color: 0x2e8a3a, desc: 'Långsam men knuffar som en bulldozer. Kör var som helst.' },
  komet: { name: 'Kometen', model: 'komet', price: 3500, vmax: 268, acc: 310, grip: 1320, turn: 2.85, armor: 1.08, mass: 0.95, color: 0x2a5ad8, desc: 'Låg sportkupé med vinge. Snabb i kurvorna.' },
  buffel: { name: 'Buffeln', model: 'buffel', price: 5000, vmax: 250, acc: 300, grip: 1150, turn: 2.6, armor: 0.62, mass: 1.6, offroad: 1.25, color: 0x26a24a, desc: 'Pickup med bågar. Tål allt och knuffar undan.' },
  polisen: { name: 'Polisen', model: 'polisen', price: 6500, vmax: 280, acc: 330, grip: 1260, turn: 2.8, armor: 0.85, mass: 1.35, color: 0x22222c, desc: 'Snabb radiobil med blåljus. Tung nog att trycka undan buset.' },
  skolbussen: { name: 'Skolbussen', model: 'skolbussen', price: 7500, vmax: 235, acc: 245, grip: 1080, turn: 2.2, armor: 0.48, mass: 3.0, color: 0xf2b81c, desc: 'Lång, gul och omöjlig att rubba. Alla andra får flytta på sig.' },
  muskel: { name: 'Muskeln', model: 'muskel', price: 8000, vmax: 292, acc: 345, grip: 1180, turn: 2.6, armor: 0.85, mass: 1.25, color: 0xf27a18, desc: 'V8 och luftintag. Brutal på raksträckor.' },
  monstret: { name: 'Monstret', model: 'monstret', price: 9500, vmax: 258, acc: 305, grip: 1120, turn: 2.5, armor: 0.55, mass: 2.3, offroad: 1.6, color: 0x8a3ad2, desc: 'Monstertruck med jättehjul. Ingen terräng stoppar den.' },
  svavaren: { name: 'Svävaren', model: 'svavaren', price: 11000, vmax: 290, acc: 330, grip: 560, turn: 3.15, armor: 1.1, mass: 0.85, hover: true, color: 0xe8e8ee, desc: 'Svävar på luftkudde – över gräs, is, vatten och lava. Glider i kurvorna.' },
  raket: { name: 'Raketen', model: 'raket', price: 14000, vmax: 318, acc: 380, grip: 1420, turn: 3.0, armor: 0.95, mass: 1.0, color: 0xf2c21c, desc: 'Kilformad superbil med stor vinge.' },
  formeln: { name: 'Formeln', model: 'formeln', price: 16000, vmax: 340, acc: 420, grip: 1560, turn: 3.0, armor: 1.35, mass: 0.8, offroad: 0.8, color: 0xd02030, desc: 'Formelbil. Snabbast av alla men skör och usel i terräng.' },
  pansarvagn: { name: 'Pansarvagnen', model: 'pansarvagn', price: 18000, vmax: 212, acc: 265, grip: 1500, turn: 2.3, armor: 0.3, mass: 3.6, tank: true, offroad: 1.5, color: 0x5e6e3a, desc: 'Band, torn och kanon. Svänger på stället och kör över allt.' },
};
export const CAR_ORDER = ['bubblan', 'pirat', 'traktorn', 'komet', 'buffel', 'polisen', 'skolbussen', 'muskel', 'monstret', 'svavaren', 'raket', 'formeln', 'pansarvagn'];

export const UPGRADES = {
  motor: { name: 'Motor', desc: 'Toppfart och acceleration', prices: [900, 1800, 3200, 5200] },
  dack: { name: 'Däck', desc: 'Grepp i kurvorna och offroad', prices: [700, 1400, 2600, 4200] },
  pansar: { name: 'Pansar', desc: 'Mindre skada av smällar och vapen', prices: [800, 1600, 2800, 4400] },
  nitro: { name: 'Nitro', desc: 'Fler nitroladdningar per lopp', prices: [600, 1200, 2200, 3600] },
  ramm: { name: 'Rambock', desc: 'Hårdare tacklingar, mindre egen skada', prices: [900, 1800, 3000, 4800] },
  ljus: { name: 'Strålkastare', desc: 'Längre och starkare ljus på mörka banor', prices: [400, 900, 1600, 2600] },
};
export const UPG_ORDER = ['motor', 'dack', 'pansar', 'nitro', 'ramm', 'ljus'];

// Tillbehör: köps en gång per bil
export const ACCESSORIES = {
  spoiler: { name: 'Spoiler', price: 1200, desc: 'Lite mer grepp i höga farter. Syns på bilen.' },
  spikdack: { name: 'Spikdäck', price: 1500, desc: 'Punkteringsfria – spikmattor och olja biter sämre.' },
  lagning: { name: 'Självlagning', price: 4000, desc: 'Lagar 1,2 % skada per sekund under loppet.' },
  neon: { name: 'Neonljus', price: 900, desc: 'Lyser under bilen. Snyggast på mörka banor.' },
  tuta: { name: 'Tuta', price: 300, desc: 'T eller H tutar – skrämmer djur av vägen.' },
  turbo: { name: 'Turboaggregat', price: 3500, desc: '12 % mer acceleration hela loppet.' },
};
export const ACC_ORDER = ['spoiler', 'spikdack', 'lagning', 'neon', 'tuta', 'turbo'];

export const PATTERNS = {
  enfarg: { name: 'Enfärgad', price: 0 }, rander: { name: 'Ränder', price: 0 }, flammor: { name: 'Flammor', price: 1500 },
  rutor: { name: 'Rutflagga', price: 1000 }, kamo: { name: 'Kamouflage', price: 1200 }, blixtar: { name: 'Blixtar', price: 1400 },
  prickar: { name: 'Prickar', price: 800 }, tiger: { name: 'Tiger', price: 1600 },
};
export const PATTERN_ORDER = ['rander', 'enfarg', 'flammor', 'rutor', 'kamo', 'blixtar', 'prickar', 'tiger'];

export const FRONT = {
  kulspruta: { name: 'Kulspruta', short: 'KULSPRUTA', price: 0, ammo: 60, perLvl: 20, prices: [800, 1600, 2800], desc: 'Snabba skott rakt fram.' },
  raketer: { name: 'Raketer', short: 'RAKETER', price: 2500, ammo: 4, perLvl: 1, prices: [1200, 2400, 4000], desc: 'Målsökande raketer.' },
  kanon: { name: 'Kanon', short: 'KANON', price: 3500, ammo: 5, perLvl: 1, prices: [1400, 2600, 4200], desc: 'Tung granat – smäller och knuffar iväg bilar.' },
  laser: { name: 'Laser', short: 'LASER', price: 4500, ammo: 100, perLvl: 30, energy: true, prices: [1600, 3000, 4800], desc: 'Stråle så länge du håller in. Energin tar slut.' },
  eld: { name: 'Eldkastare', short: 'ELDKAST', price: 3000, ammo: 100, perLvl: 30, energy: true, prices: [1200, 2400, 3800], desc: 'Kort räckvidd men sätter fyr på bilen framför.' },
  blixt: { name: 'Blixt', short: 'BLIXT', price: 5000, ammo: 3, perLvl: 1, prices: [1800, 3200, 5000], desc: 'Slår ner i bilen framför – motorn dör en stund.' },
};
export const FRONT_ORDER = ['kulspruta', 'raketer', 'kanon', 'laser', 'eld', 'blixt'];
export const REAR = {
  minor: { name: 'Minor', short: 'MINOR', price: 0, ammo: 3, perLvl: 1, prices: [700, 1400, 2600], desc: 'Smäller och kastar bilar i luften.' },
  olja: { name: 'Olja', short: 'OLJA', price: 1500, ammo: 3, perLvl: 1, prices: [700, 1400, 2600], desc: 'Halkig pöl – bilarna snurrar.' },
  rok: { name: 'Rökridå', short: 'RÖK', price: 1200, ammo: 3, perLvl: 1, prices: [600, 1200, 2200], desc: 'Bilarna bakom ser ingenting.' },
  spikar: { name: 'Spikmatta', short: 'SPIKAR', price: 1400, ammo: 3, perLvl: 1, prices: [700, 1400, 2600], desc: 'Punkterar däcken på bilarna bakom.' },
  fat: { name: 'Sprängfat', short: 'FAT', price: 1800, ammo: 3, perLvl: 1, prices: [800, 1600, 2800], desc: 'Tunga fat som exploderar när någon kör på dem.' },
  lim: { name: 'Lim', short: 'LIM', price: 1300, ammo: 3, perLvl: 1, prices: [600, 1200, 2200], desc: 'Klibbig pöl – bilarna fastnar nästan.' },
  bakraket: { name: 'Bakraket', short: 'BAKRAKET', price: 3000, ammo: 2, perLvl: 1, prices: [1200, 2400, 4000], desc: 'Målsökande raket bakåt.' },
};
export const REAR_ORDER = ['minor', 'olja', 'rok', 'spikar', 'fat', 'lim', 'bakraket'];

// Effektiva värden för en bil med uppgraderingar (u) och tillbehör (a)
export function carStats(id, u = {}, a = {}) {
  const c = CARS[id];
  return {
    vmax: c.vmax * (1 + 0.045 * (u.motor || 0)),
    acc: c.acc * (1 + 0.07 * (u.motor || 0)) * (a.turbo ? 1.12 : 1),
    grip: c.grip * (1 + 0.06 * (u.dack || 0)) * (a.spoiler ? 1.05 : 1),
    offroad: (c.offroad || 1) * (1 + 0.05 * (u.dack || 0)),
    turn: c.turn * (1 + 0.02 * (u.dack || 0)),
    armor: c.armor * (1 - 0.11 * (u.pansar || 0)),
    mass: c.mass,
    nitro: 2 + (u.nitro || 0),
    ram: 1 + 0.22 * (u.ramm || 0),
    ramArmor: 1 - 0.15 * (u.ramm || 0),
    light: 1 + 0.3 * (u.ljus || 0),
    hover: !!c.hover, tank: !!c.tank,
    repair: a.lagning ? 1.2 : 0, spikeProof: !!a.spikdack, neon: !!a.neon, horn: !!a.tuta, turbo: !!a.turbo,
  };
}

export const DRIVERS = [
  { name: 'Turbo-Tove', color: 0x2a5ad8 }, { name: 'Gas-Gunnar', color: 0xf2c21c }, { name: 'Sladd-Sune', color: 0x26a24a },
  { name: 'Krock-Kim', color: 0xe8e8ee }, { name: 'Diesel-Doris', color: 0xf27a18 }, { name: 'Nitro-Nils', color: 0x8a3ad2 },
  { name: 'Bucklan-Britt', color: 0x1eb4c8 }, { name: 'Vrål-Viktor', color: 0x2c2a36 }, { name: 'Kurv-Karin', color: 0xe2609e },
  { name: 'Plåt-Pelle', color: 0xb83a2a }, { name: 'Däck-Dagny', color: 0x6ab83a }, { name: 'Avgas-Ali', color: 0xc8c8d4 },
];
