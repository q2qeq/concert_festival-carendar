// 티켓오픈 알림 구독 리포트 - 알림을 켠 기기 수와 공연별 신청 수(api/push.js가 Redis에 쌓는다).
//   npm run push:report
// 사이트의 /api/push?report 를 토큰으로 호출한다. 토큰: 환경변수 또는 .env.local 의 CLICK_REPORT_TOKEN.
// 읽는 법: 기기 수는 사람 수가 아니다(한 사람이 폰·PC 둘 다 켜면 2). apple = 아이폰·아이패드·맥 사파리.
//   홈 화면에 추가만 하고 알림을 안 켠 사람은 여기 안 잡힌다.
import { readFileSync, existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const token = process.env.CLICK_REPORT_TOKEN;
const base = process.env.CLICK_REPORT_URL || 'https://jikgwannyang.com';
if (!token) {
  console.error('CLICK_REPORT_TOKEN이 없습니다. .env.local 에 CLICK_REPORT_TOKEN=... 을 넣으세요.');
  process.exit(1);
}
const res = await fetch(`${base}/api/push?report`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`조회 실패: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const r = await res.json();
const events = new Map(JSON.parse(readFileSync('src/data/events.json', 'utf8')).map((e) => [e.id, e]));
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

const plat = Object.entries(r.platforms).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '-';
console.log(`알림을 켠 기기 ${r.devices}대 (공연 알림 켠 기기 ${r.withEvents}대, 나머지는 공연 요청 알림만)`);
console.log(`브라우저: ${plat}\n`);
if (r.events.length === 0) { console.log('알림을 켠 공연이 없어요.'); process.exit(0); }
console.log('  기기  상태  공연');
for (const e of r.events) {
  const ev = events.get(e.id);
  const end = ev?.endDate || ev?.startDate;
  const state = !ev ? '없음' : end && end < today ? '지남' : '예정';
  const name = ev ? `${ev.artist} (${ev.startDate}, ${ev.venue})` : e.id;
  console.log(`  ${String(e.subs).padStart(4)}  ${state}  ${name}`);
}
