// Värdebrus och fbm på hash-gittret (deterministiskt per frö).
import { hash } from './pix.js?v=1';

export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, seed = 0, oct = 4) {
  let s = 0, amp = 0.5, tot = 0, f = 1;
  for (let o = 0; o < oct; o++) {
    s += vnoise(x * f, y * f, seed + o * 131) * amp;
    tot += amp; amp *= 0.5; f *= 2.03;
  }
  return s / tot;
}
