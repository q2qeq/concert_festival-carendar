// 외부 링크 클릭 집계 리포트 (api/click.js가 쌓은 Redis 카운터를 읽는다).
//   npm run clicks:report            # 최근 14일
//   npm run clicks:report -- 30      # 최근 30일
// 사이트의 /api/click-report 를 토큰으로 호출한다(REDIS_URL은 비공개 값이라 로컬에서 직접 못 읽는다).
// 토큰: 환경변수 또는 .env.local 의 CLICK_REPORT_TOKEN. 주소 바꾸려면 CLICK_REPORT_URL.
import { readFileSync, existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const days = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 14;
const token = process.env.CLICK_REPORT_TOKEN;
const base = process.env.CLICK_REPORT_URL || 'https://jikgwannyang.com';
if (!token) {
  console.error('CLICK_REPORT_TOKEN이 없습니다. .env.local 에 CLICK_REPORT_TOKEN=... 을 넣으세요.');
  process.exit(1);
}

// 주간 비교에 15일(오늘 + 7일 + 직전 7일)이 필요해서 요청한 기간보다 짧아도 15일은 받는다.
const res = await fetch(`${base}/api/click-report?days=${Math.max(days, 15)}`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`조회 실패: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const fetched = (await res.json()).rows.map(([day, kind, event, host, n]) => ({ day, kind, event, host, n }));
// push:on은 링크 클릭이 아니라 '알림 켜기'다(host 칸 = 켠 화면). 따로 보여 주고 클릭 합계에서는 뺀다.
const alertRows = fetched.filter((r) => r.kind === 'push:on');
const allRows = fetched.filter((r) => r.kind !== 'push:on');
const kstDay = (offset) => new Date(Date.now() + 9 * 3600000 - offset * 86400000).toISOString().slice(0, 10);
const rows = allRows.filter((r) => r.day > kstDay(days));

const sum = (key) => {
  const m = new Map();
  for (const r of rows) m.set(r[key] || '(공연 페이지 밖)', (m.get(r[key] || '(공연 페이지 밖)') ?? 0) + r.n);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const total = rows.reduce((a, r) => a + r.n, 0);
console.log(`최근 ${days}일 외부 링크 클릭 ${total}회\n`);

// 성과 기준: 공연 페이지에서 나간 예매 클릭. 오늘은 하루가 안 끝났으니 어제까지 7일로 비교한다.
const isTicket = (r) => r.kind.startsWith('ticket');
const isShuttle = (r) => r.kind === 'shuttle' || r.host.includes('shuttle');
const count = (list) => list.reduce((a, r) => a + r.n, 0);
const between = (from, to) => allRows.filter((r) => r.day >= kstDay(from) && r.day <= kstDay(to) && isTicket(r) && r.event);
const thisWeek = count(between(7, 1));
const lastWeek = count(between(14, 8));
const change = lastWeek > 0 ? `${thisWeek >= lastWeek ? '+' : ''}${Math.round(((thisWeek - lastWeek) / lastWeek) * 100)}%` : '비교 불가';
console.log('[성과 기준: 공연 페이지 예매 클릭]');
console.log(`  ${kstDay(7)} ~ ${kstDay(1)}  ${thisWeek}회`);
console.log(`  ${kstDay(14)} ~ ${kstDay(8)}  ${lastWeek}회 (변화 ${change})`);
console.log('  공연 상세 방문자 100명당 예매 클릭 = 예매 클릭 / Vercel route /events/[id] 방문자 x 100\n');

const byEvent = new Map();
for (const r of rows.filter((x) => x.event)) {
  const x = byEvent.get(r.event) ?? { ticket: 0, shuttle: 0, other: 0 };
  x[isTicket(r) ? 'ticket' : isShuttle(r) ? 'shuttle' : 'other'] += r.n;
  byEvent.set(r.event, x);
}
console.log('[공연별 클릭: 예매 / 셔틀 / 그 밖]');
[...byEvent.entries()]
  .sort((a, b) => b[1].ticket - a[1].ticket || b[1].shuttle + b[1].other - a[1].shuttle - a[1].other)
  .slice(0, 20)
  .forEach(([id, x]) => console.log(`  ${String(x.ticket).padStart(4)} / ${String(x.shuttle).padStart(3)} / ${String(x.other).padStart(3)}  ${id}`));
console.log();

{
  const recentAlerts = alertRows.filter((r) => r.day > kstDay(days));
  const total = recentAlerts.reduce((a, r) => a + r.n, 0);
  const bySrc = new Map();
  for (const r of recentAlerts) bySrc.set(r.host, (bySrc.get(r.host) ?? 0) + r.n);
  console.log(`[알림 켜기: 켠 화면별] 최근 ${days}일 ${total}회 (2026-11-21부터 셈. event=공연 페이지, practice-*=연습 페이지)`);
  [...bySrc.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
  console.log();
}

for (const [title, key, limit] of [['링크 종류', 'kind', 20], ['목적지 호스트', 'host', 15], ['공연별 상위', 'event', 20], ['날짜별', 'day', days]]) {
  console.log(`[${title}]`);
  sum(key).slice(0, limit).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
  console.log();
}
