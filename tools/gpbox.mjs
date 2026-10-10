// Spelaren boxar med tangentbordet (ingen autopilot): B, gasa, följ pilarna in i depån.
// node tools/gpbox.mjs [bana]  → tools/out/box-*.png
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, track = 'kungsringen'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.goto(`http://localhost:8803/index.html?gp=${track}&laps=5`);
await page.waitForFunction(() => window.KK && window.KK.G.state === 'race' && window.KK.G.race.phase === 'race', null, { timeout: 90000 });
// flytta spelaren till rakan före depåinfarten och tryck B
await page.evaluate(async () => {
  const { idxAt } = await import('./js/trackgeo.js?v=1');
  const R = window.KK.G.race, P = R.player, T = R.T, s = T.L + T.pit.s0 - 300;
  P.placeAt(T, idxAt(T, s), -T.pit.side * 8); P.track(R, R.q); P.progress = s - T.L;
});
await page.keyboard.press('KeyB');
await page.keyboard.down('ArrowUp');
const st = () => page.evaluate(() => { const P = window.KK.G.race.player, T = window.KK.G.race.T; let rs = ((P.s % T.L) + T.L) % T.L; if (rs > T.L / 2) rs -= T.L; return { rs: Math.round(rs), d: +(P.d * T.pit.side).toFixed(1), kmh: P.kmh, box: P.boxing, fas: P.pitPhase, stopp: P.stops }; });
await page.waitForTimeout(250); await page.screenshot({ path: 'tools/out/box-0-pilar.png' }); console.log(JSON.stringify(await st()));
await page.waitForTimeout(700); await page.screenshot({ path: 'tools/out/box-1-infart.png' }); console.log(JSON.stringify(await st()));
await page.waitForFunction(() => window.KK.G.race.player.pitPhase === 'stop', null, { timeout: 30000 }).catch(() => console.log('KOM ALDRIG TILL RUTAN'));
await page.waitForTimeout(300); await page.screenshot({ path: 'tools/out/box-2-rutan.png' }); console.log(JSON.stringify(await st()));
await page.waitForFunction(() => window.KK.G.race.player.stops > 0, null, { timeout: 30000 }).catch(() => console.log('STOPPET BLEV ALDRIG KLART'));
await page.waitForTimeout(1500); console.log(JSON.stringify(await st()));
await page.keyboard.up('ArrowUp');
if (errors.length) console.log('FEL:\n' + [...new Set(errors)].join('\n'));
await browser.close();
