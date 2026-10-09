// Fordonen som små 3D-modeller (fasade lådor, cylindrar, ellipsoider) som strålföljs till pixelsprites
// i 64 vinklar – samma ljus som terrängen, tonband i rampen, bläckkant mellan delar och sel-out-kontur.
// Lokala axlar: x framåt, y höger, z upp. 1 enhet = 1 världsenhet (personbilen är ~20 lång).
import { Pix, mix, mul, ramp, shade, hash } from './pix.js?v=1';
import { LX, LY, LZ } from './iso.js?v=1';

export const ANGLES = 64;

const V3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const plane = (n, p, mat) => { const [nx, ny, nz] = V3(...n); return [nx, ny, nz, nx * p[0] + ny * p[1] + nz * p[2], mat]; };

// Låda med fasade kanter. c = {t: topkanter, v: lodräta hörn, f: nos, r: bak, b: underkant fram/bak, s: underkant sidor}
function box(x0, x1, y0, y1, z0, z1, mat, c = {}) {
  const P = [
    plane([1, 0, 0], [x1, 0, 0]), plane([-1, 0, 0], [x0, 0, 0]),
    plane([0, 1, 0], [0, y1, 0]), plane([0, -1, 0], [0, y0, 0]),
    plane([0, 0, 1], [0, 0, z1]), plane([0, 0, -1], [0, 0, z0]),
  ];
  if (c.t) { P.push(plane([0, 1, 1], [0, y1 - c.t, z1]), plane([0, -1, 1], [0, y0 + c.t, z1])); }
  if (c.v) { for (const sx of [1, -1]) for (const sy of [1, -1]) P.push(plane([sx, sy, 0], [sx > 0 ? x1 - c.v : x0 + c.v, sy > 0 ? y1 : y0, 0])); }
  if (c.f) P.push(plane([c.fz ?? 1, 0, c.fx ?? 1], [x1 - c.f, 0, z1]));
  if (c.r) P.push(plane([-(c.rz ?? 1), 0, c.rx ?? 1], [x0 + c.r, 0, z1]));
  if (c.b) { P.push(plane([1, 0, -1], [x1 - c.b, 0, z0]), plane([-1, 0, -1], [x0 + c.b, 0, z0])); }
  if (c.s) { P.push(plane([0, 1, -1], [0, y1 - c.s, z0]), plane([0, -1, -1], [0, y0 + c.s, z0])); }
  return { t: 'poly', P, mat };
}
// Kupé: botten z0, tak z1, vindruta som lutar `wf` bakåt, bakruta `wr`, sidor drar in `si`.
function cabin(xr, xf, hw, z0, z1, wf, wr, si, mat = 'glass', roof = 'paint') {
  const h = z1 - z0;
  return {
    t: 'poly', mat,
    P: [
      plane([0, 0, 1], [0, 0, z1], roof), plane([0, 0, -1], [0, 0, z0]),
      plane([h, 0, wf], [xf, 0, z0]), plane([-h, 0, wr], [xr, 0, z0]),
      plane([0, h, si], [0, hw, z0]), plane([0, -h, si], [0, -hw, z0]),
    ],
  };
}
const cyl = (x, y, z, r, w, mat, ax = 1) => ({ t: 'cyl', c: [x, y, z], r, hw: w / 2, mat, ax });
const ell = (x, y, z, rx, ry, rz, mat) => ({ t: 'ell', c: [x, y, z], r: [rx, ry, rz], mat });
const wheel = (x, y, z, r, w, mat = 'tire') => cyl(x, y, z, r, w, mat, 1);
const wheels = (xf, xr, yw, r, w, rr = r, wr = w) => [
  wheel(xf, yw, r, r, w), wheel(xf, -yw, r, r, w), wheel(xr, yw, rr, rr, wr), wheel(xr, -yw, rr, rr, wr),
];

