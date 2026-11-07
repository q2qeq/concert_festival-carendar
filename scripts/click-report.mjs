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

const res = await fetch(`${base}/api/click-report?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`조회 실패: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const rows = (await res.json()).rows.map(([day, kind, event, host, n]) => ({ day, kind, event, host, n }));

const sum = (key) => {
  const m = new Map();
  for (const r of rows) m.set(r[key] || '(공연 페이지 밖)', (m.get(r[key] || '(공연 페이지 밖)') ?? 0) + r.n);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const total = rows.reduce((a, r) => a + r.n, 0);
console.log(`최근 ${days}일 외부 링크 클릭 ${total}회\n`);
for (const [title, key, limit] of [['링크 종류', 'kind', 20], ['목적지 호스트', 'host', 15], ['공연별 상위', 'event', 20], ['날짜별', 'day', days]]) {
  console.log(`[${title}]`);
  sum(key).slice(0, limit).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
  console.log();
}
