// Djurtest: många djur framför spelaren, skärmdumpar. node tools/djur.mjs <bana> [bilder]
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, track = 'sjoviken', shots = '6'] = process.argv;
const PORT = process.env.PORT || '8803';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.goto(`http://localhost:${PORT}/index.html?race=${track}&auto=1`);
await page.waitForFunction(() => window.KK && window.KK.G.state === 'race', null, { timeout: 60000 });
await page.waitForTimeout(4000);
for (let k = 0; k < +shots; k++) {
  await page.evaluate(() => { const A = window.KK.G.race.animals; A.max = 30; for (let i = 0; i < 6; i++) A.spawn(); });
  await page.waitForTimeout(2200);
  const st = await page.evaluate(() => { const A = window.KK.G.race.animals; const c = {}; for (const a of A.list) c[a.type + ':' + a.state] = (c[a.type + ':' + a.state] || 0) + 1; return c; });
  console.log(JSON.stringify(st));
  await page.screenshot({ path: `tools/out/djur-${k}.png` });
}
if (errors.length) console.log('FEL:\n' + [...new Set(errors)].join('\n'));
await browser.close();