// ext: [xmin, xmax, halvbredd, höjd] för spritens storlek; sp: [bak-x, takhöjd] för spoiler; fr: front-x för rambock
export const MODELS = {
  f1: { // modern formel 1-bil: lång nos, vingar, sidolådor, halo
    len: 24, wid: 10, ext: [-12.8, 12.9, 5.1, 6.9], sp: null, fr: null, stripe: 'f1', wing: [2, 3, 4, 5], parts: () => [
      box(-9.6, 7.6, -2.7, 2.7, 0.4, 0.9, 'black'),
      box(4.0, 12.2, -0.9, 0.9, 1.0, 2.5, 'paint', { t: 0.4, f: 2.2, fx: 4, fz: 1 }),
      box(10.2, 12.8, -4.2, 4.2, 0.5, 1.0, 'paint', { f: 0.3 }), box(10.0, 11.0, -4.0, 4.0, 1.0, 1.6, 'accent'),
      box(10.0, 12.8, 4.0, 4.3, 0.5, 2.0, 'paint2'), box(10.0, 12.8, -4.3, -4.0, 0.5, 2.0, 'paint2'),
      box(-3.2, 4.4, -1.4, 1.4, 1.0, 3.7, 'paint', { t: 0.7, f: 0.6 }),
      box(-6.4, 1.8, -3.1, 3.1, 1.0, 3.4, 'paint', { t: 1.1, v: 0.9, f: 1.2, fx: 1.4, fz: 1, r: 2.8, rx: 1, rz: 0.55 }),
      box(-9.2, -1.4, -0.9, 0.9, 3.2, 5.2, 'paint', { f: 1.6, fx: 1, fz: 1.2, r: 3.6, rx: 1, rz: 0.6 }),
      box(-2.4, -0.8, -0.7, 0.7, 3.7, 5.8, 'paint2', { f: 0.6 }),
      box(-9.4, -3.4, -0.12, 0.12, 4.6, 6.0, 'paint2', { r: 2.2, rx: 1, rz: 0.8 }),
      box(0.2, 2.6, -1.25, 1.25, 4.4, 4.8, 'black'), box(2.2, 2.6, -0.2, 0.2, 3.7, 4.8, 'black'),
      ell(-0.3, 0, 4.2, 1.0, 0.85, 0.85, 'helmet'),
      box(-12.4, -10.6, -3.7, 3.7, 5.2, 6.0, 'paint'), box(-11.2, -10.4, -3.6, 3.6, 6.0, 6.6, 'accent'),
      box(-12.6, -10.2, 3.6, 3.9, 2.2, 6.8, 'paint2'), box(-12.6, -10.2, -3.9, -3.6, 2.2, 6.8, 'paint2'),
      box(-11.4, -10.8, -0.25, 0.25, 3.0, 5.2, 'black'),
      box(5.6, 8.2, -3.0, 3.0, 2.0, 2.3, 'black'), box(-8.6, -6.4, -2.8, 2.8, 2.0, 2.3, 'black'),
      ...wheels(7.0, -7.6, 3.8, 2.05, 2.3, 2.35, 2.9),
    ],
  },
  bubblan: {
    len: 15, wid: 8.8, ext: [-8, 8.2, 4.6, 8.5], sp: [-7.2, 6.2], fr: 7.8, stripe: 'twin', parts: () => [
      box(-7.4, 7.6, -4.4, 4.4, 1.3, 4.5, 'paint', { t: 1.4, v: 2.0, f: 1.6, fx: 1.4, fz: 1, r: 1.2, b: 0.8, s: 0.6 }),
      cabin(-6.4, 3.0, 4.0, 4.5, 8.3, 2.2, 1.0, 1.2, 'glass', 'white'),
      cyl(7.3, 2.7, 3.4, 1.0, 0.8, 'light', 0), cyl(7.3, -2.7, 3.4, 1.0, 0.8, 'light', 0),
      box(-7.8, -6.9, -4.5, 4.5, 1.2, 2.4, 'chrome'), box(7.3, 8.1, -4.5, 4.5, 1.2, 2.3, 'chrome', { v: 0.6 }),
      box(-7.6, -7.2, 2.4, 3.8, 3.3, 4.1, 'tail'), box(-7.6, -7.2, -3.8, -2.4, 3.3, 4.1, 'tail'),
      ...wheels(4.7, -4.7, 3.8, 1.85, 1.8),
    ],
  },
  pirat: {
    len: 20, wid: 9.6, ext: [-9.6, 10, 5, 9], sp: [-9, 8.5], fr: 9.9, stripe: 'roof', parts: () => [
      box(-9.2, 9.4, -4.7, 4.7, 1.5, 4.9, 'paint', { t: 1.0, v: 1.4, f: 1.6, fx: 1.6, fz: 1, r: 0.8, b: 0.8, s: 0.6 }),
      cabin(-8.6, 3.2, 4.4, 4.9, 8.5, 3.4, 0.9, 1.3),
      box(-9.3, -8.2, -4.9, 4.9, 1.4, 2.6, 'black'), box(8.8, 9.9, -4.9, 4.9, 1.4, 2.5, 'black', { v: 0.7 }),
      box(8.9, 9.6, 2.4, 4.0, 3.1, 4.0, 'light'), box(8.9, 9.6, -4.0, -2.4, 3.1, 4.0, 'light'),
      box(-9.45, -9.0, 2.6, 4.2, 3.4, 4.3, 'tail'), box(-9.45, -9.0, -4.2, -2.6, 3.4, 4.3, 'tail'),
      box(4.9, 5.6, -2.6, -0.6, 4.9, 5.9, 'spot'), box(4.9, 5.6, 0.6, 2.6, 4.9, 5.9, 'spot'),
      box(-7.0, -2.0, -3.4, 3.4, 8.5, 8.9, 'black'),
      ...wheels(5.6, -5.8, 3.9, 2.25, 2.0),
    ],
  },
  komet: {
    len: 21, wid: 10, ext: [-10.2, 10.6, 5.2, 7.2], sp: null, fr: 10.6, stripe: 'twin', parts: () => [
      box(-10, 10.4, -4.9, 4.9, 1.3, 4.3, 'paint', { t: 1.2, v: 1.8, f: 3.4, fx: 3.6, fz: 1, r: 1.0, b: 0.9, s: 0.7 }),
      cabin(-5.6, 2.2, 4.0, 4.3, 7.1, 3.8, 3.4, 1.4),
      box(-10.1, -9.2, -5.0, 5.0, 1.2, 2.4, 'black'), box(9.6, 10.6, -4.7, 4.7, 1.2, 2.2, 'black', { v: 1.2 }),
      box(9.4, 10.2, 2.4, 4.0, 2.4, 3.0, 'light'), box(9.4, 10.2, -4.0, -2.4, 2.4, 3.0, 'light'),
      box(-10.15, -9.7, 1.6, 4.4, 3.2, 3.9, 'tail'), box(-10.15, -9.7, -4.4, -1.6, 3.2, 3.9, 'tail'),
      box(-9.7, -8.0, -4.9, 4.9, 6.2, 6.8, 'paint2'), box(-9.2, -8.6, 3.2, 3.8, 4.3, 6.2, 'black'), box(-9.2, -8.6, -3.8, -3.2, 4.3, 6.2, 'black'),
      box(-2, 2, 4.6, 5.1, 2.6, 3.4, 'black'), box(-2, 2, -5.1, -4.6, 2.6, 3.4, 'black'),
      ...wheels(6.2, -6.4, 4.1, 2.2, 2.1, 2.35, 2.4),
    ],
  },
  muskel: {
    len: 22, wid: 10.4, ext: [-11, 11.2, 5.4, 8.2], sp: [-10.3, 5.6], fr: 11, stripe: 'twin', parts: () => [
      box(-10.6, 10.6, -5.1, 5.1, 1.6, 5.0, 'paint', { t: 0.8, v: 1.0, f: 1.2, fx: 1, fz: 1.4, r: 0.8, b: 0.6, s: 0.5 }),
      cabin(-5.4, 1.4, 4.6, 5.0, 8.0, 3.2, 3.6, 1.2),
      box(1.8, 6.4, -1.6, 1.6, 5.0, 6.1, 'paint2', { f: 0.8, fx: 1.2, fz: 1 }), box(5.6, 6.5, -1.3, 1.3, 5.2, 5.9, 'black'),
      box(-10.8, -9.9, -5.2, 5.2, 1.5, 2.6, 'chrome'), box(10.3, 11.0, -5.2, 5.2, 1.5, 2.6, 'chrome'),
      box(10.2, 10.75, -4.4, 4.4, 3.0, 4.6, 'black'), box(10.3, 10.85, 2.8, 4.2, 3.4, 4.3, 'light'), box(10.3, 10.85, -4.2, -2.8, 3.4, 4.3, 'light'),
      box(-10.75, -10.3, -4.6, 4.6, 3.4, 4.4, 'tail'),
      box(-10.6, -9.2, -4.9, 4.9, 5.0, 5.6, 'paint2'),
      ...wheels(6.6, -6.6, 4.3, 2.3, 2.0, 2.6, 2.9),
    ],
  },
  buffel: {
    len: 22, wid: 10.6, ext: [-11.2, 11.8, 5.4, 12], sp: null, fr: 11.6, stripe: 'side', parts: () => [
      box(-1.0, 10.4, -5.0, 5.0, 2.6, 6.4, 'paint', { t: 0.8, v: 1.0, f: 1.4, fx: 1, fz: 1.6, b: 0.8, s: 0.5 }),
      cabin(-1.0, 4.4, 4.6, 6.4, 10.2, 2.4, 0.4, 0.9),
      box(-10.8, -1.0, -5.0, 5.0, 2.6, 4.2, 'paint', { v: 0.6, b: 0.6 }),
      box(-10.8, -1.0, 4.0, 5.0, 4.2, 6.2, 'paint', { t: 0.4 }), box(-10.8, -1.0, -5.0, -4.0, 4.2, 6.2, 'paint', { t: 0.4 }),
      box(-10.8, -9.8, -4.0, 4.0, 4.2, 6.0, 'paint', { t: 0.4 }),
      box(-8.5, -2.5, -3.6, 3.6, 4.2, 4.6, 'cargo'),
      box(10.4, 11.6, -4.6, 4.6, 2.0, 5.6, 'chrome'), box(10.6, 11.4, -3.8, 3.8, 2.6, 5.0, 'black'),
      box(10.5, 11.2, 2.6, 4.2, 3.6, 4.6, 'light'), box(10.5, 11.2, -4.2, -2.6, 3.6, 4.6, 'light'),
      box(-11.0, -10.6, 2.8, 4.6, 4.4, 5.6, 'tail'), box(-11.0, -10.6, -4.6, -2.8, 4.4, 5.6, 'tail'),
      box(-1.6, -0.9, -4.8, 4.8, 6.2, 11.0, 'black'), box(-1.6, -0.9, -4.8, 4.8, 10.5, 11.2, 'black'),
      box(-1.4, -0.6, 1.6, 3.4, 11.0, 12.0, 'spot'), box(-1.4, -0.6, -3.4, -1.6, 11.0, 12.0, 'spot'),
      ...wheels(6.4, -6.6, 4.5, 3.0, 2.6),
    ],
  },
  raket: {
    len: 22, wid: 10.8, ext: [-11.4, 11.2, 5.7, 6.9], sp: null, fr: 11.2, stripe: 'twin', parts: () => [
      box(-10.6, 11.0, -5.3, 5.3, 1.1, 3.9, 'paint', { t: 1.6, v: 2.4, f: 5.2, fx: 5.6, fz: 1, r: 1.4, b: 1.0, s: 0.9 }),
      cabin(-4.6, 2.6, 3.4, 3.9, 6.4, 4.2, 3.8, 1.6),
      box(-6.6, -3.4, -5.6, -3.6, 2.4, 3.8, 'black', { t: 0.6 }), box(-6.6, -3.4, 3.6, 5.6, 2.4, 3.8, 'black', { t: 0.6 }),
      box(-11.4, -9.4, -5.6, 5.6, 6.3, 6.8, 'paint2', { f: 0.4 }), box(-10.8, -10.0, 3.6, 4.2, 3.6, 6.3, 'black'), box(-10.8, -10.0, -4.2, -3.6, 3.6, 6.3, 'black'),
      box(10.2, 11.2, 2.4, 4.6, 1.9, 2.5, 'light'), box(10.2, 11.2, -4.6, -2.4, 1.9, 2.5, 'light'),
      box(-10.8, -10.4, -4.8, 4.8, 2.6, 3.4, 'tail'),
      box(-10.9, -9.6, -2.2, 2.2, 1.2, 2.2, 'chrome'),
      ...wheels(6.8, -6.8, 4.5, 2.2, 2.3, 2.45, 2.8),
    ],
  },
  formeln: {
    len: 22, wid: 10.4, ext: [-11, 11.8, 5.6, 6.8], sp: null, fr: null, stripe: 'formula', parts: () => [
      box(1.5, 11.0, -1.4, 1.4, 1.5, 3.4, 'paint', { t: 0.6, f: 2.6, fx: 4, fz: 1, b: 0.5 }),
      box(-6.5, 2.0, -2.5, 2.5, 1.3, 4.4, 'paint', { t: 1.0, r: 0.6 }),
      box(-6.0, 0.6, -4.3, 4.3, 1.3, 3.4, 'paint', { t: 1.2, v: 1.2, f: 1.0, fx: 1.4, fz: 1 }),
      box(-5.2, -1.2, -0.9, 0.9, 4.4, 6.4, 'paint', { f: 1.4, fx: 1.2, fz: 1, t: 0.4 }),
      ell(-1.0, 0, 5.0, 1.3, 1.15, 1.2, 'helmet'), box(-0.3, 0.6, -0.9, 0.9, 4.8, 5.4, 'glass'),
      box(9.2, 11.8, -5.4, 5.4, 1.0, 1.6, 'paint2', { f: 0.4 }), box(9.4, 11.6, 5.0, 5.5, 1.0, 2.6, 'black'), box(9.4, 11.6, -5.5, -5.0, 1.0, 2.6, 'black'),
      box(-11.0, -8.6, -4.9, 4.9, 5.8, 6.8, 'paint2', { f: 0.4 }), box(-11.0, -8.6, 4.6, 5.1, 3.0, 6.8, 'black'), box(-11.0, -8.6, -5.1, -4.6, 3.0, 6.8, 'black'),
      box(-9.0, -8.4, -0.4, 0.4, 3.2, 5.8, 'black'),
      ...wheels(6.6, -6.6, 4.3, 2.15, 2.3, 2.5, 3.2),
    ],
  },
  monstret: {
    len: 22, wid: 13.4, ext: [-10.6, 10.8, 7.2, 14], sp: [-9.2, 11], fr: 10.4, stripe: 'flames', parts: () => [
      box(-7.5, 7.5, -2.2, 2.2, 3.0, 5.0, 'black'),
      box(-9.4, 9.8, -5.0, 5.0, 6.4, 10.0, 'paint', { t: 0.8, v: 1.2, f: 1.4, fx: 1, fz: 1.4, r: 0.8, b: 0.8 }),
      cabin(-4.4, 3.4, 4.4, 10.0, 13.6, 2.4, 1.0, 1.0),
      box(-1.4, -0.6, -4.6, 4.6, 13.6, 14.2, 'black'), box(-1.2, -0.4, 1.4, 3.2, 14.2, 15.2, 'spot'), box(-1.2, -0.4, -3.2, -1.4, 14.2, 15.2, 'spot'),
      box(9.6, 10.6, -4.2, 4.2, 5.4, 8.0, 'chrome'),
      box(9.7, 10.2, 2.6, 4.2, 7.8, 8.8, 'light'), box(9.7, 10.2, -4.2, -2.6, 7.8, 8.8, 'light'),
      box(-9.6, -9.2, -4.4, 4.4, 8.2, 9.2, 'tail'),
      ...wheels(6.2, -6.2, 5.6, 4.6, 3.6),
    ],
  },
  svavaren: {
    len: 22, wid: 12, ext: [-11, 10.2, 6.2, 10], sp: null, fr: null, hover: true, stripe: 'twin', parts: () => [
      box(-10.0, 9.6, -5.9, 5.9, 1.0, 3.3, 'skirt', { t: 1.2, v: 3.2, b: 1.2, s: 1.2 }),
      box(-8.8, 8.6, -4.9, 4.9, 3.3, 4.6, 'paint', { v: 2.6, t: 0.7, f: 1.0 }),
      cabin(-3.4, 5.2, 3.7, 4.6, 7.6, 3.2, 2.4, 1.6),
      box(-9.4, -8.2, -0.4, 0.4, 4.6, 9.4, 'black'),
      cyl(-8.9, 2.7, 6.6, 2.7, 1.2, 'fan', 0), cyl(-8.9, -2.7, 6.6, 2.7, 1.2, 'fan', 0),
      box(-10.6, -10.0, 1.6, 2.2, 4.4, 8.8, 'paint2'), box(-10.6, -10.0, -2.2, -1.6, 4.4, 8.8, 'paint2'),
      box(8.4, 9.2, 2.4, 4.0, 3.6, 4.3, 'light'), box(8.4, 9.2, -4.0, -2.4, 3.6, 4.3, 'light'),
    ],
  },
  pansarvagn: {
    len: 24, wid: 13.2, ext: [-12, 16.6, 6.9, 10], sp: null, fr: null, tank: true, stripe: 'camo', parts: () => [
      box(-11.2, 11.0, 4.0, 6.6, 0.3, 4.4, 'track', { f: 1.6, fx: 1, fz: 1, r: 1.6, b: 1.8 }),
      box(-11.2, 11.0, -6.6, -4.0, 0.3, 4.4, 'track', { f: 1.6, fx: 1, fz: 1, r: 1.6, b: 1.8 }),
      box(-11.6, 11.2, -4.4, 4.4, 1.8, 5.8, 'paint', { f: 2.6, fx: 1.6, fz: 1, r: 1.0 }),
      box(-11.0, 10.6, 3.8, 6.9, 4.4, 5.0, 'paint2'), box(-11.0, 10.6, -6.9, -3.8, 4.4, 5.0, 'paint2'),
      box(-6.4, 3.2, -3.8, 3.8, 5.8, 9.0, 'paint', { t: 1.2, v: 1.8, f: 1.2, fx: 1.2, fz: 1 }),
      cyl(9.6, 0, 7.6, 0.8, 13.0, 'gun', 0), cyl(16.0, 0, 7.6, 1.15, 1.4, 'gun', 0),
      cyl(-3.4, 1.6, 9.2, 1.3, 0.6, 'paint2', 2),
      box(-6.8, -6.0, -2.4, -1.8, 9.0, 11.6, 'black'),
      ...[-8, -4, 0, 4, 8].flatMap((x) => [cyl(x, 6.7, 2.3, 1.6, 0.3, 'hub'), cyl(x, -6.7, 2.3, 1.6, 0.3, 'hub')]),
    ],
  },
  polisen: {
    len: 21, wid: 10, ext: [-10.6, 10.8, 5.2, 9.2], sp: [-9.8, 5.2], fr: 10.6, stripe: 'police', parts: () => [
      box(-10.0, 10.2, -4.8, 4.8, 1.5, 4.8, 'paint', { t: 1.0, v: 1.4, f: 1.4, fx: 1.2, fz: 1, r: 1.0, b: 0.7, s: 0.5 }),
      cabin(-5.4, 3.0, 4.3, 4.8, 8.0, 2.8, 2.6, 1.2, 'glass', 'white'),
      box(-1.6, -0.2, -3.0, -0.2, 8.0, 9.0, 'lightB'), box(-1.6, -0.2, 0.2, 3.0, 8.0, 9.0, 'lightR'),
      box(-10.3, -9.4, -4.9, 4.9, 1.4, 2.6, 'black'), box(9.7, 10.7, -4.9, 4.9, 1.4, 2.5, 'black', { v: 0.6 }),
      box(10.0, 10.6, 2.6, 4.2, 3.2, 4.0, 'light'), box(10.0, 10.6, -4.2, -2.6, 3.2, 4.0, 'light'),
      box(-10.4, -9.9, 2.6, 4.4, 3.4, 4.3, 'tail'), box(-10.4, -9.9, -4.4, -2.6, 3.4, 4.3, 'tail'),
      ...wheels(6.2, -6.2, 4.2, 2.25, 2.0),
    ],
  },
  skolbussen: {
    len: 34, wid: 11.4, ext: [-16, 18.4, 6, 12.4], sp: null, fr: 18.2, stripe: 'bus', parts: () => [
      box(-15.6, 15.0, -5.6, 5.6, 2.0, 12.2, 'paint', { t: 1.0, v: 1.2 }),
      box(15.0, 17.6, -4.8, 4.8, 2.0, 7.2, 'paint', { t: 0.8, v: 1.0, f: 0.8 }),
      box(17.4, 18.3, -4.9, 4.9, 1.6, 3.2, 'black'), box(-16.0, -15.4, -5.6, 5.6, 1.6, 3.2, 'black'),
      box(17.5, 18.0, 2.8, 4.2, 4.2, 5.2, 'light'), box(17.5, 18.0, -4.2, -2.8, 4.2, 5.2, 'light'),
      box(-15.8, -15.5, 3.6, 5.0, 4.0, 6.0, 'tail'), box(-15.8, -15.5, -5.0, -3.6, 4.0, 6.0, 'tail'),
      box(-12, 10, -3.6, 3.6, 12.2, 12.8, 'white'),
      ...wheels(12.0, -10.0, 5.0, 2.7, 2.2),
    ],
  },
  traktorn: {
    len: 20, wid: 12.4, ext: [-10.4, 10.6, 6.6, 12.2], sp: null, fr: 10.4, stripe: 'none', parts: () => [
      box(-1.0, 9.6, -2.3, 2.3, 3.6, 7.2, 'paint', { t: 0.8, f: 1.0, fx: 1, fz: 1 }),
      box(9.5, 10.3, -2.1, 2.1, 3.8, 6.8, 'black'),
      box(-9.0, -1.0, -3.2, 3.2, 3.0, 4.6, 'paint2'),
      cabin(-8.8, -1.6, 3.2, 4.6, 11.6, 0.4, 0.3, 0.5, 'glass', 'white'),
      box(-9.0, -1.4, 3.2, 6.6, 8.6, 9.2, 'paint'), box(-9.0, -1.4, -6.6, -3.2, 8.6, 9.2, 'paint'),
      cyl(4.6, -1.6, 9.4, 0.5, 5.4, 'black', 2),
      box(9.6, 10.2, 1.2, 2.0, 6.0, 6.8, 'light'), box(9.6, 10.2, -2.0, -1.2, 6.0, 6.8, 'light'),
      wheel(-5.0, 4.9, 4.4, 4.4, 3.0, 'tireT'), wheel(-5.0, -4.9, 4.4, 4.4, 3.0, 'tireT'),
      wheel(6.6, 3.7, 2.4, 2.4, 1.8, 'tireT'), wheel(6.6, -3.7, 2.4, 2.4, 1.8, 'tireT'),
    ],
  },
};

