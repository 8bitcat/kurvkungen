// Bilar, uppgraderingar och vapen. Fart i världsenheter/s (bilen ~20 lång ≈ 4,5 m → ×0,8 ≈ km/h).
export const CARS = {
  pirat: { name: 'Piraten', model: 'pirat', price: 0, vmax: 240, acc: 285, grip: 1250, turn: 2.95, armor: 1.0, mass: 1.0, desc: 'Rallyhalvkombi. Kvick och förlåtande.' },
  komet: { name: 'Kometen', model: 'komet', price: 3500, vmax: 268, acc: 310, grip: 1320, turn: 2.85, armor: 1.08, mass: 0.95, desc: 'Låg sportkupé med vinge. Snabb i kurvorna.' },
  buffel: { name: 'Buffeln', model: 'buffel', price: 5000, vmax: 250, acc: 300, grip: 1150, turn: 2.6, armor: 0.62, mass: 1.55, desc: 'Pickup med bågar. Tål allt och knuffar undan.' },
  muskel: { name: 'Muskeln', model: 'muskel', price: 8000, vmax: 292, acc: 345, grip: 1180, turn: 2.6, armor: 0.85, mass: 1.25, desc: 'V8 och luftintag. Brutal på raksträckor.' },
  raket: { name: 'Raketen', model: 'raket', price: 14000, vmax: 318, acc: 380, grip: 1420, turn: 3.0, armor: 0.95, mass: 1.0, desc: 'Kilformad superbil. Bäst av allt – kostar därefter.' },
};
export const CAR_ORDER = ['pirat', 'komet', 'buffel', 'muskel', 'raket'];

export const UPGRADES = {
  motor: { name: 'Motor', desc: 'Toppfart och acceleration', prices: [900, 1800, 3200, 5200] },
  dack: { name: 'Däck', desc: 'Grepp i kurvorna och offroad', prices: [700, 1400, 2600, 4200] },
  pansar: { name: 'Pansar', desc: 'Mindre skada av smällar och vapen', prices: [800, 1600, 2800, 4400] },
  nitro: { name: 'Nitro', desc: 'Fler nitroladdningar per lopp', prices: [600, 1200, 2200, 3600] },
};
export const UPG_ORDER = ['motor', 'dack', 'pansar', 'nitro'];

export const FRONT = {
  kulspruta: { name: 'Kulspruta', short: 'KULSPRUTA', price: 0, ammo: 60, perLvl: 20, prices: [800, 1600, 2800] },
  raketer: { name: 'Raketer', short: 'RAKETER', price: 2500, ammo: 4, perLvl: 1, prices: [1200, 2400, 4000] },
};
export const REAR = {
  minor: { name: 'Minor', short: 'MINOR', price: 0, ammo: 3, perLvl: 1, prices: [700, 1400, 2600] },
  olja: { name: 'Olja', short: 'OLJA', price: 1500, ammo: 3, perLvl: 1, prices: [700, 1400, 2600] },
  rok: { name: 'Rökridå', short: 'RÖK', price: 1200, ammo: 3, perLvl: 1, prices: [600, 1200, 2200] },
};

// Effektiva värden för en bil med uppgraderingar (u = {motor, dack, pansar, nitro})
export function carStats(id, u = {}) {
  const c = CARS[id];
  return {
    vmax: c.vmax * (1 + 0.045 * (u.motor || 0)),
    acc: c.acc * (1 + 0.07 * (u.motor || 0)),
    grip: c.grip * (1 + 0.06 * (u.dack || 0)),
    offroad: 1 + 0.05 * (u.dack || 0),
    turn: c.turn * (1 + 0.02 * (u.dack || 0)),
    armor: c.armor * (1 - 0.11 * (u.pansar || 0)),
    mass: c.mass,
    nitro: 2 + (u.nitro || 0),
  };
}

export const DRIVERS = [
  { name: 'Turbo-Tove', color: 0x2a5ad8 }, { name: 'Gas-Gunnar', color: 0xf2c21c }, { name: 'Sladd-Sune', color: 0x26a24a },
  { name: 'Krock-Kim', color: 0xe8e8ee }, { name: 'Diesel-Doris', color: 0xf27a18 }, { name: 'Nitro-Nils', color: 0x8a3ad2 },
  { name: 'Bucklan-Britt', color: 0x1eb4c8 }, { name: 'Vrål-Viktor', color: 0x2c2a36 }, { name: 'Kurv-Karin', color: 0xe2609e },
];
