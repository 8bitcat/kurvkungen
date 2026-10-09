// Teman (paletter + terrängregler) och banorna. Koordinater i världsenheter (bilen är ~20 lång).
// Kontrollpunkt: [x, y, vägens höjd, {w: halvbredd, rail: 'L'|'R'|'LR'}]. Start/mål vid punkt 0.

export const THEMES = {
  sjo: {
    name: 'Sjöland',
    grass: 0x5e9e30, grass2: 0x7cb63a, grass3: 0x447f29, dirt: 0x93703f, sand: 0xd8c690, sand2: 0xc4ae74,
    road: 0xb4a78e, line: 0xecc22c, edge: 0xf2ead6, shoulder: 0x9f8a62, curbR: 0xcc3038, curbW: 0xf2eee2,
    rock: 0x8e8c94, rock2: 0xa29a8e, rockDk: 0x575462, deck: 0xb8b2a6,
    water: 0x2f46d2, water2: 0x5470f2, waterDeep: 0x1d2c9e, foam: 0xb8ccff,
    leaf: 0x2c6a2a, leaf2: 0x4c9036, leafDk: 0x173f1d, trunk: 0x5e4232,
    hillAmp: 10, detAmp: 3, cliffShore: 0.75, beach: 26, forest: 0.53, treeDensity: 0.55, trees: ['lov', 'gran', 'lov', 'bjork'],
    rocks: 0.25, fill: 2.4, cut: 0.7, outside: 0x2f46d2, ground: 'grass', animals: ['hare', 'rav', 'radjur', 'alg', 'alg', 'hare'],
  },
  okn: {
    name: 'Öken',
    grass: 0xd69a58, grass2: 0xe6b371, grass3: 0xbf8246, dirt: 0xa8683a, sand: 0xedc98a, sand2: 0xd8a868,
    road: 0x77706a, line: 0xf0c832, edge: 0xeee2c8, shoulder: 0xb48252, curbR: 0xd23a30, curbW: 0xf4ede0,
    rock: 0xb8623e, rock2: 0xcc7c4c, rockDk: 0x6a3226, deck: 0xb09a84,
    water: 0x2a7cb4, water2: 0x4aa2d4, waterDeep: 0x1a5486, foam: 0xbfe6f0,
    leaf: 0x6e7a2e, leaf2: 0x8e9a3c, leafDk: 0x404820, trunk: 0x6a4a30,
    hillAmp: 8, detAmp: 3, cliffShore: 0.2, beach: 20, forest: 2, treeDensity: 0.35, trees: ['kaktus', 'kaktus', 'buske', 'torr'],
    rocks: 0.6, mesa: 0.6, mesaH: 30, fill: 2.6, cut: 0.9, outside: 0xd69a58, ground: 'sand', animals: ['odla', 'odla', 'kamel', 'hare'],
  },
  fjall: {
    name: 'Fjäll',
    grass: 0xe2e8f2, grass2: 0xf6f9ff, grass3: 0xc4cee2, dirt: 0x9c94a0, sand: 0xd2d8e6, sand2: 0xbac4d8,
    road: 0x8e8c96, line: 0xf2d040, edge: 0xf6f6f6, shoulder: 0xa8a4b0, curbR: 0xc8323c, curbW: 0xf4f4f4,
    rock: 0x707688, rock2: 0x868aa0, rockDk: 0x3e4256, deck: 0xa6a4ae,
    water: 0x8cc2e2, water2: 0xbfe2f4, waterDeep: 0x6aa2cc, foam: 0xe8f6ff, ice: true,
    leaf: 0x1f4c3c, leaf2: 0x2f6a4c, leafDk: 0x10281f, trunk: 0x4a3428,
    hillAmp: 16, detAmp: 4, cliffShore: 0.5, beach: 30, forest: 0.5, treeDensity: 0.55, trees: ['snogran', 'snogran', 'gran'],
    rocks: 0.35, fill: 2.0, cut: 0.7, outside: 0xe2e8f2, ground: 'snow', animals: ['hare', 'ren', 'ren', 'bjorn', 'rav'],
  },
  stad: {
    name: 'Stad',
    grass: 0x5a9a3a, grass2: 0x74b244, grass3: 0x447a2c, dirt: 0x8a7050, sand: 0xd8c690, sand2: 0xc4ae74,
    road: 0x58565e, line: 0xf2f0e8, edge: 0xf2f0e8, shoulder: 0xb8b4ac, curbR: 0xc8323a, curbW: 0xf0f0f0,
    rock: 0x8c8a88, rock2: 0x9e9a94, rockDk: 0x4a4850, deck: 0xa8a49e,
    water: 0x2a5a8a, water2: 0x4a80b0, waterDeep: 0x1a3a64, foam: 0xa8c8e8,
    leaf: 0x357a30, leaf2: 0x52a03c, leafDk: 0x1c4a1e, trunk: 0x5e4232,
    hillAmp: 1, detAmp: 0.5, cliffShore: 1, beach: 10, forest: 0.62, treeDensity: 0.22, trees: ['lov', 'lov', 'bjork'],
    rocks: 0.05, fill: 3, cut: 1, outside: 0x2a5a8a, ground: 'city', buildings: 'city', lamps: true, kerb: true, animals: ['duva', 'duva', 'ratta'],
  },
  vulkan: {
    name: 'Vulkan',
    grass: 0x4a4246, grass2: 0x5a5054, grass3: 0x3a3438, dirt: 0x6a4a3a, sand: 0x5a4a44, sand2: 0x4a3c38,
    road: 0x6a666e, line: 0xf2c232, edge: 0xe8e0d8, shoulder: 0x5a4e4a, curbR: 0xd8402a, curbW: 0xf0e8e0,
    rock: 0x3e3438, rock2: 0x524446, rockDk: 0x221c20, deck: 0x7a7470,
    water: 0xf06a1a, water2: 0xffc23c, waterDeep: 0xc0321a, foam: 0xfff2a0, lava: true,
    leaf: 0x4a4430, leaf2: 0x5a5438, leafDk: 0x2a2820, trunk: 0x3a2e28,
    hillAmp: 12, detAmp: 4, cliffShore: 1, beach: 10, forest: 2, treeDensity: 0.3, trees: ['torr', 'torr', 'buske'],
    rocks: 0.9, mesa: 0.58, mesaH: 34, fill: 2.6, cut: 1, outside: 0x2a2226, ground: 'ash', animals: ['odla'],
  },
  host: {
    name: 'Höst',
    grass: 0x8aa040, grass2: 0xa8b850, grass3: 0x6a8a34, dirt: 0x8a6a40, sand: 0xd8c690, sand2: 0xc4ae74,
    road: 0x8e8c88, line: 0xf2f0e8, edge: 0xf2ece0, shoulder: 0x9a8460, curbR: 0xcc3038, curbW: 0xf2eee2,
    rock: 0x8e8a86, rock2: 0xa09a90, rockDk: 0x575460, deck: 0xb0a898,
    water: 0x3a6ab8, water2: 0x5a8ad0, waterDeep: 0x24488a, foam: 0xb8ccf0,
    leaf: 0xc0602a, leaf2: 0xe8a030, leafDk: 0x7a3018, trunk: 0x5e4232,
    leafMix: [[0xc0602a, 0xe8a030, 0x7a3018], [0xb8302a, 0xe05a3a, 0x6a1a14], [0xd8a028, 0xf2d050, 0x8a6018], [0x4a7a2e, 0x6a9a3a, 0x2a4a1c]],
    hillAmp: 9, detAmp: 3, cliffShore: 0.3, beach: 14, forest: 0.58, treeDensity: 0.45, trees: ['hostlov', 'hostlov', 'gran', 'bjork'],
    rocks: 0.15, fill: 2.2, cut: 0.7, outside: 0x8aa040, ground: 'grass', fields: true, buildings: 'barn', animals: ['ko', 'ko', 'far', 'gris', 'hona'],
  },
  tropik: {
    name: 'Tropik',
    grass: 0x46a83c, grass2: 0x62c04a, grass3: 0x32882e, dirt: 0x8a6a40, sand: 0xf0dc9a, sand2: 0xdcc282,
    road: 0xa49c8c, line: 0xf2c232, edge: 0xf6f2e8, shoulder: 0xd8c690, curbR: 0xd83a40, curbW: 0xf6f2ea,
    rock: 0x9a8a78, rock2: 0xb0a08a, rockDk: 0x5a4e44, deck: 0xb89a70,
    water: 0x28b8c8, water2: 0x7ae8ec, waterDeep: 0x1a58b0, foam: 0xf0ffff, shallow: 0x46d8d0,
    leaf: 0x2a8a3a, leaf2: 0x5ac048, leafDk: 0x145a24, trunk: 0x6a4a30,
    hillAmp: 8, detAmp: 3, cliffShore: 0.12, beach: 46, forest: 0.56, treeDensity: 0.5, trees: ['palm', 'palm', 'palm', 'buske'],
    rocks: 0.12, fill: 2.2, cut: 0.7, outside: 0x1a58b0, ground: 'grass', animals: ['krabba', 'krabba', 'flamingo'],
  },
  manen: {
    name: 'Månen',
    grass: 0x9a9aa2, grass2: 0xb2b2ba, grass3: 0x80808a, dirt: 0x8a8a92, sand: 0xa4a4ac, sand2: 0x90909a,
    road: 0x4a4a56, line: 0x60e0ff, edge: 0xf0f4ff, shoulder: 0x707078, curbR: 0x30b8f0, curbW: 0xf0f4ff,
    rock: 0x7a7a84, rock2: 0x8c8c96, rockDk: 0x4a4a54, deck: 0x9a9aa6,
    water: 0x2a2a34, water2: 0x3a3a46, waterDeep: 0x1a1a22, foam: 0x5a5a66,
    leaf: 0x5a5a64, leaf2: 0x6a6a74, leafDk: 0x3a3a44, trunk: 0x4a4a54,
    hillAmp: 6, detAmp: 3, cliffShore: 1, beach: 10, forest: 2, treeDensity: 0.2, trees: ['sten', 'sten', 'lampa'],
    rocks: 0.8, fill: 2.2, cut: 0.8, outside: 0x07070e, ground: 'moon', craters: true, grav: 0.42, lamps: true, animals: ['alien'],
  },
};

