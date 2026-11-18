// 긴 페이지용: 스크롤하며 뷰포트 단위로 N장 찍는다. node clip.mjs <url> <out> [장수]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
const [url, out, n = '4'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [name, o] of [['desktop',{viewport:{width:1440,height:900}}],['mobile',{...devices['iPhone 14']}]]) {
  const c = await b.newContext(o); const p = await c.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(4000);
  const h = o.viewport.height;
  for (let i = 0; i < +n; i++) { await p.evaluate(y => window.scrollTo(0, y), i * h); await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/${name}-s${i}.png`, timeout: 60000 }); }
  await c.close();
}
await b.close();
