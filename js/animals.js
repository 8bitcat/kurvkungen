// Djur som går över vägen. Små plattas till (blod på asfalten), mellanstora flyger iväg,
// stora (älg, ko, ren, björn, kamel) är en riktig krock – bilen studsar och djuret kastas.
// Djuren är små 3D-modeller (ellipsoider/cylindrar) som strålföljs till sprites i 8 vinklar.
import { renderParts, ell, cyl, burnt } from './carsprites.js?v=1';
import { hash, mul } from './pix.js?v=1';
import { nearest, idxAt } from './trackgeo.js?v=1';
import { MAT } from './world-gen.js?v=1';

const C = (x, y, z, r, h, col) => cyl(x, y, z, r, h, col, 2); // lodrät cylinder (ben)
const legs = (xf, xr, yw, h, r, col, sw) => [
  C(xf + sw, yw, h / 2, r, h, col), C(xf - sw, -yw, h / 2, r, h, col), C(xr - sw, yw, h / 2, r, h, col), C(xr + sw, -yw, h / 2, r, h, col),
];

// size: s = plattas, m = flyger, l = krock. r = kollisionsradie, mass för stora.
export const SPECIES = {
  hare: { size: 's', len: 7, h: 7, r: 2.6, speed: 55, run: 170, skittish: true, parts: (sw, v) => {
    const c = v === 'vit' ? 0xf2f2f6 : 0x9a8062, d = v === 'vit' ? 0xd8dce6 : 0x7a6248;
    return [ell(0, 0, 2.8, 2.6, 1.5, 1.8, c), ell(-1.3, 0, 2.3, 1.7, 1.6, 1.6, c), ell(2.4, 0, 4.2, 1.3, 1.1, 1.1, c),
      ell(1.9, 0.55, 6.3, 0.4, 0.3, 1.4, d), ell(1.9, -0.55, 6.3, 0.4, 0.3, 1.4, d), ell(-2.9, 0, 3.2, 0.7, 0.7, 0.7, 0xf6f2ea),
      ell(3.3, 0.5, 4.4, 0.25, 0.25, 0.25, 0x18141c), C(1.4 + sw, 0.6, 1, 0.35, 2, d), C(1.4 - sw, -0.6, 1, 0.35, 2, d),
      ell(-1.0 - sw, 1.1, 0.9, 1.6, 0.5, 0.8, c), ell(-1.0 + sw, -1.1, 0.9, 1.6, 0.5, 0.8, c)];
  } },
  rav: { size: 'm', len: 13, h: 8, r: 3.2, speed: 60, run: 150, skittish: true, parts: (sw) => [
    ell(0, 0, 4.0, 3.4, 1.4, 1.5, 0xd2702a), ell(2.4, 0, 3.8, 1.2, 1.1, 1.2, 0xf4ece0), ell(3.8, 0, 5.0, 1.4, 1.2, 1.1, 0xd8782e),
    ell(5.1, 0, 4.6, 1.0, 0.55, 0.5, 0xd8782e), ell(5.9, 0, 4.7, 0.3, 0.3, 0.3, 0x1a1418), ell(3.6, 0.7, 6.4, 0.4, 0.35, 0.8, 0x2a1a14), ell(3.6, -0.7, 6.4, 0.4, 0.35, 0.8, 0x2a1a14),
    ell(-4.6, 0, 3.6, 2.6, 0.9, 0.9, 0xd2702a), ell(-6.6, 0, 3.3, 0.8, 0.7, 0.7, 0xf4ece0), ...legs(2.2, -2.2, 0.8, 2.8, 0.35, 0x2a1a14, sw)] },
  radjur: { size: 'm', len: 13, h: 14, r: 3.6, speed: 45, run: 160, skittish: true, parts: (sw) => [
    ell(0, 0, 7.2, 4.2, 1.8, 2.1, 0x9a6a3a), ell(-3.6, 0, 7.4, 0.9, 1.3, 1.3, 0xf0e8dc), ell(3.4, 0, 9.4, 1.0, 0.9, 2.0, 0x9a6a3a),
    ell(4.4, 0, 11.2, 1.6, 1.0, 1.0, 0x8a5e34), ell(5.8, 0, 10.9, 0.4, 0.4, 0.4, 0x1a1418), ell(3.8, 0.9, 12.4, 0.4, 0.6, 0.7, 0x8a5e34), ell(3.8, -0.9, 12.4, 0.4, 0.6, 0.7, 0x8a5e34),
    C(4.1, 0.5, 13.4, 0.22, 1.8, 0xc8b48a), C(4.1, -0.5, 13.4, 0.22, 1.8, 0xc8b48a), ...legs(2.8, -2.8, 1.0, 5.8, 0.4, 0x7a5430, sw)] },
  alg: { size: 'l', len: 22, h: 20, r: 6.5, mass: 2.4, speed: 30, run: 90, freeze: true, parts: (sw) => [
    ...legs(4.2, -4.4, 1.6, 5.2, 0.75, 0xb8a890, sw),
    C(4.2 + sw, 1.6, 7.4, 0.85, 4.6, 0x3a2a1e), C(4.2 - sw, -1.6, 7.4, 0.85, 4.6, 0x3a2a1e), C(-4.4 - sw, 1.6, 7.4, 0.85, 4.6, 0x3a2a1e), C(-4.4 + sw, -1.6, 7.4, 0.85, 4.6, 0x3a2a1e),
    ell(0, 0, 12, 7, 3.2, 4.0, 0x4a3426), ell(2.4, 0, 15.2, 3.6, 2.6, 2.6, 0x3e2c20), ell(5.8, 0, 14.0, 2.0, 1.8, 2.6, 0x4a3426),
    ell(8.2, 0, 13.6, 2.8, 1.4, 1.6, 0x3e2c20), ell(10.4, 0, 12.8, 1.4, 1.2, 1.3, 0x2e2018), ell(7.4, 0, 11.0, 0.6, 0.5, 1.4, 0x3e2c20),
    ell(8.4, 1.0, 14.6, 0.35, 0.35, 0.35, 0x0e0a0c), ell(8.4, -1.0, 14.6, 0.35, 0.35, 0.35, 0x0e0a0c),
    ell(7.2, 3.4, 17.0, 1.8, 2.9, 0.55, 0xd8c8a0), ell(7.2, -3.4, 17.0, 1.8, 2.9, 0.55, 0xd8c8a0),
    ell(6.4, 5.6, 18.0, 0.5, 0.5, 0.9, 0xd8c8a0), ell(6.4, -5.6, 18.0, 0.5, 0.5, 0.9, 0xd8c8a0), ell(8.4, 5.2, 18.2, 0.5, 0.5, 0.9, 0xd8c8a0), ell(8.4, -5.2, 18.2, 0.5, 0.5, 0.9, 0xd8c8a0),
    ell(-7.0, 0, 13.2, 0.8, 0.6, 0.9, 0x3e2c20)] },
  ko: { size: 'l', len: 18, h: 13, r: 6, mass: 2.6, speed: 18, run: 45, parts: (sw) => [
    ...legs(3.6, -3.6, 1.6, 5.4, 0.8, 0xe8e4dc, sw), ell(0, 0, 8.4, 6.4, 3.2, 3.4, 'ko'), ell(6.6, 0, 9.4, 2.2, 1.6, 1.9, 'ko'),
    ell(8.4, 0, 8.6, 1.2, 1.3, 1.1, 0xf0a8a8), ell(7.0, 1.0, 10.4, 0.35, 0.35, 0.35, 0x0e0a0c), ell(7.0, -1.0, 10.4, 0.35, 0.35, 0.35, 0x0e0a0c),
    cyl(6.0, 0, 11.4, 0.35, 4.4, 0xf0e8d0, 1), ell(5.8, 2.4, 10.4, 0.8, 0.5, 0.4, 'ko'), ell(5.8, -2.4, 10.4, 0.8, 0.5, 0.4, 'ko'),
    ell(-2.2, 0, 5.2, 1.6, 1.4, 1.0, 0xf0a8a8), C(-6.4, 0, 7.4, 0.3, 4, 0x2a2428)] },
  far: { size: 'm', len: 10, h: 9, r: 3.6, speed: 22, run: 80, parts: (sw) => [
    ...legs(1.8, -1.8, 1.2, 3.0, 0.4, 0x2a2428, sw), ell(0, 0, 5.0, 3.6, 2.5, 2.6, 'ull'), ell(3.6, 0, 5.8, 1.4, 1.0, 1.2, 0x2a2428),
    ell(3.2, 1.3, 6.4, 0.7, 0.35, 0.3, 0x2a2428), ell(3.2, -1.3, 6.4, 0.7, 0.35, 0.3, 0x2a2428), ell(4.4, 0.5, 6.2, 0.22, 0.22, 0.22, 0xf0e8d0), ell(4.4, -0.5, 6.2, 0.22, 0.22, 0.22, 0xf0e8d0)] },
  gris: { size: 'm', len: 11, h: 7, r: 3.6, speed: 24, run: 90, parts: (sw) => [
    ...legs(2.2, -2.2, 1.2, 2.4, 0.5, 0xe08890, sw), ell(0, 0, 4.0, 4.0, 2.4, 2.4, 0xf0a0a8), ell(3.8, 0, 4.4, 1.8, 1.6, 1.6, 0xf0a8b0),
    cyl(5.4, 0, 4.0, 0.8, 0.8, 0xe08890, 0), ell(3.4, 1.2, 6.0, 0.6, 0.5, 0.4, 0xe08890), ell(3.4, -1.2, 6.0, 0.6, 0.5, 0.4, 0xe08890),
    ell(4.6, 0.7, 5.0, 0.22, 0.22, 0.22, 0x1a1418), ell(4.6, -0.7, 5.0, 0.22, 0.22, 0.22, 0x1a1418), ell(-4.2, 0, 4.8, 0.5, 0.3, 0.5, 0xe08890)] },
  hona: { size: 's', len: 5, h: 5.5, r: 2, speed: 30, run: 110, skittish: true, parts: (sw) => [
    C(0.3 + sw, 0.5, 0.6, 0.2, 1.2, 0xf0b020), C(0.3 - sw, -0.5, 0.6, 0.2, 1.2, 0xf0b020), ell(0, 0, 2.6, 1.8, 1.2, 1.4, 0xf4f0e8),
    ell(1.6, 0, 4.0, 0.8, 0.7, 0.8, 0xf4f0e8), ell(1.6, 0, 4.9, 0.6, 0.2, 0.5, 0xe02828), ell(2.4, 0, 3.9, 0.4, 0.2, 0.2, 0xf0b020), ell(-1.9, 0, 3.4, 0.7, 0.5, 1.0, 0xe8e0d0)] },
  ren: { size: 'l', len: 16, h: 17, r: 5, mass: 1.8, speed: 30, run: 110, freeze: true, parts: (sw) => [
    ...legs(3.4, -3.4, 1.2, 6.4, 0.55, 0x5a4a3a, sw), ell(0, 0, 8.8, 5.2, 2.2, 2.6, 0x7a6a5a), ell(4.0, 0, 11.0, 1.4, 1.3, 2.2, 0xe8e4dc),
    ell(5.4, 0, 12.6, 2.0, 1.1, 1.2, 0x6a5a4a), ell(6.0, 0.7, 13.2, 0.3, 0.3, 0.3, 0x0e0a0c), ell(6.0, -0.7, 13.2, 0.3, 0.3, 0.3, 0x0e0a0c),
    C(4.8, 0.8, 15.0, 0.25, 3.4, 0xc8b48a), C(4.8, -0.8, 15.0, 0.25, 3.4, 0xc8b48a), ell(4.2, 1.6, 16.4, 0.9, 0.3, 0.3, 0xc8b48a), ell(4.2, -1.6, 16.4, 0.9, 0.3, 0.3, 0xc8b48a),
    ell(5.6, 1.2, 16.8, 0.3, 0.6, 0.6, 0xc8b48a), ell(5.6, -1.2, 16.8, 0.3, 0.6, 0.6, 0xc8b48a), ell(-5.0, 0, 9.6, 0.6, 0.6, 0.6, 0xe8e4dc)] },
  bjorn: { size: 'l', len: 14, h: 11, r: 5.4, mass: 2.2, speed: 26, run: 120, parts: (sw) => [
    ...legs(3.0, -3.0, 1.6, 4.0, 1.2, 0x4a2e1c, sw), ell(0, 0, 7.0, 5.2, 3.0, 3.4, 0x5a3a24), ell(5.0, 0, 8.0, 2.2, 2.0, 2.0, 0x5a3a24),
    ell(6.8, 0, 7.4, 1.2, 1.0, 0.9, 0x8a6040), ell(7.6, 0, 7.6, 0.4, 0.4, 0.4, 0x0e0a0c), ell(4.6, 1.5, 9.8, 0.7, 0.4, 0.7, 0x4a2e1c), ell(4.6, -1.5, 9.8, 0.7, 0.4, 0.7, 0x4a2e1c),
    ell(5.8, 1.0, 8.8, 0.3, 0.3, 0.3, 0x0e0a0c), ell(5.8, -1.0, 8.8, 0.3, 0.3, 0.3, 0x0e0a0c)] },
  kamel: { size: 'l', len: 17, h: 20, r: 5.4, mass: 2.4, speed: 22, run: 80, freeze: true, parts: (sw) => [
    ...legs(3.4, -3.4, 1.2, 9, 0.55, 0xb88e58, sw), ell(0, 0, 11, 5, 2.4, 2.6, 0xc8a066), ell(-1.6, 0, 14, 1.8, 1.6, 2.0, 0xc8a066), ell(1.8, 0, 13.8, 1.8, 1.6, 1.9, 0xc8a066),
    ell(5.0, 0, 13.6, 1.0, 1.0, 3.0, 0xc8a066), ell(6.6, 0, 16.4, 1.8, 1.0, 1.0, 0xb88e58), ell(7.0, 0.7, 16.9, 0.25, 0.25, 0.25, 0x0e0a0c), ell(7.0, -0.7, 16.9, 0.25, 0.25, 0.25, 0x0e0a0c), C(-5.0, 0, 10, 0.25, 3, 0x8a6a40)] },
  odla: { size: 's', len: 8, h: 2.5, r: 2.2, speed: 40, run: 160, skittish: true, parts: (sw) => [
    ell(0, 0, 1.0, 2.4, 0.9, 0.7, 0x6a8a3a), ell(2.4, 0, 1.2, 1.0, 0.7, 0.6, 0x7a9a44), ell(-3.0, 0, 0.8, 2.4, 0.4, 0.4, 0x5a7a30),
    ell(1.2 + sw, 1.2, 0.5, 0.5, 0.6, 0.3, 0x5a7a30), ell(1.2 - sw, -1.2, 0.5, 0.5, 0.6, 0.3, 0x5a7a30), ell(-1.2 - sw, 1.2, 0.5, 0.5, 0.6, 0.3, 0x5a7a30), ell(-1.2 + sw, -1.2, 0.5, 0.5, 0.6, 0.3, 0x5a7a30)] },
  krabba: { size: 's', len: 6, h: 3, r: 2.4, speed: 25, run: 70, skittish: true, side: true, parts: (sw) => [
    ell(0, 0, 1.6, 1.8, 2.2, 1.0, 0xe0482a), ell(1.8 + sw * 0.3, 1.9, 1.8, 0.9, 0.7, 0.6, 0xe85a34), ell(1.8 - sw * 0.3, -1.9, 1.8, 0.9, 0.7, 0.6, 0xe85a34),
    ell(1.2, 0.7, 2.8, 0.25, 0.25, 0.4, 0x1a1418), ell(1.2, -0.7, 2.8, 0.25, 0.25, 0.4, 0x1a1418),
    ell(-0.2, 2.4 + sw * 0.2, 0.6, 0.3, 1.0, 0.25, 0xc83a22), ell(-0.2, -2.4 - sw * 0.2, 0.6, 0.3, 1.0, 0.25, 0xc83a22)] },
  flamingo: { size: 'm', len: 7, h: 14, r: 2.6, speed: 18, run: 70, parts: (sw) => [
    C(0 + sw, 0.4, 3.6, 0.2, 7.2, 0xe07898), C(0 - sw, -0.4, 3.6, 0.2, 7.2, 0xe07898), ell(0, 0, 8.4, 2.4, 1.4, 1.6, 0xf088a8),
    ell(1.8, 0, 10.6, 0.4, 0.4, 2.0, 0xf088a8), ell(2.2, 0, 12.6, 0.8, 0.6, 0.7, 0xf498b4), ell(3.0, 0, 12.2, 0.7, 0.3, 0.3, 0x2a2428), ell(-2.2, 0, 8.8, 1.0, 1.0, 0.8, 0x2a2428)] },
  duva: { size: 's', len: 5, h: 3.5, r: 2, speed: 25, run: 60, skittish: true, flies: true, parts: (sw) => [
    C(0.2 + sw * 0.5, 0.3, 0.4, 0.15, 0.8, 0xe06070), C(0.2 - sw * 0.5, -0.3, 0.4, 0.15, 0.8, 0xe06070), ell(0, 0, 1.8, 1.8, 1.0, 1.1, 0x8a8a9c),
    ell(1.5, 0, 2.9, 0.7, 0.6, 0.6, 0x5a6a6c), ell(2.1, 0, 2.8, 0.3, 0.15, 0.15, 0xe0c080), ell(-1.8, 0, 1.6, 1.0, 0.6, 0.3, 0x6a6a7c)] },
  ratta: { size: 's', len: 6, h: 2.4, r: 1.8, speed: 50, run: 140, skittish: true, parts: (sw) => [
    ell(0, 0, 1.0, 1.8, 0.9, 0.9, 0x6a6470), ell(1.6, 0, 1.1, 0.8, 0.6, 0.6, 0x7a7480), ell(1.3, 0.5, 1.8, 0.35, 0.2, 0.35, 0xe0a0a8), ell(1.3, -0.5, 1.8, 0.35, 0.2, 0.35, 0xe0a0a8),
    cyl(-3.2, 0, 0.5, 0.15, 3.0, 0xe0a0a8, 0), ell(0.8 + sw, 0.7, 0.3, 0.3, 0.3, 0.3, 0xe0a0a8), ell(-0.8 - sw, -0.7, 0.3, 0.3, 0.3, 0.3, 0xe0a0a8)] },
  alien: { size: 'm', len: 5, h: 11, r: 2.6, speed: 30, run: 100, skittish: true, parts: (sw) => [
    C(0 + sw, 0.6, 1.2, 0.35, 2.4, 0x4ab83a), C(0 - sw, -0.6, 1.2, 0.35, 2.4, 0x4ab83a), ell(0, 0, 3.6, 1.4, 1.4, 2.0, 0x6ad84a),
    ell(0.2, 1.4, 3.8 + sw, 0.4, 0.4, 1.3, 0x6ad84a), ell(0.2, -1.4, 3.8 - sw, 0.4, 0.4, 1.3, 0x6ad84a),
    ell(0, 0, 7.0, 1.8, 1.8, 1.6, 0x6ad84a), ell(1.4, 0.7, 7.2, 0.5, 0.5, 0.6, 0x101018), ell(1.4, -0.7, 7.2, 0.5, 0.5, 0.6, 0x101018),
    C(0, 0.8, 9.4, 0.15, 1.8, 0x6ad84a), C(0, -0.8, 9.4, 0.15, 1.8, 0x6ad84a), ell(0, 0.8, 10.4, 0.45, 0.45, 0.45, 0xffe040), ell(0, -0.8, 10.4, 0.45, 0.45, 0.45, 0xffe040)] },
};

