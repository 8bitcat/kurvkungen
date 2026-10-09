// Grand Prix-läget: stallen (dagens färger, egna namn), förarna, däcken och poängen.
// perf = bilens styrka 0..1 (motor/aerodynamik), skill = förarnas skicklighet.

export const TEAMS = [
  { id: 'tjur', name: 'Tjurkraft Racing', short: 'TJUR', c1: 0x1b2a5c, c2: 0xd8202a, c3: 0xffcc00, perf: 0.95, drivers: [['Viktor Brandt', 'BRA', 0.97], ['Jonah Pell', 'PEL', 0.8]] },
  { id: 'stallone', name: 'Scuderia Stallone', short: 'STAL', c1: 0xdc1e1e, c2: 0x1c1a20, c3: 0xffd200, perf: 0.94, drivers: [['Marco Ferri', 'FER', 0.9], ['Theo Harte', 'HAR', 0.9]] },
  { id: 'silver', name: 'Silverpilen', short: 'SILV', c1: 0xc0c4cc, c2: 0x18181e, c3: 0x00c8b0, perf: 0.97, drivers: [['Elliot Ruskin', 'RUS', 0.9], ['Nils Antell', 'ANT', 0.84]] },
  { id: 'papaya', name: 'Papaya Racing', short: 'PAPA', c1: 0xff8000, c2: 0x1a1a1e, c3: 0x3ab0f0, perf: 0.96, drivers: [['Leo Norrby', 'NOR', 0.93], ['Owen Pierce', 'PIE', 0.92]] },
  { id: 'grona', name: 'Grön Vinge', short: 'GRÖN', c1: 0x00594f, c2: 0x0c2a26, c3: 0xcedc00, perf: 0.84, drivers: [['Diego Alba', 'ALB', 0.88], ['Ludvig Strand', 'STR', 0.76]] },
  { id: 'alpin', name: 'Alpinia', short: 'ALPI', c1: 0x0a72d2, c2: 0x0c1c3a, c3: 0xff5aa8, perf: 0.8, drivers: [['Hugo Gaspard', 'GAS', 0.84], ['Mateo Colán', 'COL', 0.78]] },
  { id: 'wille', name: 'Wilhelm Racing', short: 'WILH', c1: 0x0a2a6e, c2: 0x0c1430, c3: 0x37bedd, perf: 0.86, drivers: [['Rafael Sainte', 'SAI', 0.88], ['Adam Albion', 'ALN', 0.85]] },
  { id: 'kalv', name: 'Tjurkalvarna', short: 'KALV', c1: 0xf2f2f6, c2: 0x2b4bdc, c3: 0xd8202a, perf: 0.83, drivers: [['Liam Lawton', 'LAW', 0.8], ['Isak Hadar', 'HAD', 0.83]] },
  { id: 'ringen', name: 'Fyrklövern', short: 'FYRK', c1: 0x8a8e96, c2: 0x18181c, c3: 0xe8002d, perf: 0.82, drivers: [['Felix Hultén', 'HUL', 0.84], ['Bruno Borto', 'BOR', 0.82]] },
  { id: 'hasse', name: 'Hasse Motorsport', short: 'HASS', c1: 0xf0f0f2, c2: 0x1c1c22, c3: 0xd2232a, perf: 0.81, drivers: [['Emil Okon', 'OKO', 0.82], ['Olle Bergman', 'BER', 0.82]] },
  { id: 'dynamo', name: 'Detroit Dynamo', short: 'DYNA', c1: 0x111114, c2: 0xf2f2f2, c3: 0xc9a24a, perf: 0.78, drivers: [['Rocco Reyes', 'REY', 0.84], ['Ville Botta', 'BOT', 0.82]] },
];
export const teamById = (id) => TEAMS.find((t) => t.id === id) || TEAMS[0];

// Däcken: grepp, slitage (relativt) och färgen på sidan
export const COMPOUNDS = {
  soft: { name: 'MJUKA', letter: 'S', grip: 1.045, wear: 1.0, color: 0xe8202a },
  medium: { name: 'MEDIUM', letter: 'M', grip: 1.0, wear: 0.62, color: 0xf2c21c },
  hard: { name: 'HÅRDA', letter: 'H', grip: 0.962, wear: 0.42, color: 0xf2f2f2 },
};
export const COMPOUND_ORDER = ['soft', 'medium', 'hard'];
// Greppfaktor ur slitage (0..100 %): jämn nedgång, sedan ett stup efter 80 %
export function tyreGrip(compound, wear) {
  const c = COMPOUNDS[compound], w = Math.min(100, wear) / 100;
  return c.grip * (1 - 0.16 * Math.pow(w, 1.5) - (w > 0.8 ? (w - 0.8) / 0.2 * 0.24 : 0));
}

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const PIT_LIMIT = 100; // världsenheter/s
export const KMH_F1 = 0.98;  // F1-bilen är ~24 enheter ≈ 5,6 m
export const LAP_OPTIONS = [3, 5, 8, 10, 12, 15, 20];

// Bilens egenskaper ur stallets styrka. tf = hur mycket styrningen avtar med farten (vanliga bilar 0,3):
// F1-bilen svänger skarpt i låg fart men måste bromsa in i kurvorna. brk = inbromsning (vanliga 560).
export function f1Stats(perf) {
  return {
    vmax: 318 + perf * 30, acc: 236 + perf * 50, grip: 1350 + perf * 260, turn: 2.12 + perf * 0.18, tf: 0.6, brk: 820,
    armor: 1, mass: 1.0, offroad: 0.85, df: 0.95, nitro: 0,
    ram: 1, ramArmor: 1, light: 1.6, hover: false, tank: false, repair: 0, spikeProof: false, neon: false, horn: false, turbo: false,
  };
}
