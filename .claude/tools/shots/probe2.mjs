import { chromium, devices } from 'playwright';
const out = process.argv[2]; const base = 'http://localhost:4321';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
// 1) /my 빈 상태
await p.goto(base + '/my/', { waitUntil: 'load' }); await p.waitForTimeout(1500);
console.log('my empty:', await p.evaluate(() => ({ alertVisible: getComputedStyle(document.getElementById('my-alert')).display !== 'none', emptyVisible: getComputedStyle(document.getElementById('my-empty')).display !== 'none' })));
// 2) 찜 하나 있는 상태
const id = 'fujii-kaze-2027-01';
await p.evaluate((id) => { for (const k of Object.keys(localStorage)) if (/bookmark/i.test(k)) localStorage.setItem(k, JSON.stringify([id])); }, id);
const keys = await p.evaluate(() => Object.keys(localStorage)); console.log('keys', keys);
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
console.log('my with 1:', await p.evaluate(() => ({ alertVisible: getComputedStyle(document.getElementById('my-alert')).display !== 'none', emptyVisible: getComputedStyle(document.getElementById('my-empty')).display !== 'none' })));
// 3) 상세: 목차·발표 대기·영상 썸네일
await p.goto(base + '/events/' + id + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
await p.screenshot({ path: out + '/detail-top.png' });
await p.locator('.announce-watch').screenshot({ path: out + '/announce.png' });
await p.evaluate(() => { document.querySelectorAll('.yt-frame iframe').forEach((f) => f.remove()); });
await p.locator('.yt-frame').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
await p.locator('.yt-frame').first().screenshot({ path: out + '/yt-placeholder.png' });
await b.close();
