// Multiplayertest med två webbläsare via riktiga PeerJS-servern: node tools/mp.mjs [sekunder]
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, secs = '15'] = process.argv;
const PORT = process.env.PORT || '8803';
const browser = await chromium.launch();
const mk = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${name}: ${e.message}\n${(e.stack || '').split('\n').slice(0, 3).join('\n')}`));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(`${name}: ${m.text()}`); });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.KK && window.KK.G.state === 'title', null, { timeout: 60000 });
  return page;
};
const A = await mk('värd'), B = await mk('gäst');
await A.evaluate(() => window.KK.hostRoom());
await A.waitForFunction(() => window.KK.NET.code && window.KK.G.state === 'lobby', null, { timeout: 30000 });
const code = await A.evaluate(() => window.KK.NET.code);
console.log('rumskod', code);
await B.evaluate((c) => window.KK.joinRoom(c), code);
await A.waitForFunction(() => window.KK.NET.players.length === 2, null, { timeout: 30000 });
console.log('gästen är med i lobbyn');
await B.screenshot({ path: 'tools/out/mp-lobby-gast.png' });
await A.evaluate(() => { window.KK.NET.lobby.ai = 2; window.KK.hostStart(); });
await A.waitForFunction(() => window.KK.G.state === 'race', null, { timeout: 60000 });
await B.waitForFunction(() => window.KK.G.state === 'race', null, { timeout: 60000 });
console.log('båda kör');
await A.keyboard.down('ArrowUp'); await B.keyboard.down('ArrowUp');
const stat = async () => {
  const a = await A.evaluate(() => { const R = window.KK.G.race; return { ph: R.phase, t: +R.raceTime.toFixed(1), cars: R.cars.map((c) => `${c.name}${c.human ? '(gäst)' : c.isPlayer ? '(värd)' : ''}@${c.x | 0},${c.y | 0}`) }; });
  const b = await B.evaluate(() => { const R = window.KK.G.race; return { ph: R.phase, t: +R.raceTime.toFixed(1), me: R.player && `${R.player.name}@${R.player.x | 0},${R.player.y | 0}`, buf: window.KK.NET.mirror ? window.KK.NET.mirror.buf.length : -1 }; });
  console.log('värd', JSON.stringify(a)); console.log('gäst', JSON.stringify(b));
};
for (let k = 0; k < 3; k++) {
  await A.waitForTimeout(+secs * 1000 / 3);
  // gästen svänger lite så vi ser att hans styrning går fram
  await B.keyboard.down(k % 2 ? 'ArrowLeft' : 'ArrowRight'); await B.waitForTimeout(250); await B.keyboard.up(k % 2 ? 'ArrowLeft' : 'ArrowRight');
  await stat();
}
await A.screenshot({ path: 'tools/out/mp-vard.png' });
await B.screenshot({ path: 'tools/out/mp-gast.png' });
const errs = [...A.errors, ...B.errors];
if (errs.length) console.log('FEL:\n' + [...new Set(errs)].join('\n'));
await browser.close();