// ---------- sprites ----------
const sprites = new Map();
function animalMat(mat, lp) {
  if (typeof mat === 'number') return mat;
  if (mat === 'ko') return hash(Math.floor(lp[0] / 2.2 + Math.sin(lp[1]) * 0.8), Math.floor(lp[2] / 2.2 + lp[1] / 3), 77) > 0.58 ? 0x1c1a20 : 0xf2f0ea;
  if (mat === 'ull') return hash(Math.floor(lp[0] * 1.3), Math.floor(lp[2] * 1.3 + lp[1]), 78) > 0.5 ? 0xf2ecd8 : 0xd8d0b8;
  return 0xff00ff;
}
// pose: 'walk' | 'dead' (på sidan) | 'flat' (överkörd)
function posed(parts, pose) {
  if (pose === 'walk') return parts;
  return parts.map((p) => {
    const q = { ...p, c: [...p.c] };
    // rulla 90° runt x-axeln: (x, y, z) → (x, -z, y)
    const [x, y, z] = p.c;
    q.c = [x, -z, y];
    if (p.t === 'ell') q.r = [p.r[0], p.r[2], p.r[1]];
    else if (p.t === 'cyl') q.ax = p.ax === 2 ? 1 : p.ax === 1 ? 2 : 0;
    if (pose === 'flat') { q.c = [x * 1.15, -z * 1.25, y * 0.18]; if (p.t === 'ell') q.r = [p.r[0] * 1.15, p.r[2] * 1.25, Math.max(0.25, p.r[1] * 0.2)]; else if (p.t === 'cyl') { q.r = p.r * 0.5; } }
    return q;
  });
}
export function animalSprite(type, pose, frame, ang, variant) {
  const a8 = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  const key = `${type}|${pose}|${frame}|${a8}|${variant || ''}`;
  let s = sprites.get(key);
  if (s) return s;
  const S = SPECIES[type];
  const sw = pose === 'walk' ? [0, 0.7, -0.7][frame] * (S.len > 12 ? 1.6 : 1) : 0;
  let parts = posed(S.parts(sw, variant), pose);
  if (pose !== 'walk') {
    let zmin = 1e9;
    for (const p of parts) { const rz = p.t === 'ell' ? p.r[2] : p.ax === 2 ? p.hw : p.r; zmin = Math.min(zmin, p.c[2] - rz); }
    parts = parts.map((p) => ({ ...p, c: [p.c[0], p.c[1], p.c[2] - zmin + (pose === 'flat' ? 0.05 : 0)] }));
  }
  const R = S.len / 2 + 3, H = pose === 'walk' ? S.h : pose === 'flat' ? 2 : S.h * 0.6;
  const W = Math.ceil(R * 2.2 + 8), Hh = Math.ceil(R * 1.2 + H + 8);
  const OX = Math.ceil(W / 2), OY = Math.ceil(R * 0.6 + H + 4);
  const cv = renderParts(parts, (a8 / 8) * Math.PI * 2, W, Hh, OX, OY, animalMat, true);
  s = { cv, ox: OX, oy: OY };
  sprites.set(key, s);
  return s;
}
const burntCache = new Map();
export function charred(s) { let b = burntCache.get(s); if (!b) { b = { cv: burnt(s.cv), ox: s.ox, oy: s.oy }; burntCache.set(s, b); } return b; }

