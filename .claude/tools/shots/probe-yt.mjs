// 상세 페이지: '가고 싶어요' 위치와 영상 칸이 실제로 무엇을 그리는지 본다
import { chromium, devices } from 'playwright';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch();
for (const [name, o] of [['desktop',{viewport:{width:1440,height:900}}],['mobile',{...devices['iPhone 14']}]]) {
  const c = await b.newContext(o); const p = await c.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(3000);
  const bar = p.locator('.action-bar'); await bar.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  await bar.screenshot({ path: `${out}/${name}-bar.png` });
  const yt = p.locator('.yt-box').first();
  if (await yt.count()) { await yt.scrollIntoViewIfNeeded(); await p.waitForTimeout(6000); await yt.screenshot({ path: `${out}/${name}-yt.png` }); }
  console.log(name, await p.evaluate(() => ({ want: !document.querySelector('.want')?.hidden, iframes: document.querySelectorAll('.yt-frame iframe').length })));
  await c.close();
}
await b.close();