// Tillbehör som syns: spoiler, rambock (nivå)
function extraParts(M, look) {
  const out = [];
  if (look.spoiler && M.sp) {
    const [x, z] = M.sp, w = M.wid / 2 - 0.6;
    out.push(box(x - 0.6, x + 1.6, -w, w, z + 1.4, z + 2.0, 'paint2', { f: 0.3 }), box(x, x + 0.6, w - 1.4, w - 0.8, z - 0.2, z + 1.4, 'black'), box(x, x + 0.6, -w + 0.8, -w + 1.4, z - 0.2, z + 1.4, 'black'));
  }
  if (look.ramm && M.fr) {
    const x = M.fr, w = M.wid / 2 - 1.2;
    out.push(box(x, x + 1.0, -w, w, 1.6, 2.4, 'chrome'), box(x, x + 1.0, -w, w, 4.0 + look.ramm * 0.3, 4.8 + look.ramm * 0.3, 'chrome'));
    for (const y of [-w + 0.4, -1, 0.6, w - 0.8]) out.push(box(x + 0.1, x + 0.9, y, y + 0.5, 2.4, 4.0 + look.ramm * 0.3, 'chrome'));
  }
  return out;
}

// ---------- strålföljning ----------
function hitPoly(part, o, d, res) {
  let tin = -1e9, tout = 1e9, pl = null;
  for (const p of part.P) {
    const den = p[0] * d[0] + p[1] * d[1] + p[2] * d[2];
    const dist = p[3] - (p[0] * o[0] + p[1] * o[1] + p[2] * o[2]);
    if (Math.abs(den) < 1e-9) { if (dist < 0) return false; continue; }
    const t = dist / den;
    if (den > 0) { if (t < tout) { tout = t; pl = p; } } else if (t > tin) tin = t;
    if (tin > tout) return false;
  }
  if (!pl) return false;
  res.t = tout; res.n = pl; res.mat = pl[4] || part.mat; res.tread = false;
  return true;
}
const AX = [[0, 1, 2], [1, 0, 2], [2, 0, 1]]; // [axel, u, v]
function hitCyl(part, o, d, res) {
  const [a, u, v] = AX[part.ax];
  const c = part.c, r = part.r, hw = part.hw;
  let t0a, t1a;
  if (Math.abs(d[a]) < 1e-9) { if (Math.abs(o[a] - c[a]) > hw) return false; t0a = -1e9; t1a = 1e9; }
  else { const p = (c[a] - hw - o[a]) / d[a], q = (c[a] + hw - o[a]) / d[a]; t0a = Math.min(p, q); t1a = Math.max(p, q); }
  const ou = o[u] - c[u], ov = o[v] - c[v];
  const A = d[u] * d[u] + d[v] * d[v], B = 2 * (ou * d[u] + ov * d[v]), Cc = ou * ou + ov * ov - r * r;
  let t0, t1;
  if (A < 1e-12) { if (Cc > 0) return false; t0 = -1e9; t1 = 1e9; }
  else {
    const disc = B * B - 4 * A * Cc;
    if (disc < 0) return false;
    const sq = Math.sqrt(disc); t0 = (-B - sq) / (2 * A); t1 = (-B + sq) / (2 * A);
  }
  const tin = Math.max(t0a, t0), tout = Math.min(t1a, t1);
  if (tin > tout) return false;
  res.t = tout;
  const pu = ou + d[u] * tout, pv = ov + d[v] * tout;
  const n = [0, 0, 0];
  if (t1 < t1a) { n[u] = pu / r; n[v] = pv / r; res.mat = part.mat; res.tread = true; res.ang = Math.atan2(pv, pu); }
  else {
    const pa = o[a] + d[a] * tout - c[a];
    n[a] = Math.sign(pa) || 1;
    const rr = Math.hypot(pu, pv) / r;
    res.rr = rr; res.ang = Math.atan2(pv, pu);
    res.mat = part.mat === 'tire' || part.mat === 'tireT' ? (rr < 0.6 ? (rr < 0.2 ? 'hub' : part.mat === 'tireT' ? 'rimY' : 'rim') : part.mat) : part.mat === 'fan' ? 'fan' : part.mat;
    res.tread = false; res.face = true;
  }
  res.n = n;
  return true;
}
function hitEll(part, o, d, res) {
  const c = part.c, r = part.r;
  const ox = (o[0] - c[0]) / r[0], oy = (o[1] - c[1]) / r[1], oz = (o[2] - c[2]) / r[2];
  const dx = d[0] / r[0], dy = d[1] / r[1], dz = d[2] / r[2];
  const A = dx * dx + dy * dy + dz * dz, B = 2 * (ox * dx + oy * dy + oz * dz), Cc = ox * ox + oy * oy + oz * oz - 1;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return false;
  const t = (-B + Math.sqrt(disc)) / (2 * A);
  res.t = t;
  res.n = V3((ox + dx * t) / r[0], (oy + dy * t) / r[1], (oz + dz * t) / r[2]);
  res.mat = part.mat; res.tread = false;
  return true;
}
const HIT = { poly: hitPoly, cyl: hitCyl, ell: hitEll };
function trace(parts, o, d, best) {
  const res = {};
  best.t = -1e9; best.k = -1;
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    res.face = false;
    if (HIT[p.t](p, o, d, res) && res.t > best.t) {
      best.t = res.t; best.k = k; best.n = res.n; best.mat = res.mat; best.tread = res.tread; best.ang = res.ang; best.rr = res.rr; best.face = res.face;
    }
  }
  return best.k >= 0;
}

