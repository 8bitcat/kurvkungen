// Skärmdump: node tools/shot.mjs <sökväg+query> <utfil> [bredd] [höjd] [väntan ms]
// Väntar tills window.done === true (eller väntetiden). Kräver node tools/serve.mjs (port 8803).
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const [,, path = 'index.html', out = 'tools/out/shot.png', w = '1400', h = '900', wait = '60000'] = process.argv;
const PORT = process.env.PORT || '8803';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); else if (process.env.LOG) console.log('[log]', m.text()); });
await page.goto(`http://localhost:${PORT}/${path}`);
try { await page.waitForFunction(() => window.done === true, null, { timeout: +wait, polling: 200 }); } catch { console.log('(väntade ut tiden)'); }
const info = await page.evaluate(() => document.getElementById('info')?.textContent || '');
if (info) console.log(info);
await page.screenshot({ path: out, fullPage: true });
if (errors.length) console.log('FEL:\n' + errors.join('\n'));
console.log('→ ' + out);
await browser.close();
