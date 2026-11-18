import { chromium, devices } from 'playwright';
const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage();
await p.goto('http://localhost:4321/alerts/', { waitUntil: 'load' }); await p.waitForTimeout(500);
const shots = p.locator('.shot');
for (const i of [1, 2, 3, 4, 5]) await shots.nth(i).screenshot({ path: `${process.argv[2]}/shot-${i}.png` });
await b.close();