const HV = V3(LX + 1 / Math.sqrt(3), LY + 1 / Math.sqrt(3), LZ + 1 / Math.sqrt(3));

// Lackmönster (look.pattern) och modellens egna ränder ('rander')
function paintColor(M, look, lp, n) {
  const pal = look.pal, nz = n[2], pat = look.pattern || 'rander';
  const x0 = M.ext[0], x1 = M.ext[1];
  const t = (lp[0] - x0) / (x1 - x0);
  if (pat === 'rander') {
    const k = M.stripe;
    if (k === 'twin' && nz > 0.5 && Math.abs(Math.abs(lp[1]) - 1.2) < 0.75) return pal.stripe;
    if (k === 'roof' && nz > 0.5 && Math.abs(lp[1]) < 1.1) return pal.stripe;
    if (k === 'side' && nz < 0.3 && lp[2] > 3.6 && lp[2] < 4.6) return pal.stripe;
    if (k === 'formula' && Math.abs(lp[1]) < 0.7 && nz > 0.3) return pal.stripe;
    if (k === 'f1') {
      if (nz > 0.45 && Math.abs(lp[1]) < 0.5 && lp[0] > -9) return pal.stripe;
      if (Math.abs(n[1]) > 0.55 && lp[2] < 1.5) return pal.paint2;
      if (nz > 0.45 && lp[0] > 9.6) return pal.paint2;
    }
    if (k === 'police' && Math.abs(n[1]) > 0.6 && lp[2] > 2.2 && lp[2] < 4.4 && Math.abs(lp[0]) < 5.6) return 0xf4f4f8;
    if (k === 'flames' || k === 'camo') return paintColor(M, { ...look, pattern: k === 'flames' ? 'flammor' : 'kamo' }, lp, n);
    if (k === 'bus') {
      if (Math.abs(n[1]) > 0.6 && lp[2] > 7.4 && lp[2] < 10.8 && lp[0] < 14.6 && ((lp[0] + 40) % 4.4) > 0.9) return -1;
      if (n[0] > 0.6 && lp[2] > 7.2 && lp[0] > 14) return -1;
      if (Math.abs(n[1]) > 0.6 && Math.abs(lp[2] - 6.4) < 0.35) return 0x1c1a20;
    }
    return pal.paint;
  }
  if (pat === 'flammor') {
    const tongue = Math.sin((nz > 0.5 ? lp[1] * 1.9 : lp[2] * 2.4) + 1.3) * 0.08 + Math.sin(lp[1] * 3.7 + lp[2] * 1.1) * 0.04;
    const f = t - (0.42 + tongue);
    if (f > 0.22) return 0xffd23f; if (f > 0.1) return 0xf28a1c; if (f > 0) return 0xc8281c;
    return pal.paint;
  }
  if (pat === 'rutor') {
    if ((nz > 0.5 && Math.abs(lp[1]) < 2.6) || (nz < 0.3 && lp[2] < 3.2)) return ((Math.floor(lp[0] / 1.3) + Math.floor(lp[1] / 1.3) + Math.floor(lp[2] / 1.3)) & 1) ? 0x1c1a20 : 0xf4f2ee;
    return pal.paint;
  }
  if (pat === 'kamo') {
    const h = hash(Math.floor(lp[0] / 2.6 + Math.sin(lp[1]) * 0.6), Math.floor(lp[1] / 2.6 + lp[2] / 3), 71);
    return h > 0.66 ? mul(pal.paint, 0.62) : h > 0.4 ? mix(pal.paint, 0x5a4a2e, 0.55) : pal.paint;
  }
  if (pat === 'blixtar') {
    if (nz < 0.4) { const zz = 3 + ((Math.abs(((lp[0] + 40) % 5) - 2.5)) - 1.25) * 1.2; if (Math.abs(lp[2] - zz) < 0.55) return 0xffe040; }
    if (nz > 0.5 && Math.abs(lp[1] - ((Math.abs(((lp[0] + 40) % 5) - 2.5)) - 1.25) * 1.4) < 0.5) return 0xffe040;
    return pal.paint;
  }
  if (pat === 'prickar') {
    const gx = Math.round(lp[0] / 2.4) * 2.4, gy = Math.round((lp[1] + (nz > 0.5 ? 0 : lp[2])) / 2.4) * 2.4;
    if (Math.hypot(lp[0] - gx, (lp[1] + (nz > 0.5 ? 0 : lp[2])) - gy) < 0.75) return 0xf6f2ea;
    return pal.paint;
  }
  if (pat === 'tiger') {
    if (Math.sin(lp[0] * 1.5 + Math.sin(lp[1] * 0.9 + lp[2] * 0.7) * 1.6) > 0.55) return 0x1c1a20;
    return pal.paint;
  }
  return pal.paint;
}

