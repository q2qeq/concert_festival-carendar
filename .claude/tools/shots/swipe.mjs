// 휴대폰 첫 화면: 3D 무대가 켜진 뒤 모습, 스와이프로 다음 공연 넘어가는지, 탭·띠 모양
import { chromium, devices } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const c = await b.newContext({ ...devices['iPhone 14'] }); const p = await c.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:4321/', { waitUntil: 'load' });
// 자동 전환을 멈추려고 첫 화면을 보면서 기다린다 (헤드리스는 3D가 느리게 흐른다)
await p.waitForTimeout(14000);
await p.screenshot({ path: `${out}/m-hero.png` });
const before = await p.evaluate(() => ({ idx: document.getElementById('h-idx').textContent, gl: document.getElementById('hero').classList.contains('is-gl'), li: window.__stage?.debug?.().li }));
const cdp = await c.newCDPSession(p);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
await touch('touchStart', 300, 380);
for (let i = 1; i <= 10; i++) { await touch('touchMove', 300 - i * 20, 382); await p.waitForTimeout(30); }
await p.screenshot({ path: `${out}/m-drag.png` });
await touch('touchEnd', 100, 382);
await p.waitForTimeout(6000);
const after = await p.evaluate(() => ({ idx: document.getElementById('h-idx').textContent, url: location.pathname }));
await p.screenshot({ path: `${out}/m-after.png` });
await p.evaluate(() => window.scrollTo(0, document.querySelector('.led').getBoundingClientRect().top + scrollY - 300));
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/m-below.png` });
console.log(JSON.stringify({ before, after }), errs.join('|'));
await b.close();
