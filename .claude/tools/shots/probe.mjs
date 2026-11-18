import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 300)));
await page.goto(process.argv[2]);
for (const t of [1500, 3000]) { await page.waitForTimeout(t); console.log(JSON.stringify(await page.evaluate(() => window.__stage?.debug?.() ?? document.getElementById('hero').className))); }
await browser.close();