function matColor(mat, look, lp, n, M, best) {
  switch (mat) {
    case 'paint': return paintColor(M, look, lp, n);
    case 'paint2': return look.pal.paint2;
    case 'white': return 0xeeeef2;
    case 'glass': return -1;
    case 'black': return 0x26242c;
    case 'chrome': return 0xc8ccd4;
    case 'light': return 0xfff2c0;
    case 'spot': return 0xfff8d8;
    case 'tail': return 0xd02828;
    case 'lightR': return 0xf03028;
    case 'lightB': return 0x3060f0;
    case 'tire': case 'tireT': return 0x24222a;
    case 'rim': return 0xb4b8c2;
    case 'rimY': return 0xf2c21c;
    case 'hub': return 0x6a6c78;
    case 'cargo': return 0x5a4632;
    case 'helmet': return M.stripe === 'f1' ? (lp[2] > 4.6 ? look.pal.stripe : lp[2] > 4.0 ? 0x1c1a20 : 0xf6f2ea) : lp[2] > 5.2 ? 0xf6f2ea : look.pal.stripe;
    case 'accent': return look.pal.stripe;
    case 'skirt': return 0x2a2830;
    case 'gun': return mul(look.pal.paint, 0.55);
    case 'track': return ((Math.floor(lp[0] * 0.9) & 1) && n[2] > 0.5) ? 0x3a3840 : 0x2a2830;
    case 'fan': {
      if (!best.face) return 0x3a3842;
      const blade = ((best.ang * 6 / Math.PI) % 2 + 2) % 2 < 0.55;
      return best.rr > 0.92 ? 0x5a5866 : best.rr < 0.18 ? 0x8a8896 : blade ? 0x9a98a6 : 0x1a181e;
    }
    default: return 0xff00ff;
  }
}

