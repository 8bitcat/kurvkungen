// Mobilvy (iPhone 13 mini liggande, pek): node tools/mobile.mjs [query]
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, query = 'race=sjoviken'] = process.argv;
const PORT = process.env.PORT || '8803';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${PORT}/index.html?${query}`);
await page.waitForFunction(() => window.KK && ['race', 'title'].includes(window.KK.G.state), null, { timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'tools/out/mobil-0.png' });
// håll höger + skjut en stund
const tap = async (x, y, ms) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(ms); };
await tap(406, 180, 600);
await page.screenshot({ path: 'tools/out/mobil-1.png' });
console.log('läge', await page.evaluate(() => window.KK.G.state + ' skala ' + JSON.stringify([innerWidth, innerHeight, devicePixelRatio])));
if (errors.length) console.log('FEL:\n' + [...new Set(errors)].join('\n'));
await browser.close();