export const TRACKS = {
  sjoviken: {
    id: 'sjoviken', name: 'Sjöviken', theme: 'sjo', size: [2048, 2048], seed: 11, hw: 28,
    points: [
      [560, 1650, 22], [900, 1700, 22], [1250, 1680, 22], [1560, 1620, 24], [1760, 1480, 26],
      [1640, 1330, 26], [1480, 1300, 26], [1520, 1160, 26], [1730, 1080, 26], [1800, 880, 24],
      [1640, 720, 22], [1760, 520, 20], [1640, 300, 18], [1400, 230, 18], [1220, 360, 16],
      [1260, 560, 14], [1060, 680, 14], [860, 600, 14], [740, 440, 16], [560, 300, 18],
      [330, 330, 18], [250, 560, 16], [360, 760, 18], [240, 960, 20], [400, 1140, 22],
      [260, 1320, 22], [330, 1530, 22],
    ],
    lakes: [{ x: 1020, y: 1060, rx: 330, ry: 230, rot: 0.35 }],
    rivers: [{ w: 54, pts: [[900, 870], [740, 760], [560, 640], [380, 580], [200, 560], [-40, 570]] }],
  },
  kanjonen: {
    id: 'kanjonen', name: 'Kanjonen', theme: 'okn', size: [2048, 2048], seed: 23, hw: 28,
    points: [
      [520, 1700, 18], [920, 1740, 18], [1300, 1700, 20], [1620, 1600, 22], [1800, 1400, 24],
      [1700, 1220, 24], [1460, 1260, 24], [1260, 1180, 22], [1300, 1000, 20], [1560, 980, 20],
      [1780, 860, 18], [1800, 620, 16], [1600, 480, 16], [1720, 290, 16], [1460, 200, 16],
      [1200, 300, 16], [1060, 520, 14], [820, 470, 16], [660, 270, 18], [400, 260, 18],
      [230, 460, 18], [420, 640, 16], [600, 780, 16], [460, 960, 18], [260, 1100, 18],
      [300, 1340, 18], [280, 1560, 18],
    ],
    lakes: [{ x: 960, y: 1180, rx: 160, ry: 110, rot: 0.3 }],
    rivers: [{ w: 58, pts: [[2100, 760], [1800, 760], [1500, 700], [1250, 760], [1000, 680], [760, 620], [520, 560], [260, 560], [-60, 600]] }],
  },
  fjallet: {
    id: 'fjallet', name: 'Fjället', theme: 'fjall', size: [2048, 2048], seed: 37, hw: 28,
    points: [
      [640, 1720, 14], [1020, 1760, 14], [1380, 1700, 16], [1660, 1560, 20], [1800, 1330, 24],
      [1620, 1200, 28], [1760, 1020, 32], [1580, 900, 34], [1760, 720, 38], [1700, 480, 40],
      [1480, 360, 40], [1300, 520, 36], [1100, 420, 34], [880, 280, 34], [620, 300, 32],
      [520, 520, 28], [700, 680, 24], [560, 860, 20], [300, 820, 20], [220, 1060, 18],
      [420, 1220, 16], [260, 1420, 14], [380, 1620, 14],
    ],
    lakes: [{ x: 1080, y: 1150, rx: 340, ry: 240, rot: -0.2 }],
    rivers: [],
  },
  hamnstaden: {
    id: 'hamnstaden', name: 'Hamnstaden', theme: 'stad', size: [2048, 2048], seed: 53, hw: 28,
    points: [
      [420, 1680, 10], [900, 1730, 10], [1320, 1700, 10], [1660, 1600, 10], [1790, 1380, 10],
      [1620, 1200, 10], [1360, 1250, 10], [1140, 1110, 10], [1240, 900, 10], [1540, 840, 10],
      [1770, 700, 12], [1720, 470, 14], [1470, 360, 14], [1180, 400, 12], [960, 600, 10],
      [700, 500, 10], [460, 360, 10], [260, 540, 10], [400, 780, 10], [250, 1020, 10],
      [400, 1260, 10], [260, 1480, 10],
    ],
    lakes: [{ x: 1000, y: 100, rx: 900, ry: 150, rot: 0 }],
    rivers: [{ w: 48, pts: [[-40, 1150], [600, 1100], [1000, 1010], [1400, 1060], [2100, 980]] }],
  },
  vulkanen: {
    id: 'vulkanen', name: 'Vulkanen', theme: 'vulkan', size: [2048, 2048], seed: 61, hw: 28,
    points: [
      [600, 1720, 24], [1000, 1770, 24], [1400, 1710, 26], [1720, 1560, 28], [1800, 1300, 30],
      [1640, 1100, 32], [1770, 880, 34], [1600, 660, 34], [1700, 420, 32], [1450, 250, 30],
      [1150, 300, 28], [1000, 520, 26], [760, 420, 26], [520, 260, 26], [280, 380, 26],
      [300, 640, 26], [520, 820, 26], [380, 1040, 24], [240, 1260, 24], [380, 1500, 24],
    ],
    lakes: [{ x: 1100, y: 1170, rx: 320, ry: 250, rot: 0.2 }],
    rivers: [{ w: 50, pts: [[1100, 1170], [900, 820], [700, 680], [420, 570], [-40, 530]] }],
  },
  hostgarden: {
    id: 'hostgarden', name: 'Höstgården', theme: 'host', size: [2048, 2048], seed: 71, hw: 28,
    points: [
      [500, 1700, 16], [900, 1780, 18], [1300, 1720, 20], [1600, 1560, 20], [1500, 1340, 18],
      [1700, 1180, 20], [1780, 940, 22], [1560, 780, 22], [1300, 860, 20], [1100, 700, 18],
      [1250, 480, 18], [1500, 330, 18], [1250, 200, 18], [900, 260, 18], [700, 460, 16],
      [450, 380, 16], [260, 560, 16], [420, 780, 16], [300, 1000, 16], [460, 1200, 16],
      [300, 1450, 16],
    ],
    lakes: [{ x: 880, y: 1160, rx: 210, ry: 150, rot: 0.1 }],
    rivers: [{ w: 34, pts: [[880, 1160], [700, 1010], [540, 920], [200, 870], [-40, 880]] }],
  },
  palmon: {
    id: 'palmon', name: 'Palmön', theme: 'tropik', size: [2048, 2048], seed: 83, hw: 28,
    points: [
      [520, 1600, 8], [900, 1700, 8], [1300, 1690, 8], [1620, 1560, 10], [1760, 1300, 12],
      [1690, 1040, 12], [1790, 800, 10], [1640, 560, 10], [1400, 390, 10], [1100, 330, 10],
      [850, 450, 12], [620, 330, 10], [380, 420, 10], [300, 680, 10], [480, 900, 12],
      [330, 1120, 10], [300, 1380, 8],
    ],
    island: { x: 1040, y: 1020, rx: 930, ry: 900 },
    lakes: [{ x: 1120, y: 1040, rx: 250, ry: 190, rot: 0.3 }],
    rivers: [{ w: 60, pts: [[1120, 1040], [1300, 1350], [1440, 1650], [1560, 2100]] }],
  },
  manbasen: {
    id: 'manbasen', name: 'Månbasen', theme: 'manen', size: [2048, 2048], seed: 97, hw: 28,
    points: [
      [600, 1720, 20], [1050, 1760, 20, { jump: 10 }], [1420, 1700, 22], [1720, 1520, 24], [1790, 1260, 26],
      [1600, 1080, 28], [1760, 860, 30], [1690, 600, 30, { jump: 9 }], [1460, 420, 30], [1180, 340, 30],
      [900, 420, 28], [700, 300, 28], [440, 340, 26], [260, 560, 24, { jump: 9 }], [380, 820, 22],
      [270, 1020, 22], [420, 1250, 20], [300, 1490, 20],
    ],
    lakes: [], rivers: [],
  },
};
// Varje bana finns även baklänges och på natten (samma terräng)
for (const id of Object.keys(TRACKS)) {
  const t = TRACKS[id];
  TRACKS[id + '_r'] = { ...t, id: id + '_r', base: id, rev: true, points: [t.points[0], ...t.points.slice(1).reverse()] };
}
for (const id of Object.keys(TRACKS)) {
  const t = TRACKS[id];
  TRACKS[id + '_n'] = { ...t, id: id + '_n', base: t.base || id, night: true };
}
// ---------- Grand Prix-banorna: större, långa raksträckor, depåfil vid start/mål ----------
// pit: depåfilen ligger på bortre sidan av start-/målrakan (från s0 före linjen till s1 efter).
export const GP_TRACKS = {
  kungsringen: {
    id: 'kungsringen', name: 'Kungsringen', theme: 'sjo', size: [2600, 2600], seed: 113, hw: 30, f1: true, pit: { s0: -620, s1: 560 },
    points: [
      [1150, 2280, 20], [1800, 2280, 20], [1930, 2215, 20], [2060, 2260, 20], [2290, 2120, 22], [2370, 1800, 24],
      [2340, 1380, 26], [2220, 1150, 26], [1980, 1060, 26], [1790, 1120, 26], [1420, 1060, 24], [1050, 1000, 22],
      [900, 930, 22], [770, 990, 22], [610, 920, 22], [330, 900, 22], [250, 1250, 22], [270, 1750, 22], [360, 2120, 22], [560, 2270, 20],
    ],
    lakes: [{ x: 1300, y: 1640, rx: 520, ry: 300, rot: 0.1 }], rivers: [],
  },
  okenringen: {
    id: 'okenringen', name: 'Ökenringen', theme: 'okn', size: [2600, 2600], seed: 127, hw: 30, f1: true, pit: { s0: -620, s1: 560 },
    points: [
      [1100, 2300, 18], [1720, 2300, 18], [1880, 2200, 18], [1830, 1980, 18], [1980, 1800, 18], [2350, 1760, 20],
      [2420, 1560, 20], [2200, 1420, 22], [1980, 1300, 24], [2080, 1080, 24], [1880, 900, 24], [2080, 680, 24],
      [1900, 420, 22], [1560, 420, 20], [1380, 640, 20], [1150, 520, 20], [880, 620, 20], [940, 960, 20],
      [700, 1180, 18], [420, 1100, 18], [300, 1450, 18], [460, 1820, 18], [320, 2100, 18], [520, 2300, 18],
    ],
    lakes: [], rivers: [{ w: 56, pts: [[-60, 1600], [600, 1560], [1200, 1300], [1700, 1150], [2700, 1200]] }],
  },
  hamnslingan: {
    id: 'hamnslingan', name: 'Hamnslingan', theme: 'stad', size: [2600, 2600], seed: 131, hw: 28, f1: true, pit: { s0: -620, s1: 560 },
    points: [
      [1150, 2300, 10], [1800, 2300, 10], [2000, 2230, 10], [2040, 1980, 10], [2300, 1880, 10], [2340, 1560, 10],
      [2080, 1420, 10], [2100, 1080, 10], [2360, 940, 10], [2320, 560, 10], [2050, 420, 10], [1700, 400, 10],
      [1300, 400, 10], [1180, 640, 10], [1420, 820, 10], [1280, 1060, 10], [900, 1000, 10], [700, 800, 10],
      [420, 820, 10], [330, 1200, 10], [560, 1450, 10], [380, 1750, 10], [300, 2100, 10], [520, 2290, 10],
    ],
    lakes: [{ x: 1300, y: 120, rx: 1200, ry: 170, rot: 0 }], rivers: [{ w: 50, pts: [[-60, 1280], [700, 1220], [1500, 1280], [2700, 1250]] }],
  },
  fjallringen: {
    id: 'fjallringen', name: 'Fjällringen', theme: 'fjall', size: [2600, 2600], seed: 139, hw: 30, f1: true, pit: { s0: -620, s1: 560 },
    points: [
      [1150, 2300, 16], [1720, 2300, 16], [1850, 2200, 12], [1950, 2000, 22], [2050, 1750, 32], [2150, 1300, 38],
      [2200, 900, 40], [2050, 680, 40], [2150, 460, 38], [1850, 330, 34], [1550, 480, 30], [1500, 760, 28],
      [1250, 900, 26], [1000, 760, 26], [700, 820, 26], [480, 1050, 24], [560, 1400, 22], [380, 1700, 20],
      [420, 2000, 18], [330, 2150, 17], [450, 2260, 16], [560, 2230, 16], [640, 2300, 16],
    ],
    lakes: [{ x: 1300, y: 1550, rx: 380, ry: 260, rot: -0.3 }], rivers: [],
  },
  hostringen: {
    id: 'hostringen', name: 'Höstringen', theme: 'host', size: [2600, 2600], seed: 149, hw: 30, f1: true, pit: { s0: -620, s1: 560 },
    points: [
      [1150, 2300, 18], [1750, 2300, 18], [2050, 2180, 18], [2200, 1950, 20], [2080, 1780, 20], [2230, 1620, 20],
      [2100, 1460, 20], [2240, 1280, 22], [2330, 900, 22], [2250, 600, 22], [1950, 450, 22], [1600, 560, 22],
      [1300, 400, 20], [900, 450, 20], [700, 700, 20], [900, 950, 20], [800, 1250, 20], [450, 1300, 18],
      [300, 1650, 18], [450, 2000, 18], [380, 2200, 18], [580, 2300, 18],
    ],
    lakes: [{ x: 1500, y: 1500, rx: 300, ry: 220, rot: 0.2 }], rivers: [],
  },
  palmringen: {
    id: 'palmringen', name: 'Palmringen', theme: 'tropik', size: [2600, 2600], seed: 151, hw: 30, f1: true, pit: { s0: -620, s1: 560 },
    points: [
      [1150, 2200, 8], [1800, 2200, 8], [2050, 2080, 8], [2150, 1800, 10], [2300, 1500, 10], [2280, 1100, 12],
      [2100, 850, 12], [2250, 560, 10], [1950, 400, 10], [1500, 450, 10], [1100, 420, 10], [800, 520, 12],
      [600, 400, 12], [380, 560, 12], [450, 900, 12], [700, 1100, 12], [520, 1400, 10], [350, 1700, 10],
      [420, 2000, 8], [620, 2180, 8],
    ],
    island: { x: 1300, y: 1300, rx: 1240, ry: 1220 },
    lakes: [{ x: 1350, y: 1400, rx: 380, ry: 300, rot: 0.25 }], rivers: [{ w: 70, pts: [[1350, 1400], [1150, 950], [1000, 600], [900, 100], [900, -100]] }],
  },
};
// skala upp GP-banorna till en 3000×3000-värld
const GPK = 1.15;
for (const id of Object.keys(GP_TRACKS)) {
  const d = GP_TRACKS[id];
  d.size = [3000, 3000];
  d.points = d.points.map(([x, y, z, o]) => (o ? [x * GPK, y * GPK, z, o] : [x * GPK, y * GPK, z]));
  d.lakes = (d.lakes || []).map((l) => ({ ...l, x: l.x * GPK, y: l.y * GPK, rx: l.rx * GPK, ry: l.ry * GPK }));
  d.rivers = (d.rivers || []).map((r) => ({ ...r, w: r.w, pts: r.pts.map(([x, y]) => [x * GPK, y * GPK]) }));
  if (d.island) d.island = { x: d.island.x * GPK, y: d.island.y * GPK, rx: d.island.rx * GPK, ry: d.island.ry * GPK };
  d.pit = { s0: -480, s1: 440 };
}
for (const id of Object.keys(GP_TRACKS)) {
  TRACKS[id] = GP_TRACKS[id];
  TRACKS[id + '_n'] = { ...GP_TRACKS[id], id: id + '_n', base: id, night: true };
}
export const GP_ORDER = ['kungsringen', 'okenringen', 'hamnslingan', 'fjallringen', 'hostringen', 'palmringen'];
export const BASE_TRACKS = ['sjoviken', 'kanjonen', 'fjallet', 'hostgarden', 'hamnstaden', 'palmon', 'vulkanen', 'manbasen'];
export const TRACK_ORDER = BASE_TRACKS.flatMap((b) => [b, b + '_r', b + '_n', b + '_r_n']);
export const trackName = (id) => {
  const t = TRACKS[id], base = TRACKS[t.base || id];
  return base.name.toUpperCase() + (t.rev ? ' (BAKLÄNGES)' : '') + (t.night ? ' (NATT)' : '');
};
