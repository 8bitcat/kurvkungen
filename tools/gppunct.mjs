// Ger en datorbil punka och följer den tills den har bytt däck: node tools/gppunct.mjs [bana] [bilindex]
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, track = 'fjallringen', idx = '10'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:8803/index.html?gp=${track}&laps=8&auto=1&fast=4`);
await page.waitForFunction(() => window.KK && window.KK.G.state === 'race', null, { timeout: 90000 });
await page.waitForFunction(() => window.KK.G.race.raceTime > 15, null, { timeout: 90000 });
await page.evaluate((k) => {
  const R = window.KK.G.race, c = R.cars[+k];
  c.punct = 1; R.events('puncture', c, 'hit');
  window.trace = []; let next = 0;
  const tick = R.tick.bind(R);
  R.tick = (dt) => {
    tick(dt);
    if (R.raceTime < next) return;
    next = R.raceTime + 0.5;
    const T = R.T; let rs = ((c.s % T.L) + T.L) % T.L; if (rs > T.L / 2) rs -= T.L;
    window.trace.push(`${R.raceTime.toFixed(1)} ${c.code} rs${Math.round(rs)} d${(c.d * T.pit.side).toFixed(0)} ${c.kmh}km/h ${c.surf} ${c.pitPhase || '-'} ${c.boxing ? 'BOX' : ''} ${c.punct ? 'PUNKA' : ''} stopp${c.stops} varv${c.lap}${c.ai.revT > 0 ? ' BACK' : ''}`);
  };
}, idx);
await page.waitForFunction((k) => { const c = window.KK.G.race.cars[+k]; return c.stops > 0 || window.KK.G.race.raceTime > 140; }, idx, { timeout: 200000 });
const tr = await page.evaluate(() => window.trace);
console.log(tr.join('\n'));
if (errors.length) console.log('FEL', errors);
await browser.close();
