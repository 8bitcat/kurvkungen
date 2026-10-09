// Följer bilar som ska in i depån: node tools/gpdebug.mjs [bana] [antal bilar]
// Skriver rs (läge mot mållinjen), sida (d·side), fart och depåfas runt infarten.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, track = 'kungsringen', nCars = '4'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:8803/index.html?gp=${track}&laps=8&auto=1&fast=4`);
await page.waitForFunction(() => window.KK && window.KK.G.state === 'race', null, { timeout: 90000 });
// sätt BOX på några bilar så fort loppet gått en stund
await page.waitForFunction(() => window.KK.G.race.raceTime > 30, null, { timeout: 120000 });
await page.evaluate(() => {
  const R = window.KK.G.race;
  window.dbg = [];
  const pass = new Map();
  const tick = R.tick.bind(R);
  R.tick = (dt) => {
    tick(dt);
    const T = R.T, P = T.pit;
    for (const c of R.cars) {
      let rs = ((c.s % T.L) + T.L) % T.L; if (rs > T.L / 2) rs -= T.L;
      const inWin = rs > P.s0 - 240 && rs < P.s0 + P.ramp;
      let p = pass.get(c);
      if (inWin && c.boxing && !p) { p = { code: c.code, t: R.raceTime.toFixed(1), d0: +(c.d * P.side).toFixed(0), v0: Math.round(c.speed), maxd: -99, entered: false, at: null }; pass.set(c, p); }
      if (p) {
        if (rs > P.s0 + 20) p.maxd = Math.max(p.maxd, +(c.d * P.side).toFixed(0));
        if (c.pitPhase && !p.entered) { p.entered = true; p.at = Math.round(rs); }
        if (!inWin) { p.vEnd = Math.round(c.speed); window.dbg.push(p); pass.delete(c); }
      }
    }
  };
});
await page.waitForTimeout(60000);
const d = await page.evaluate(() => window.dbg);
for (const p of d) console.log(`${p.code} t${p.t} start d${p.d0} v${p.v0} → max d ${p.maxd} ${p.entered ? 'IN vid ' + p.at : 'MISSADE'} slutfart ${p.vEnd}`);
if (errors.length) console.log('FEL', errors);
await browser.close();
