import { chromium, devices } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const swiped of [false, true]) {
  const c = await b.newContext({ ...devices['iPhone 14'] });
  if (swiped) await c.addInitScript(() => localStorage.setItem('krconcerts:hero-swiped', '1'));
  const p = await c.newPage();
  await p.goto('http://localhost:4321/', { waitUntil: 'load' });
  let minRot = 0, shot = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 22000) {
    const rot = await p.evaluate(() => { const d = window.__stage?.debug?.(); return d && d.flipAt < 0 ? d.posterRot : null; });
    if (rot !== null && rot < minRot) minRot = rot;
    if (!swiped && !shot && rot !== null && rot < -0.06) { await p.screenshot({ path: `${out}/nudge.png` }); shot = true; }
    await p.waitForTimeout(150);
  }
  console.log(swiped ? '이미 밀어 본 기기' : '처음 방문', '포스터 최소 회전(rad):', minRot.toFixed(3));
  await c.close();
}
await b.close();
