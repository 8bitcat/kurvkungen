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
    rocks: 0.25, fill: 2.4, cut: 0.7, outside: 0x2f46d2, ground: 'grass',
  },
  okn: {
    name: 'Öken',
    grass: 0xd69a58, grass2: 0xe6b371, grass3: 0xbf8246, dirt: 0xa8683a, sand: 0xedc98a, sand2: 0xd8a868,
    road: 0x77706a, line: 0xf0c832, edge: 0xeee2c8, shoulder: 0xb48252, curbR: 0xd23a30, curbW: 0xf4ede0,
    rock: 0xb8623e, rock2: 0xcc7c4c, rockDk: 0x6a3226, deck: 0xb09a84,
    water: 0x2a7cb4, water2: 0x4aa2d4, waterDeep: 0x1a5486, foam: 0xbfe6f0,
    leaf: 0x6e7a2e, leaf2: 0x8e9a3c, leafDk: 0x404820, trunk: 0x6a4a30,
    hillAmp: 8, detAmp: 3, cliffShore: 0.2, beach: 20, forest: 2, treeDensity: 0.35, trees: ['kaktus', 'kaktus', 'buske', 'torr'],
    rocks: 0.6, mesa: 0.6, mesaH: 30, fill: 2.6, cut: 0.9, outside: 0xd69a58, ground: 'sand',
  },
  fjall: {
    name: 'Fjäll',
    grass: 0xe2e8f2, grass2: 0xf6f9ff, grass3: 0xc4cee2, dirt: 0x9c94a0, sand: 0xd2d8e6, sand2: 0xbac4d8,
    road: 0x8e8c96, line: 0xf2d040, edge: 0xf6f6f6, shoulder: 0xa8a4b0, curbR: 0xc8323c, curbW: 0xf4f4f4,
    rock: 0x707688, rock2: 0x868aa0, rockDk: 0x3e4256, deck: 0xa6a4ae,
    water: 0x8cc2e2, water2: 0xbfe2f4, waterDeep: 0x6aa2cc, foam: 0xe8f6ff, ice: true,
    leaf: 0x1f4c3c, leaf2: 0x2f6a4c, leafDk: 0x10281f, trunk: 0x4a3428,
    hillAmp: 16, detAmp: 4, cliffShore: 0.5, beach: 30, forest: 0.5, treeDensity: 0.55, trees: ['snogran', 'snogran', 'gran'],
    rocks: 0.35, fill: 2.0, cut: 0.7, outside: 0xe2e8f2, ground: 'snow',
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
};
// Varje bana finns även baklänges (samma terräng, omvänd körriktning)
for (const id of Object.keys(TRACKS)) {
  const t = TRACKS[id];
  TRACKS[id + '_r'] = { ...t, id: id + '_r', name: t.name + ' B', rev: true, points: [t.points[0], ...t.points.slice(1).reverse()] };
}
export const TRACK_ORDER = ['sjoviken', 'kanjonen', 'fjallet', 'sjoviken_r', 'kanjonen_r', 'fjallet_r'];
export const trackName = (id) => (TRACKS[id].rev ? TRACKS[id.replace('_r', '')].name.toUpperCase() + ' (BAKLÄNGES)' : TRACKS[id].name.toUpperCase());
