import { chromium, devices } from 'playwright';
const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage();
await p.goto('http://localhost:4321/', { waitUntil: 'load' }); await p.waitForTimeout(1500);
const h = p.locator('#fresh-title').locator('xpath=..'); await h.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
await h.screenshot({ path: process.argv[2] + '/fresh-head.png' });
await p.locator('.site-footer .sign').screenshot({ path: process.argv[2] + '/sign.png' });
await b.close();