// ---------- beteende ----------
const PICK = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
export class Animals {
  constructor(R, on) {
    this.R = R; this.on = on; this.list = []; this.spawnT = 2; this.q = {};
    const th = R.world.th;
    this.kinds = th.animals || [];
    this.variant = th.ground === 'snow' ? 'vit' : '';
    this.max = R.mode === 'attract' ? 4 : 7;
  }
  ref() { const R = this.R; return R.player && !R.player.finished ? R.player : R.leader; }
  spawn() {
    const R = this.R, T = R.T, W = R.world, me = this.ref();
    if (!me || !this.kinds.length) return;
    const s = me.s + 260 + Math.random() * 420;
    const i = idxAt(T, s);
    if (T.flags[i] & 1) return;
    const side = Math.random() < 0.5 ? 1 : -1;
    const hw = T.HW[i];
    const d0 = side * (hw + 22 + Math.random() * 40);
    const x = T.X[i] + T.NX[i] * d0, y = T.Y[i] + T.NY[i] * d0;
    const g = W.groundAt(x, y, i);
    if (W.gm === MAT.WATER || W.gm === MAT.LEAF || Math.abs(g - T.Z[i]) > 6) return;
    const type = PICK(this.kinds, Math.random());
    const S = SPECIES[type];
    const j = idxAt(T, s + (Math.random() - 0.3) * 80);
    const d1 = -side * (T.HW[j] + 22 + Math.random() * 40);
    const tx = T.X[j] + T.NX[j] * d1, ty = T.Y[j] + T.NY[j] * d1;
    // flockdjur kommer i grupp
    const n = (type === 'far' || type === 'hona' || type === 'duva' || type === 'krabba' || type === 'alien') ? 2 + (Math.random() * 3 | 0) : type === 'ko' || type === 'ren' ? 1 + (Math.random() * 2 | 0) : 1;
    for (let k = 0; k < n; k++) {
      const ox = (Math.random() - 0.5) * 16, oy = (Math.random() - 0.5) * 16;
      this.list.push({
        type, S, x: x + ox, y: y + oy, z: g, tx: tx + ox, ty: ty + oy, ang: Math.atan2(ty - y, tx - x), state: 'walk', t: 0,
        speed: S.speed * (0.7 + Math.random() * 0.5), idle: Math.random() < 0.5 ? 0.5 + Math.random() * 2 : 0, si: i, hp: S.size === 'l' ? 60 : 20,
        vx: 0, vy: 0, vz: 0, spin: 0, frameT: Math.random(), fresh: 0, burnt: false,
      });
    }
  }
  update(dt, racing) {
    if (!this.on) return;
    const R = this.R, W = R.world, T = R.T, me = this.ref();
    this.spawnT -= dt;
    const alive = this.list.filter((a) => a.state === 'walk' || a.state === 'flee' || a.state === 'idle').length;
    if (this.spawnT <= 0 && alive < this.max && racing) { this.spawn(); this.spawnT = 1.5 + Math.random() * 3; }
    for (const a of this.list) {
      a.t += dt;
      if (a.fresh > 0) a.fresh -= dt;
      if (a.state === 'fly') {
        a.vz -= 560 * (W.th.grav || 1) * dt;
        a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt; a.ang += a.spin * dt;
        const g = W.groundAt(a.x, a.y, a.si);
        if (a.z <= g) {
          a.z = g;
          if (W.gw) { a.state = 'gone'; R.fx.splash(a.x, a.y, 0, 14); continue; }
          if (a.vz < -60) { this.blood(a.x, a.y, g, a.S.size === 'l' ? 14 : 8, a.vx, a.vy); R.events('thud', a); }
          a.vz = -a.vz * 0.2; a.vx *= 0.5; a.vy *= 0.5; a.spin *= 0.4;
          if (Math.abs(a.vz) < 30) { a.vz = 0; a.state = 'dead'; this.blood(a.x, a.y, g, a.S.size === 'l' ? 10 : 6, 0, 0); }
        }
        continue;
      }
      if (a.state === 'dead' || a.state === 'flat' || a.state === 'gone') {
        if (a.state === 'dead' && (a.vx || a.vy)) { const k = Math.exp(-4 * dt); a.vx *= k; a.vy *= k; a.x += a.vx * dt; a.y += a.vy * dt; if (Math.abs(a.vx) + Math.abs(a.vy) < 2) a.vx = a.vy = 0; }
        continue;
      }
      // levande: rädda för bilar
      let nearCar = null, nd = 1e9;
      for (const c of R.cars) { const d = Math.hypot(c.x - a.x, c.y - a.y); if (d < nd) { nd = d; nearCar = c; } }
      if (a.S.flies && nearCar && nd < 70) { a.state = 'fly'; a.vz = 120; a.vx = (a.x - nearCar.x) / nd * 80; a.vy = (a.y - nearCar.y) / nd * 80; a.flyAway = true; continue; }
      if (nearCar && nd < (a.S.freeze ? 90 : 75) && nearCar.speed > 40) {
        if (a.S.freeze) { a.state = 'idle'; a.idle = Math.max(a.idle, 0.6); }
        else if (a.S.skittish && a.state !== 'flee') {
          a.state = 'flee';
          // spring bort från bilen, ibland rakt ut på vägen (hararna gör så)
          const away = Math.atan2(a.y - nearCar.y, a.x - nearCar.x) + (Math.random() - 0.5) * (a.type === 'hare' ? 2.6 : 1.2);
          a.tx = a.x + Math.cos(away) * 120; a.ty = a.y + Math.sin(away) * 120;
        }
      }
      if (a.state === 'idle') { a.idle -= dt; if (a.idle <= 0) a.state = 'walk'; continue; }
      if (a.idle > 0 && a.state === 'walk') { a.idle -= dt; continue; }
      const dx = a.tx - a.x, dy = a.ty - a.y, dist = Math.hypot(dx, dy);
      if (dist < 4) { // framme: vänd och gå tillbaka över vägen
        a.state = 'walk'; a.idle = 1 + Math.random() * 3;
        nearest(T, a.x, a.y, a.si, 20, this.q); a.si = this.q.i;
        const j = idxAt(T, this.q.s + (Math.random() - 0.5) * 60);
        const d1 = -Math.sign(this.q.d || 1) * (T.HW[j] + 22 + Math.random() * 40);
        a.tx = T.X[j] + T.NX[j] * d1; a.ty = T.Y[j] + T.NY[j] * d1;
        continue;
      }
      const sp = a.state === 'flee' ? a.S.run : a.speed;
      let ang = Math.atan2(dy, dx);
      if (a.type === 'hare' && a.state === 'flee') ang += Math.sin(a.t * 9) * 0.7;
      a.ang = ang + (a.S.side ? Math.PI / 2 : 0);
      const nx = a.x + Math.cos(ang) * sp * dt, ny = a.y + Math.sin(ang) * sp * dt;
      const g = W.groundAt(nx, ny, a.si);
      if (W.gm === MAT.WATER || Math.abs(g - a.z) > 4) { a.tx = a.x - dx; a.ty = a.y - dy; a.state = 'walk'; continue; }
      a.x = nx; a.y = ny; a.z = g;
      a.frameT += dt * sp / (a.S.len * 0.5);
    }
    // krockar med bilar
    if (racing) for (const c of R.cars) {
      if (c.wreckT > 0 || c.sinkT > 0) continue;
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
      for (const a of this.list) {
        if (a.state === 'dead' || a.state === 'flat' || a.state === 'gone' || a.state === 'fly') continue;
        if (Math.abs(a.x - c.x) > 40 || Math.abs(a.y - c.y) > 40) continue;
        if (c.z > a.z + a.S.h + 2) continue;
        for (const o of c.co) {
          const cx = c.x + fx * o, cy = c.y + fy * o;
          const dx = a.x - cx, dy = a.y - cy, d = Math.hypot(dx, dy);
          if (d > c.cr + a.S.r) continue;
          this.hit(a, c, dx / (d || 1), dy / (d || 1));
          break;
        }
      }
    }
    // städa bort långt bakom
    if (me && this.list.length > 40) this.list = this.list.filter((a) => Math.hypot(a.x - me.x, a.y - me.y) < 700 || a.fresh > 0);
    else if (me) this.list = this.list.filter((a) => a.state !== 'gone' && (Math.hypot(a.x - me.x, a.y - me.y) < 900));
  }
  hit(a, c, nx, ny) {
    const R = this.R, S = a.S, sp = c.speed;
    if (S.size === 's') {
      if (sp < 15) { a.x += nx * 3; a.y += ny * 3; return; }
      a.state = 'flat'; a.ang = c.ang + (Math.random() - 0.5); a.fresh = 30;
      this.blood(a.x, a.y, a.z, 9, c.vx, c.vy);
      R.fx.add('blood', a.x, a.y, a.z + 2, c.vx * 0.3, c.vy * 0.3, 40, 0.4, 2, 300, 1);
      for (let k = 0; k < 8; k++) R.fx.add('blood', a.x, a.y, a.z + 1, (Math.random() - 0.5) * 80 + c.vx * 0.2, (Math.random() - 0.5) * 80 + c.vy * 0.2, 30 + Math.random() * 60, 0.5, 1, 400, 0.5);
      c.roadkill++; c.vz = Math.max(c.vz, 0);
      R.events('splat', a, c);
      return;
    }
    if (S.size === 'm') {
      if (sp < 25) { a.x += nx * 4; a.y += ny * 4; return; }
      this.launch(a, c, nx, ny, sp * 0.95, 90 + sp * 0.35);
      c.vx *= 0.9; c.vy *= 0.9;
      R.damage(c, 2 + sp * 0.01, null, 'animal');
      c.roadkill++;
      R.events('animal', a, c);
      return;
    }
    // stort djur: riktig krock
    const ma = S.mass, mc = c.mass;
    const rv = c.vx * nx + c.vy * ny; // fart in mot djuret
    if (rv < 20) { c.x -= nx * 2; c.y -= ny * 2; c.vx -= nx * Math.max(0, rv) * 1.2; c.vy -= ny * Math.max(0, rv) * 1.2; return; }
    const j = (1 + 0.3) * rv / (1 / mc + 1 / ma);
    c.vx -= nx * j / mc; c.vy -= ny * j / mc;
    c.angVel += (Math.random() - 0.5) * 6 / mc;
    c.tackleT = Math.max(c.tackleT, 0.5);
    R.damage(c, Math.max(0, rv - 30) * 0.09 * (ma / mc), null, 'animal');
    if (rv > 140 && mc < 1.6) { c.air = true; c.vz = 70; }
    this.launch(a, c, nx, ny, j / ma * 1.3, Math.min(320, 60 + j / ma * 0.7));
    R.fx.sparks(a.x, a.y, a.z + 6, 6, 90);
    R.events('moose', a, c, rv);
    c.roadkill++;
  }
  launch(a, c, nx, ny, v, vz) {
    a.state = 'fly'; a.fresh = 40;
    a.vx = nx * v + c.vx * 0.5; a.vy = ny * v + c.vy * 0.5; a.vz = vz; a.spin = (Math.random() - 0.5) * 14;
    for (let k = 0; k < 10; k++) this.R.fx.add('blood', a.x, a.y, a.z + a.S.h * 0.5, (Math.random() - 0.5) * 90 + a.vx * 0.3, (Math.random() - 0.5) * 90 + a.vy * 0.3, 40 + Math.random() * 80, 0.6, 1, 400, 0.4);
  }
  blood(x, y, z, r, vx, vy) {
    const W = this.R.world, sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp;
    const n = Math.round(r * r * 1.6);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r;
      W.mark(x + Math.cos(a) * d, y + Math.sin(a) * d, z, k % 3 ? '#8a1018' : '#b81c24', 0.85);
    }
    // utsmetat i körriktningen
    if (sp > 30) for (let k = 0; k < r * 4; k++) { const t = Math.random() * r * 2.5, w = (Math.random() - 0.5) * r * 0.6; W.mark(x + ux * t - uy * w, y + uy * t + ux * w, z, '#7a0e14', 0.6); }
  }
  // tutan skrämmer djuren av vägen
  scare(x, y, r) {
    for (const a of this.list) {
      if (a.state !== 'walk' && a.state !== 'idle') continue;
      const dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy);
      if (d > r) continue;
      if (a.S.flies) { a.state = 'fly'; a.flyAway = true; a.vz = 140; a.vx = dx / (d || 1) * 90; a.vy = dy / (d || 1) * 90; continue; }
      a.state = 'flee'; a.idle = 0;
      const T = this.R.T;
      nearest(T, a.x, a.y, a.si, 20, this.q);
      const sd = Math.sign(this.q.d || 1);
      a.tx = a.x + T.NX[this.q.i] * sd * 90; a.ty = a.y + T.NY[this.q.i] * sd * 90;
    }
  }
  // vapen
  hitAt(x, y, z, by, dmg) {
    for (const a of this.list) {
      if (a.state === 'dead' || a.state === 'flat' || a.state === 'gone' || a.state === 'fly') continue;
      if ((a.x - x) ** 2 + (a.y - y) ** 2 > (a.S.r + 2) ** 2 || z > a.z + a.S.h + 3) continue;
      a.hp -= dmg;
      this.R.fx.add('blood', a.x, a.y, a.z + a.S.h * 0.5, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 40, 0.4, 1, 400, 0.5);
      if (a.hp <= 0) { a.state = 'dead'; a.fresh = 30; this.blood(a.x, a.y, a.z, a.S.size === 'l' ? 9 : 5, 0, 0); this.R.events('thud', a); }
      return true;
    }
    return false;
  }
  flame(x0, y0, fx, fy, R, by) {
    for (const a of this.list) {
      if (a.state === 'gone' || a.state === 'flat' || a.burnt) continue;
      const dx = a.x - x0, dy = a.y - y0, d = Math.hypot(dx, dy);
      if (d > R || (dx * fx + dy * fy) / (d || 1) < 0.8) continue;
      a.hp -= 2;
      if (a.hp <= 0) { a.burnt = true; if (a.state !== 'fly') a.state = 'dead'; a.fresh = 30; }
    }
    void by;
  }
  blast(x, y, r) {
    for (const a of this.list) {
      if (a.state === 'gone' || a.state === 'fly') continue;
      const dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy);
      if (d > r * 1.3) continue;
      const k = 1 - d / (r * 1.3);
      a.state = 'fly'; a.fresh = 40;
      a.vx = dx / (d || 1) * 160 * k; a.vy = dy / (d || 1) * 160 * k; a.vz = 120 + 160 * k / (a.S.mass || 1); a.spin = (Math.random() - 0.5) * 12;
    }
  }
  // för ritningen
  spriteOf(a) {
    if (a.state === 'flat') return animalSprite(a.type, 'flat', 0, a.ang, this.variant);
    if (a.state === 'dead' || (a.state === 'fly' && !a.flyAway)) { const s = animalSprite(a.type, 'dead', 0, a.ang, this.variant); return a.burnt ? charred(s) : s; }
    const fr = a.state === 'idle' || (a.idle > 0 && a.state === 'walk') ? 0 : 1 + (Math.floor(a.frameT * 2) & 1);
    return animalSprite(a.type, 'walk', fr, a.ang, this.variant);
  }
}
export { mul };