export function palette(color, stripe) {
  const dark = ((color >> 16 & 255) + (color >> 8 & 255) + (color & 255)) < 240;
  return { paint: color, paint2: mul(color, 0.82), stripe: stripe ?? (dark ? 0xe8e4dc : 0xf6f2ea) };
}
// look: { pal, pattern, spoiler, ramm }
export const lookKey = (L) => `${L.pal.paint}|${L.pal.paint2}|${L.pal.stripe}|${L.pattern || 'rander'}|${L.spoiler ? 1 : 0}|${L.ramm || 0}|${L.tyre || 0}|${L.nowing ? 1 : 0}`;

// Spritemått per modell
export function spriteDims(model, zoom = 1) {
  const M = MODELS[model];
  const [x0, x1, hw, h] = M.ext;
  const R = Math.max(Math.hypot(x0, hw), Math.hypot(x1, hw)) + 1.5;
  const W = Math.ceil(R * 2 * 1.02 + 6), Hh = Math.ceil(R * 1.02 + h + 6);
  const OX = Math.ceil(W / 2), OY = Math.ceil(R * 0.52 + h + 3);
  return { W: W * zoom, H: Hh * zoom, OX: OX * zoom, OY: OY * zoom };
}

// Allmän modellrendering (läktare m.m.): delar i lokala koordinater, matFn(mat, lp, n, px, py) → färg.
export function renderParts(parts, ang, W, H, OX, OY, matFn, outline = true) {
  const P = new Pix(W, H);
  const c = Math.cos(ang), s = Math.sin(ang);
  const dl = [c + s, -s + c, 1];
  const best = {};
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = px - OX + 0.5, j = py - OY + 0.5;
    const wx = i / 2, wy = -i / 2, wz = -j;
    const o = [wx * c + wy * s, -wx * s + wy * c, wz];
    if (!trace(parts, o, dl, best)) continue;
    const n = best.n;
    const nw = [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
    const lp = [o[0] + dl[0] * best.t, o[1] + dl[1] * best.t, o[2] + dl[2] * best.t];
    const diff = Math.max(0, nw[0] * LX + nw[1] * LY + nw[2] * LZ);
    const col = matFn(best.mat, lp, n, px, py, best);
    if (col < 0) continue;
    P.px(px, py, shade(col, 0.44 + 0.74 * diff, px, py, 0.4));
  }
  if (outline) P.outline();
  return P.flush();
}
export { box, cabin, plane, cyl, ell };

