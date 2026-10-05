// Kontrollerar banorna: längd, minsta avstånd mellan olika delar av vägen, skarpaste kurvan.
import { TRACKS } from '../js/tracks.js';
import { buildTrack } from '../js/trackgeo.js';
for (const id of Object.keys(TRACKS)) {
  if (id.endsWith('_r')) continue;
  const T = buildTrack(TRACKS[id]);
  let md = 1e9, at = null;
  for (let i = 0; i < T.n; i += 3) for (let j = 0; j < T.n; j += 3) {
    let ds = Math.abs(i - j) * T.sp; ds = Math.min(ds, T.L - ds);
    if (ds < 260) continue;
    const d = Math.hypot(T.X[i] - T.X[j], T.Y[i] - T.Y[j]);
    if (d < md) { md = d; at = [Math.round(T.X[i]), Math.round(T.Y[i]), Math.round(i * T.sp), Math.round(j * T.sp)]; }
  }
  let kmax = 0; for (let i = 0; i < T.n; i++) kmax = Math.max(kmax, Math.abs(T.K[i]));
  let bx = [1e9, 1e9, -1e9, -1e9];
  for (let i = 0; i < T.n; i++) { bx[0] = Math.min(bx[0], T.X[i]); bx[1] = Math.min(bx[1], T.Y[i]); bx[2] = Math.max(bx[2], T.X[i]); bx[3] = Math.max(bx[3], T.Y[i]); }
  console.log(`${id}: längd ${T.L | 0}, minsta avstånd mellan delar ${md | 0} vid ${at}, min radie ${(1 / kmax) | 0}, ram ${bx.map((v) => v | 0)}`);
}
