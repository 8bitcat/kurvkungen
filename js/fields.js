// Åkrarna på bondlandet: ett rutnät av fält med typ (plöjt, vete, grönt, raps) och radriktning.
// Delas av terrängmålaren (färg) och generatorn (höbalar), så att de alltid stämmer överens.
import { hash } from './pix.js?v=1';

const FX = 130, FY = 96;
export function fieldAt(x, y, seed) {
  const gx = Math.floor((x + 37) / FX), gy = Math.floor((y + 11) / FY);
  if (hash(gx, gy, seed + 501) > 0.7) return null;
  const lx = x + 37 - gx * FX, ly = y + 11 - gy * FY;
  if (lx < 5 || lx > FX - 5 || ly < 5 || ly > FY - 5) return { edge: true, lx, ly };
  const type = Math.floor(hash(gx, gy, seed + 502) * 4);
  const dir = hash(gx, gy, seed + 503) > 0.5;
  return { type, row: dir ? lx : ly, lx, ly, gx, gy, dir };
}
export const FIELD = { w: FX, h: FY };
