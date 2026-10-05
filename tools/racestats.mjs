// Kör ett helt lopp med autopilot i hög fart och skriver statistik: node tools/racestats.mjs <bana> [varv] [fart]
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, track = 'sjoviken', laps = '3', fast = '6'] = process.argv;
const PORT = process.env.PORT || '8803';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/index.html?race=${track}&auto=1&fast=${fast}&laps=${laps}`);
await page.waitForFunction(() => window.KK && window.KK.G.state === 'race', null, { timeout: 60000 });
const t0 = Date.now();
let samples = 0, stuckMax = {}; const trace = [];
while (Date.now() - t0 < 240000) {
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => { const G = window.KK.G; return { st: G.state, slow: G.race.cars.map((c) => (c.speed < 20 && G.race.phase === 'race' ? 1 : 0)), tr: G.race.cars.map((c) => [c.name, Math.round(c.x), Math.round(c.y), Math.round(c.progress), c.kmh, c.surf, Math.round(c.dist - c.hw), c.wreckT > 0 ? 'V' : c.sinkT > 0 ? 'S' : c.air ? 'A' : '', c.ai ? +c.ai.revT.toFixed(1) : 0]) }; });
  trace.push(r.tr);
  if (process.env.TRACE) { const dump = await page.evaluate(() => { const R = window.KK.G.race, W = R.world, out = []; for (const c of R.cars) { if (c.speed > 6 || R.phase !== 'race' || c.finished || c.wreckT > 0) continue; const near = W.propsNear(c.x, c.y, 30, []).filter((p) => p.r > 0 && Math.hypot(p.x - c.x, p.y - c.y) < 20).map((p) => p.kind + '@' + Math.round(Math.hypot(p.x - c.x, p.y - c.y))); const oc = R.cars.filter((o) => o !== c && Math.hypot(o.x - c.x, o.y - c.y) < 25).map((o) => o.name); out.push({ n: c.name, inp: c.inp, ai: c.ai && { st: +c.ai.stuckT.toFixed(2), rev: +c.ai.revT.toFixed(2), off: +c.ai.offT.toFixed(2) }, ang: +c.ang.toFixed(2), z: +c.z.toFixed(1), g: +W.groundAt(c.x, c.y, c.si).toFixed(1), air: c.air, oil: c.oilT, rub: c.rubber, vt: c.vt && Math.round(c.vt[c.si]), near, oc, prog: Math.round(c.progress), progT: c.progT && +c.progT.toFixed(1) }); } return out; }); if (dump.length) console.log('  STOPP', JSON.stringify(dump)); }
  samples++;
  r.slow.forEach((s, k) => { stuckMax[k] = (stuckMax[k] || 0) + s; });
  if (r.st === 'results') break;
}
const out = await page.evaluate(() => {
  const G = window.KK.G, R = G.race;
  return {
    state: G.state, time: R.raceTime.toFixed(1), stats: G.stats,
    cars: R.finishOrder.map((c) => `${c.place}. ${c.isPlayer ? '*' : ''}${c.name} (${c.carId}) tid ${c.finishTime.toFixed(1)} varv [${c.lapTimes.map((t) => t.toFixed(1)).join(', ')}] skada ${c.dmg | 0} kills ${c.kills} kr ${c.money}`),
  };
});
console.log(`${track}: läge ${out.state}, lopptid ${out.time} s`);
out.cars.forEach((l) => console.log('  ' + l));
console.log('  händelser', JSON.stringify(out.stats));
console.log('  sekunder < 20 km/h per bil', JSON.stringify(stuckMax));
await page.screenshot({ path: `tools/out/stats-${track}.png` });
// spårning: bilar som tappat (progress ökar < 300 på 3 s)
if (process.env.TRACE) for (let k = 0; k < trace[0].length; k++) for (let i = 3; i < trace.length; i++) { const a = trace[i - 3][k], b = trace[i][k]; if (b[3] - a[3] < 300 && b[3] < 3 * 7200) console.log('  TAPP', i, JSON.stringify(b)); }
if (errors.length) console.log('FEL:\n' + [...new Set(errors)].join('\n'));
await browser.close();
