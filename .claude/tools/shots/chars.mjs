import { chromium, devices } from 'playwright';
const out = process.argv[2]; const base = 'http://localhost:4321';
const b = await chromium.launch();
for (const [dev, o] of [['d', { viewport: { width: 1440, height: 900 } }], ['m', { ...devices['iPhone 14'] }]]) {
  const c = await b.newContext(o); const p = await c.newPage();
  await p.goto(base + '/about/', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/about-${dev}.png` });
  await p.locator('.site-footer').screenshot({ path: `${out}/footer-${dev}.png` });
  await p.goto(base + '/ticket-open/', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/open-${dev}.png` });
  await p.goto(base + '/events/fujii-kaze-2027-01/', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.locator('.character-note').screenshot({ path: `${out}/note-${dev}.png` });
  await p.goto(base + '/', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const app = p.locator('.app'); await app.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
  await app.screenshot({ path: `${out}/app-${dev}.png` });
  await c.close();
}
// 연습 결과 반응
const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
await p.goto(base + '/practice/?stage=seat', { waitUntil: 'load' });
const until = Date.now() + 60000;
while (Date.now() < until && !(await p.locator('#g-result:not([hidden])').count())) { const s = p.locator('.seat.open').first(); if (await s.count()) await s.dispatchEvent('pointerdown', { bubbles: true }); await p.waitForTimeout(250); }
await p.waitForTimeout(800);
await p.locator('#g-result').screenshot({ path: `${out}/practice-result.png` });
await b.close();
