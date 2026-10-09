// Kontrollerar GP-banorna: längd, minsta avstånd, min radie, raksträckor (DRS-kandidater)
import { GP_TRACKS } from '../js/tracks.js';
import { buildTrack } from '../js/trackgeo.js';
for (const id of Object.keys(GP_TRACKS)) {
  const T = buildTrack(GP_TRACKS[id]);
  let md = 1e9, at = null;
  for (let i = 0; i < T.n; i += 3) for (let j = 0; j < T.n; j += 3) {
    let ds = Math.abs(i - j) * T.sp; ds = Math.min(ds, T.L - ds);
    if (ds < 300) continue;
    const d = Math.hypot(T.X[i] - T.X[j], T.Y[i] - T.Y[j]);
    if (d < md) { md = d; at = [Math.round(T.X[i]), Math.round(T.Y[i])]; }
  }
  let kmax = 0; for (let i = 0; i < T.n; i++) kmax = Math.max(kmax, Math.abs(T.K[i]));
  // raksträckor: |KS| < 0.0012 i följd
  const str = []; let run = 0;
  for (let i = 0; i < T.n * 2; i++) { const k = Math.abs(T.KS[i % T.n]); if (k < 0.0012) run++; else { if (run * T.sp > 450) str.push(Math.round(run * T.sp)); run = 0; } if (i >= T.n && run === 0 && str.length) break; }
  console.log(`${id}: längd ${T.L | 0}, min avstånd ${md | 0} vid ${at}, min radie ${(1 / kmax) | 0}, raksträckor ${str.join(',')}`);
}
