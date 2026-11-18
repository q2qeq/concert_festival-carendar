// 화면 캡처 도구. 데스크톱·모바일 크기로 페이지를 열어 시간 순서대로 여러 장을 찍는다.
// 애니메이션이 제대로 흘러가는지(등장 → 정지 상태 → 전환) 눈으로 확인하려고 만든 것.
//   node shots.mjs <url> [출력폴더] [--times=500,2500,5000,9000] [--full]
// 저장소에 포함되지 않는 로컬 도구다(.claude/tools).
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:/.test(a));
if (!url) { console.error('사용법: node shots.mjs <url> [출력폴더] [--times=ms,ms] [--full]'); process.exit(1); }
const out = args.find((a) => !a.startsWith('--') && a !== url) ?? path.join(process.cwd(), 'out');
const times = (args.find((a) => a.startsWith('--times='))?.slice(8) ?? '500,2500,5000,9000').split(',').map(Number);
const full = args.includes('--full');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const targets = [
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['mobile', { ...devices['iPhone 14'] }],
];
for (const [name, opts] of targets) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  for (const t of times) {
    const wait = t - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    const file = path.join(out, `${name}-${String(t).padStart(5, '0')}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  if (full) {
    // 스크롤로 나타나는 구역을 모두 깨운 뒤 전체 페이지를 찍는다
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
    const file = path.join(out, `${name}-full.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  if (errors.length) console.log(`[${name}] 페이지 오류:`, errors.slice(0, 5).join(' | '));
  await ctx.close();
}
await browser.close();
