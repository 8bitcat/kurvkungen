// Provkör ett Grand Prix huvudlöst med autopilot och logga däck, depåstopp, DRS och varvtider.
// node tools/gprace.mjs "<bana>" <varv> [fart] [bilder]   t.ex. node tools/gprace.mjs kungsringen 5 4 4
// Skriver också uppskattade kvaltider bredvid datorförarnas riktiga bästa varv (kalibrering av LAP_CAL).
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, track = 'kungsringen', laps = '5', fast = '4', shots = '4', extra = ''] = process.argv;
const PORT = process.env.PORT || '8803';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/index.html?gp=${track}&laps=${laps}&auto=1&fast=${fast}${extra ? '&' + extra : ''}`);
await page.waitForFunction(() => window.KK && window.KK.G.state === 'race', null, { timeout: 90000 });
console.log(`laddat efter ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const info = await page.evaluate(() => { const R = window.KK.G.race; return { L: Math.round(R.T.L), n: R.cars.length, drs: R.drsZones.map((z) => [Math.round(z.start), Math.round(z.end)]), wearScale: R.wearScale, pit: R.T.pit && { s0: R.T.pit.s0, s1: R.T.pit.s1, side: R.T.pit.side } }; });
console.log(JSON.stringify(info));
let shot = 0, lastLog = 0;
const deadline = Date.now() + 15 * 60 * 1000;
const every = Math.max(20, +laps * 60 / +shots);
while (Date.now() < deadline) {
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => {
    const G = window.KK.G, R = G.race;
    return {
      state: G.state, phase: R.phase, time: +R.raceTime.toFixed(1), ms: G.ms && +G.ms.toFixed(1), stats: G.stats,
      cars: R.order.map((c) => `${c.isPlayer ? '*' : ''}${c.code} v${c.lap} ${c.tyre.c[0]}${c.tyre.wear | 0}%${c.pitPhase ? ' DEPÅ:' + c.pitPhase : ''}${c.boxing ? ' BOX' : ''} s${c.stops}${c.wingLost ? " NOS!" : c.wing > 5 ? " w" + (c.wing | 0) : ""}${c.punct ? " PUNKA" : ""}${c.drs ? ' DRS' : ''}${c.tow > 0.3 ? ' sug' : ''} ${c.kmh}`),
    };
  });
  if (st.state !== 'race') { console.log('läge', st.state); break; }
  if (st.time - lastLog >= every || st.phase !== 'race') {
    lastLog = st.time;
    console.log(`t=${st.time} ${st.phase} ${st.ms}ms`, JSON.stringify(st.stats));
    console.log('  ' + st.cars.join(' | '));
    if (shot < +shots) await page.screenshot({ path: `tools/out/gp-${shot++}.png` });
  }
}
await page.waitForTimeout(2500);
const res = await page.evaluate(() => {
  const G = window.KK.G, R = G.race, KK = window.KK;
  const r = G.results;
  const est = R.cars.map((c) => ({ code: c.code, team: c.team, best: +(c.bestLap || 0).toFixed(2), est: +KK.lapEstimate(R.T, KK.f1Stats(KK.teamById(c.team).perf), c.ai ? c.ai.skill : 0.8).toFixed(2), laps: c.lapTimes.map((x) => +x.toFixed(1)), stops: c.stops, used: [...c.used], pen: c.penalty || 0 }));
  return { state: G.state, rows: r && r.rows && r.rows.map((x) => `${x.name} ${x.team} ${x.down ? '+' + x.down + 'V' : '+' + x.gap.toFixed(1)} best ${x.best.toFixed(2)} stopp ${x.stops} ${x.tyres.join('/')} ${x.pts}p${x.pen ? ' STRAFF' : ''}`), est };
});
console.log('läge efter', res.state);
if (res.rows) console.log(res.rows.join('\n'));
const ratios = res.est.filter((e) => e.best && e.est).map((e) => e.best / e.est);
for (const e of res.est) console.log(`${e.code} ${e.team} bästa ${e.best} uppsk ${e.est} kvot ${(e.best / e.est).toFixed(3)} varv ${e.laps.join(' ')} stopp ${e.stops} ${e.used.join('/')}`);
if (ratios.length) console.log('medelkvot', (ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(3), 'min', Math.min(...ratios).toFixed(3), 'max', Math.max(...ratios).toFixed(3));
await page.screenshot({ path: 'tools/out/gp-end.png' });
if (errors.length) console.log('FEL:\n' + [...new Set(errors)].join('\n'));
await browser.close();
