// Grand Prix online med två webbläsare via riktiga PeerJS-servern: node tools/mpgp.mjs
// Värden skapar ett GP-rum, gästen väljer stall i rummet, båda kör, gästen boxar, resultatet når båda.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.PORT || '8803';
const BASE = process.env.BASE || `http://localhost:${PORT}/index.html`;
const browser = await chromium.launch();
const mk = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${name}: ${e.message}\n${(e.stack || '').split('\n').slice(0, 3).join('\n')}`));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(`${name}: ${m.text()}`); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.KK && window.KK.G.state === 'title', null, { timeout: 60000 });
  return page;
};
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) process.exitCode = 1; };
const A = await mk('värd'), B = await mk('gäst');
await A.evaluate(() => window.KK.hostRoom());
await A.waitForFunction(() => window.KK.NET.code && window.KK.G.state === 'lobby', null, { timeout: 30000 });
const code = await A.evaluate(() => window.KK.NET.code);
console.log('rumskod', code);
// värden byter läge till Grand Prix med menyn (LÄGE är första raden)
await A.keyboard.press('ArrowRight'); await A.waitForTimeout(200);
await A.evaluate(() => { const L = window.KK.NET.lobby; L.gpLaps = 3; L.gpAi = 5; });
await B.evaluate((c) => window.KK.joinRoom(c), code);
await A.waitForFunction(() => window.KK.NET.players.length === 2, null, { timeout: 30000 });
await B.waitForFunction(() => window.KK.NET.lobbyInfo && window.KK.NET.lobbyInfo.mode === 'gp', null, { timeout: 15000 });
await B.waitForTimeout(400);
// gästen bläddrar fram nästa stall i rummet (DITT STALL är första raden)
const before = await B.evaluate(() => window.KK.save.gp.team);
await B.keyboard.press('ArrowRight'); await B.waitForTimeout(800);
const guestTeam = await A.evaluate(() => window.KK.NET.players[1].cfg.gp.team);
ok(guestTeam !== before, `gästen bytte stall i rummet (${before} → ${guestTeam})`);
await B.screenshot({ path: 'tools/out/mpgp-0-rum-gast.png' });
await A.screenshot({ path: 'tools/out/mpgp-0-rum-vard.png' });
await A.evaluate(() => window.KK.hostStart());
await A.waitForFunction(() => window.KK.G.state === 'race', null, { timeout: 60000 });
await B.waitForFunction(() => window.KK.G.state === 'race', null, { timeout: 60000 });
const info = await B.evaluate(() => { const R = window.KK.G.race; return { f1: !!R.f1, n: R.cars.length, me: R.player.name, team: R.player.team }; });
ok(info.f1 && info.n === 7, `gästen kör Grand Prix med ${info.n} bilar som ${info.me} (${info.team})`);
await B.waitForFunction(() => window.KK.G.race.lights >= 3, null, { timeout: 30000 });
ok(true, 'startljusen tänds hos gästen');
await B.screenshot({ path: 'tools/out/mpgp-1-ljus-gast.png' });
await A.waitForFunction(() => window.KK.G.race.phase === 'race' && window.KK.G.race.raceTime > 1, null, { timeout: 30000 });
// flytta gästens bil till rakan före depåinfarten (värden styr fysiken), gästen gasar och trycker B
await A.evaluate(async () => {
  const { idxAt } = await import('./js/trackgeo.js?v=1');
  const R = window.KK.G.race, T = R.T, c = R.cars[window.KK.NET.pidCar[1]] || R.cars.find((x) => x.human), s = T.L + T.pit.s0 - 300;
  c.placeAt(T, idxAt(T, s), -T.pit.side * 8); c.track(R, R.q); c.progress = s - T.L;
});
await B.keyboard.down('ArrowUp');
await B.waitForTimeout(300);
await B.keyboard.press('KeyB');
await A.waitForFunction(() => { const R = window.KK.G.race; return R.cars.find((x) => x.human).boxing; }, null, { timeout: 5000 }).then(() => ok(true, 'B från gästen når värden (BOX)'), () => ok(false, 'B från gästen når värden'));
await B.waitForTimeout(500);
await B.screenshot({ path: 'tools/out/mpgp-2-box-gast.png' });
await A.waitForFunction(() => window.KK.G.race.cars.find((x) => x.human).pitPhase === 'stop', null, { timeout: 30000 }).then(() => ok(true, 'gästens bil står i depårutan'), () => ok(false, 'gästens bil kom till depårutan'));
await B.waitForFunction(() => window.KK.G.race.player.pitPhase === 'stop' && window.KK.G.race.player.pitWork, null, { timeout: 5000 }).then(() => ok(true, 'gästen ser sitt eget depåstopp med stopptid'), () => ok(false, 'gästen ser depåstoppet'));
await B.screenshot({ path: 'tools/out/mpgp-3-depa-gast.png' });
await A.waitForFunction(() => window.KK.G.race.cars.find((x) => x.human).stops > 0, null, { timeout: 15000 });
await B.waitForFunction(() => window.KK.G.race.player.stops > 0, null, { timeout: 5000 }).catch(() => {});
const tyre = await B.evaluate(() => { const P = window.KK.G.race.player; return { c: P.tyre.c, stops: P.stops }; });
ok(tyre.stops === 1, `gästen fick nya däck (${tyre.c}, ${tyre.stops} stopp)`);
await B.keyboard.up('ArrowUp');
// avsluta loppet: alla får mållinjetider
await A.evaluate(() => { const R = window.KK.G.race; R.phase = 'finish'; R.endT = 100; });
await A.waitForFunction(() => window.KK.G.state === 'results', null, { timeout: 20000 });
await B.waitForFunction(() => window.KK.G.state === 'results', null, { timeout: 20000 });
const rb = await B.evaluate(() => { const r = window.KK.G.results; return { gp: !!r.gpRace, rows: r.rows.length, me: r.rows.filter((x) => x.me).map((x) => x.name), place: r.place }; });
ok(rb.gp && rb.rows === 7 && rb.me[0] === 'DU', `gästen får GP-resultatet (${rb.rows} rader, plats ${rb.place})`);
await B.screenshot({ path: 'tools/out/mpgp-4-resultat-gast.png' });
await A.keyboard.press('Enter'); await B.keyboard.press('Enter');
await A.waitForTimeout(800);
const st = await Promise.all([A.evaluate(() => window.KK.G.state), B.evaluate(() => window.KK.G.state)]);
ok(st[0] === 'lobby' && st[1] === 'lobby', `båda tillbaka i rummet (${st.join(', ')})`);
const errs = [...A.errors, ...B.errors];
if (errs.length) { console.log('FEL:\n' + [...new Set(errs)].join('\n')); process.exitCode = 1; }
await browser.close();
