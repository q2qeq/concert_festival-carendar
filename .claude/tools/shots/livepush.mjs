import { chromium, devices } from 'playwright';
const b = await chromium.launch();
for (const [name, o] of [['iphone-safari', devices['iPhone 14']], ['android', devices['Pixel 7']]]) {
  const c = await b.newContext(o); const p = await c.newPage();
  await p.goto('https://jikgwannyang.com/ticket-open/', { waitUntil: 'load' }); await p.waitForTimeout(2500);
  const btn = p.locator('[data-push-id]').first();
  const visible = await btn.isVisible();
  let after = '';
  if (visible && name === 'iphone-safari') { await btn.click(); await p.waitForURL(/alerts/, { timeout: 10000 }).catch(() => {}); after = p.url(); }
  console.log(name, 'button visible:', visible, after);
  await c.close();
}
await b.close();
