// 단계 연습을 자동으로 끝까지 플레이해 결과 화면을 확인한다
import { chromium, devices } from 'playwright';
const out = process.argv[2]; const base = 'http://localhost:4321/practice/';
const b = await chromium.launch();
async function run(stage, dev) {
  const c = await b.newContext(dev === 'mobile' ? { ...devices['iPhone 14'] } : { viewport: { width: 1440, height: 900 } });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + '?stage=' + stage, { waitUntil: 'load' });
  const until = Date.now() + 90000;
  while (Date.now() < until) {
    if (await p.locator('#g-result:not([hidden])').count()) break;
    if (stage === 'btn') { const o = p.locator('.book.is-open'); if (await o.count()) await o.dispatchEvent('pointerdown'); }
    if (stage === 'zone') {
      const t = (await p.locator('#zone-target b').textContent().catch(() => '')) || '';
      const z = p.locator('.zone', { hasText: t }).first();
      if (t && await z.count()) await z.dispatchEvent('pointerdown', { bubbles: true });
    }
    if (stage === 'seat') { const s = p.locator('.seat.open').first(); if (await s.count()) await s.dispatchEvent('pointerdown', { bubbles: true }); }
    await p.waitForTimeout(stage === 'btn' ? 30 : 250);
  }
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => ({ url: location.search, grade: document.getElementById('g-grade').textContent, detail: document.getElementById('g-detail').textContent, retry: document.getElementById('g-retry').textContent, full: !document.getElementById('g-full').hidden, best: localStorage.getItem('krconcerts:practice-best:' + new URLSearchParams(location.search).get('stage')) }));
  console.log(stage, dev, JSON.stringify(r), errs.join('|'));
  await p.screenshot({ path: `${out}/${stage}-${dev}.png` });
  // 단계 고르기로 돌아가 시작 화면 확인
  await p.click('#g-menu'); await p.waitForTimeout(800);
  await p.locator('#start-screen').screenshot({ path: `${out}/start-${dev}.png` });
  await c.close();
}
await Promise.all([run('btn', 'desktop'), run('zone', 'desktop'), run('seat', 'mobile')]);
await b.close();
