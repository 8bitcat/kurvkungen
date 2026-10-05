// Provkör spelet huvudlöst: node tools/play.mjs "<query>" <sekunder> [bilder] [bredd] [höjd]
// T.ex. node tools/play.mjs "race=sjoviken&auto=1" 20 4  → skärmdumpar i tools/out/play-*.png
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, query = '', secs = '15', shots = '3', w = '1440', h = '810'] = process.argv;
const PORT = process.env.PORT || '8803';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); else if (process.env.LOG) console.log('[log]', m.text()); });
const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/index.html?${query}`);
await page.waitForFunction(() => window.KK && (window.KK.G.state === 'race' || window.KK.G.state === 'title'), null, { timeout: 60000 });
console.log(`klar att köra efter ${((Date.now() - t0) / 1000).toFixed(1)} s, läge ${await page.evaluate(() => window.KK.G.state)}`);
const n = +shots, dur = +secs * 1000;
for (let k = 0; k < n; k++) {
  await page.waitForTimeout(dur / n);
  const st = await page.evaluate(() => {
    const G = window.KK.G, R = G.race;
    if (!R) return { state: G.state };
    return {
      state: G.state, phase: R.phase, time: +R.raceTime.toFixed(1), tiles: G.world.painted + '/' + G.world.total,
      cars: R.cars.map((c) => `${c.isPlayer ? '*' : ''}${c.name}:p${c.place} v${c.lap} ${c.kmh}km/h d${c.dmg | 0} ${c.surf}${c.air ? ' LUFT' : ''}${c.wreckT > 0 ? ' VRAK' : ''}`),
    };
  });
  console.log(JSON.stringify(st));
  await page.screenshot({ path: `tools/out/play-${k}.png` });
}
if (errors.length) console.log('FEL:\n' + [...new Set(errors)].join('\n'));
await browser.close();
