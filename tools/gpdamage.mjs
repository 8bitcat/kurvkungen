// Visar skadorna: spelarens bil tappar framvingen och får punka, kör in i depån.
// node tools/gpdamage.mjs [bana]  → tools/out/skada-*.png
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, track = 'kungsringen'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.goto(`http://localhost:8803/index.html?gp=${track}&laps=5&auto=1&fast=2`);
await page.waitForFunction(() => window.KK && window.KK.G.state === 'race', null, { timeout: 90000 });
await page.waitForFunction(() => window.KK.G.race.raceTime > 12, null, { timeout: 90000 });
// tappa vingen genom en riktig skada och få punka
await page.evaluate(() => { const R = window.KK.G.race, P = R.player; R.f1Damage(P, 20, 'ram', { front: true, side: false }); P.punct = 1; R.events('puncture', P, 'hit'); });
await page.waitForTimeout(250); await page.screenshot({ path: 'tools/out/skada-0.png' });
await page.waitForTimeout(1500); await page.screenshot({ path: 'tools/out/skada-1.png' });
const st = await page.evaluate(() => { const P = window.KK.G.race.player; return { wing: P.wing, lost: P.wingLost, punct: P.punct, boxing: P.boxing, kmh: P.kmh }; });
console.log(JSON.stringify(st));
// vänta på depåstoppet
await page.waitForFunction(() => window.KK.G.race.player.pitPhase === 'stop', null, { timeout: 120000 });
await page.waitForTimeout(400); await page.screenshot({ path: 'tools/out/skada-2-depa.png' });
console.log('stopp', await page.evaluate(() => JSON.stringify(window.KK.G.race.player.pitWork)));
await page.waitForFunction(() => window.KK.G.race.player.pitPhase === 'out', null, { timeout: 60000 });
console.log('efter', await page.evaluate(() => { const P = window.KK.G.race.player; return JSON.stringify({ wing: P.wing, lost: P.wingLost, punct: P.punct, tyre: P.tyre }); }));
await page.waitForTimeout(600); await page.screenshot({ path: 'tools/out/skada-3-ut.png' });
if (errors.length) console.log('FEL:\n' + [...new Set(errors)].join('\n'));
await browser.close();
