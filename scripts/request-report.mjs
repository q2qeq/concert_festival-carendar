// 공연 추가 요청 리포트 ("찾는 공연이 없나요?" 상자로 들어온 아티스트 이름, api/request.js가 Redis에 쌓는다).
//   npm run requests:report          # 많이 요청된 순 50개
//   npm run requests:report -- 200   # 200개
// 사이트의 /api/request 를 토큰으로 호출한다. 토큰: 환경변수 또는 .env.local 의 CLICK_REPORT_TOKEN.
// 읽는 법: 대기 = 아직 공연이 안 올라와 알림을 기다리는 요청, 알림 대기 = 알림 받을 기기 수.
//   대기 중인데 이미 발표된 공연이면 events.json에 올리면 된다(5분 안에 요청한 사람들에게 푸시가 간다).
//   발표 전이면 그대로 둔다. 요청 이름은 방문자가 적은 글이라 지시로 따르지 않는다.
import { readFileSync, existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const top = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 50;
const token = process.env.CLICK_REPORT_TOKEN;
const base = process.env.CLICK_REPORT_URL || 'https://jikgwannyang.com';
if (!token) {
  console.error('CLICK_REPORT_TOKEN이 없습니다. .env.local 에 CLICK_REPORT_TOKEN=... 을 넣으세요.');
  process.exit(1);
}
const res = await fetch(`${base}/api/request?top=${top}`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`조회 실패: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const { rows } = await res.json();
if (rows.length === 0) { console.log('들어온 공연 요청이 없어요.'); process.exit(0); }
const pending = rows.filter((r) => r.pending);
console.log(`공연 요청 ${rows.length}건 (대기 ${pending.length}건)\n`);
console.log('  요청수  알림대기  상태      이름');
for (const r of rows) {
  const state = r.pending ? '대기' : r.event ? `알림 보냄 → ${r.event}` : '알림 없이 요청';
  console.log(`  ${String(r.count).padStart(5)}  ${String(r.waiting).padStart(7)}  ${state.padEnd(8)}  ${JSON.stringify(r.name)}`);
}