// Ritar en fordonssprite för vinkel ang (radianer). Duken får .ox/.oy (markpunkten under bilens mitt).
export function renderCar(modelId, look, ang, zoom = 1) {
  if (!look.pal) look = { pal: look };
  const M = MODELS[modelId];
  // look.nowing: formelbilen har tappat framvingen
  const parts = [...M.parts().filter((p, i) => !(look.nowing && M.wing && M.wing.includes(i))), ...extraParts(M, look)];
  const { W: SW, H: SH, OX, OY } = spriteDims(modelId, zoom);
  const P = new Pix(SW, SH);
  const c = Math.cos(ang), s = Math.sin(ang);
  const dl = [c + s, -s + c, 1];
  const best = {};
  const depth = new Float32Array(SW * SH).fill(-1e9), part = new Int16Array(SW * SH).fill(-1);
  for (let py = 0; py < SH; py++) for (let px = 0; px < SW; px++) {
    const i = (px - OX + 0.5) / zoom, j = (py - OY + 0.5) / zoom;
    const wx = i / 2, wy = -i / 2, wz = -j;
    const o = [wx * c + wy * s, -wx * s + wy * c, wz];
    if (!trace(parts, o, dl, best)) continue;
    const n = best.n;
    const nw = [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
    const lp = [o[0] + dl[0] * best.t, o[1] + dl[1] * best.t, o[2] + dl[2] * best.t];
    const diff = Math.max(0, nw[0] * LX + nw[1] * LY + nw[2] * LZ);
    let I = 0.44 + 0.74 * diff;
    let col = matColor(best.mat, look, lp, n, M, best);
    const glass = col === -1;
    if (glass) col = 0x1e2a44;
    const spec = Math.max(0, nw[0] * HV[0] + nw[1] * HV[1] + nw[2] * HV[2]);
    if (glass) {
      I = 0.7 + 0.4 * diff;
      const streak = ((lp[0] * 0.9 + lp[2] * 1.3 + lp[1] * 0.2) % 4 + 4) % 4;
      if (spec > 0.8 || streak < 0.7) col = mix(col, 0x9cc6ee, spec > 0.92 ? 0.85 : 0.45);
    } else if (best.mat === 'light' || best.mat === 'spot' || best.mat === 'tail' || best.mat === 'lightR' || best.mat === 'lightB') I = Math.max(I, 1.05);
    else if (best.mat === 'tire' || best.mat === 'tireT') {
      I = 0.6 + 0.4 * diff;
      if (best.tread && (best.mat === 'tireT' ? (((best.ang * 5) % 1) + 1) % 1 < 0.45 : hash(Math.floor(best.ang * 4), 0, 3) > 0.5)) col = 0x34323a;
      if (look.tyre && best.face && best.rr > 0.7 && best.rr < 0.84) { col = look.tyre; I = Math.max(I, 0.95); }
    }
    let out = shade(col, I, px, py, 0.35);
    if ((best.mat === 'paint' || best.mat === 'paint2' || best.mat === 'chrome' || best.mat === 'helmet') && spec > 0.965) out = mix(out, 0xffffff, 0.7);
    P.px(px, py, out);
    depth[py * SW + px] = best.t; part[py * SW + px] = best.k;
  }
  // bläckkant där en närmare del möter en bortre
  const d = P.d;
  for (let py = 0; py < SH; py++) for (let px = 0; px < SW; px++) {
    const k = py * SW + px;
    if (part[k] < 0) continue;
    for (const [ox, oy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const xx = px + ox, yy = py + oy;
      if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
      const kk = yy * SW + xx;
      if (part[kk] >= 0 && part[kk] !== part[k] && depth[kk] > depth[k] + 1.6) {
        const i4 = k * 4; d[i4] *= 0.62; d[i4 + 1] *= 0.6; d[i4 + 2] *= 0.68; break;
      }
    }
  }
  P.outline();
  const cv = P.flush();
  cv.ox = OX; cv.oy = OY;
  return cv;
}

// Skugga på marken (sett från ljuset), samma origo som fordonsspriten.
export function renderShadow(modelId, ang) {
  const M = MODELS[modelId];
  const parts = M.parts();
  const { W, H, OX, OY } = spriteDims(modelId);
  const SW = W + 26, SH = H;
  const P = new Pix(SW, SH);
  const c = Math.cos(ang), s = Math.sin(ang);
  const dl = [LX * c + LY * s, -LX * s + LY * c, LZ];
  const best = {};
  const hov = M.hover ? 2.2 : 0;
  for (let py = 0; py < SH; py++) for (let px = 0; px < SW; px++) {
    const i = px - OX + 0.5, j = py - OY + 0.5;
    const gx = j + i / 2, gy = j - i / 2;
    const o = [gx * c + gy * s, -gx * s + gy * c, -hov];
    if (trace(parts, o, dl, best) && best.t > 0) P.px(px, py, 0x140c1e, 0.38);
  }
  const cv = P.flush();
  cv.ox = OX; cv.oy = OY;
  return cv;
}

// Utbränt vrak: samma sprite, mörk och sotig
export function burnt(canvas) {
  const P = new Pix(canvas.width, canvas.height);
  P.ctx.drawImage(canvas, 0, 0);
  const img = P.ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = (d[i] * 0.3 + d[i + 1] * 0.5 + d[i + 2] * 0.2) / 255;
    const h = hash(i >> 2, 0, 9);
    const cc = h > 0.93 ? mix(0x3a2a22, 0xd0601a, l) : mix(0x16141a, 0x5a5660, l * 0.9);
    d[i] = cc >> 16 & 255; d[i + 1] = cc >> 8 & 255; d[i + 2] = cc & 255;
  }
  P.ctx.putImageData(img, 0, 0);
  P.canvas.ox = canvas.ox; P.canvas.oy = canvas.oy;
  return P.canvas;
}

export const CAR_COLORS = [0xd8282c, 0x2a5ad8, 0xf2c21c, 0x26a24a, 0xe8e8ee, 0x2c2a36, 0xf27a18, 0x8a3ad2, 0x1eb4c8, 0xe2609e, 0x5e6e3a, 0x8a5a3a, 0xc0c4cc, 0x3a2a6a];
export const ramps = (c) => ramp(c);
