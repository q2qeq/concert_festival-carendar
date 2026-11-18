import { chromium, devices } from 'playwright';
const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage();
await p.goto('http://localhost:4321/', { waitUntil: 'load' }); await p.waitForTimeout(1500);
const led = p.locator('.led'); await led.scrollIntoViewIfNeeded();
for (const t of [0, 3300, 6600]) { await p.waitForTimeout(t ? 3300 : 300); await led.screenshot({ path: `${process.argv[2]}/led-${t}.png` }); }
await b.close();
