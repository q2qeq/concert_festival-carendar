// 공연 상세 셀프 점검: 휴대폰 화면에서 방문자가 막히는 지점을 숫자로 잡고 첫 화면을 캡처한다.
//   node .claude/tools/shots/event-review.mjs <사이트 주소> <출력 폴더> <공연 id> [공연 id ...]
// 기준과 절차는 docs/event-page-review.md. 문제가 하나라도 있으면 종료 코드 1.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const [base, out, ...ids] = process.argv.slice(2);
if (!base || !out || ids.length === 0) {
  console.error('사용법: node event-review.mjs <사이트 주소> <출력 폴더> <공연 id> [공연 id ...]');
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 14'] });
let failed = 0;

for (const id of ids) {
  const page = await context.newPage();
  const res = await page.goto(`${base.replace(/\/$/, '')}/events/${id}/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2000);
  const m = await page.evaluate(() => {
    const vh = innerHeight;
    const shown = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.height > 0 && getComputedStyle(el).display !== 'none';
    };
    const inFirstScreen = (el) => {
      if (!shown(el)) return false;
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= vh;
    };
    const dday = document.querySelector('.dday-badge.big');
    const size = dday ? parseFloat(getComputedStyle(dday).fontSize) : 0;
    const primary = document.querySelector('.action-bar .ab-primary');
    const sticky = document.querySelector('#m-cta');
    const poster = document.querySelector('img.poster');
    const priceEl = document.querySelector('#price');
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      ddayText: dday?.textContent.trim() ?? '',
      ddayOneLine: !dday || dday.getBoundingClientRect().height <= size * 1.4,
      hasAction: Boolean(primary || sticky),
      actionVisible: inFirstScreen(primary) || shown(sticky),
      posterOk: !poster || (poster.complete && poster.naturalWidth > 0),
      smallTaps: [...document.querySelectorAll('.action-bar .ab-main .ab-btn')].filter((el) => shown(el) && el.getBoundingClientRect().height < 44).length,
      priceScreens: priceEl ? Math.round(((priceEl.getBoundingClientRect().top + scrollY) / vh) * 10) / 10 : null,
      screens: Math.round((document.documentElement.scrollHeight / vh) * 10) / 10,
    };
  });
  await page.screenshot({ path: `${out}/${id}.png` });
  await page.close();

  const problems = [];
  if (!res?.ok()) problems.push(`응답 ${res?.status()}`);
  if (m.overflow) problems.push('가로로 넘침');
  if (!m.ddayOneLine) problems.push(`D-day가 두 줄(${m.ddayText})`);
  if (m.hasAction && !m.actionVisible) problems.push('첫 화면에 예매 버튼 없음');
  if (!m.posterOk) problems.push('포스터 깨짐');
  if (m.smallTaps > 0) problems.push(`누르기 작은 버튼 ${m.smallTaps}개`);
  if (problems.length > 0) failed += 1;

  const price = m.priceScreens === null ? '가격 없음' : `가격 ${m.priceScreens}화면째`;
  console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${id}  (${price}, 전체 ${m.screens}화면)${problems.length ? `  ${problems.join(' / ')}` : ''}`);
}

await browser.close();
process.exit(failed > 0 ? 1 : 0);
