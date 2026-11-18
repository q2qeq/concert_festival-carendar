import { chromium, devices } from 'playwright';
const out = process.argv[2]; const url = 'http://localhost:4321/alerts/';
const iph = devices['iPhone 14'];
const cases = [
  ['ios-safari', iph],
  ['ios-chrome', { ...iph, userAgent: iph.userAgent.replace('Version/', 'CriOS/120.0 Version/') }],
  ['ios-kakao', { ...iph, userAgent: iph.userAgent + ' KAKAOTALK 10.4.0' }],
  ['android', { ...devices['Pixel 7'] }],
  ['desktop', { viewport: { width: 1440, height: 900 } }],
];
const b = await chromium.launch();
for (const [name, o] of cases) {
  const c = await b.newContext(o); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({ shown: [...document.querySelectorAll('[data-now]')].filter((e) => !e.hidden).map((e) => e.dataset.now), safari: document.querySelector('[data-safari]')?.getAttribute('href') }));
  console.log(name, JSON.stringify(r), errs.join('|'));
  await p.screenshot({ path: `${out}/${name}-top.png` });
  if (name === 'ios-safari' || name === 'desktop') await p.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  await c.close();
}
await b.close();
