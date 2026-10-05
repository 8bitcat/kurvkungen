// Isometrisk projektion (2:1) och ljusriktning som gäller överallt: terräng, bilar, rekvisita.
// Skärm: sx = x − y, sy = (x + y)/2 − z.  +x+y = mot betraktaren (nedåt på skärmen).
// Ljuset kommer från vänster uppe på skärmen; skuggor faller åt höger.
export const isoX = (x, y) => x - y;
export const isoY = (x, y, z) => (x + y) * 0.5 - z;
const l = Math.hypot(-0.7, 0.35, 0.9);
export const LX = -0.7 / l, LY = 0.35 / l, LZ = 0.9 / l;
const lh = Math.hypot(LX, LY);
// Skuggans förskjutning på marken per höjdenhet (bort från ljuset)
export const SHX = (-LX / lh) * (lh / LZ), SHY = (-LY / lh) * (lh / LZ);
export const TS = 256; // terrängrutornas storlek i skärmpixlar
