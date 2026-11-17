// 티켓오픈 푸시 발송(/api/push-send)을 5분마다 깨우는 Upstash QStash 일정을 만들거나 고친다.
//   npm run push:schedule            일정 만들기(같은 id로 다시 실행하면 덮어쓴다)
//   npm run push:schedule -- --list  등록된 일정과 마지막 호출 상태 보기
// 필요한 값: QSTASH_TOKEN (환경변수나 .env.local). 리전이 다르면 QSTASH_URL도.
// 호출 인증은 QStash 서명으로 한다 - 함수 쪽에 QSTASH_CURRENT_SIGNING_KEY·QSTASH_NEXT_SIGNING_KEY가 있어야 한다.
// 그래서 일정에는 비밀 값을 싣지 않는다.
import { readFileSync } from 'node:fs';

function envFile() {
  try {
    return Object.fromEntries(
      readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
        .split('\n')
        .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
        .filter(Boolean)
        .map(([, k, v]) => [k, v.replace(/^"|"$/g, '')]),
    );
  } catch {
    return {};
  }
}
const local = envFile();
const TOKEN = process.env.QSTASH_TOKEN || local.QSTASH_TOKEN;
const BASE = (process.env.QSTASH_URL || local.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/$/, '');
const DEST = 'https://jikgwannyang.com/api/push-send';
const ID = 'krconcerts-push-send';
const CRON = '*/5 * * * *';

if (!TOKEN) {
  console.error('QSTASH_TOKEN이 없어요. Upstash 콘솔 > QStash에서 토큰을 .env.local에 넣어 주세요.');
  process.exit(1);
}
const auth = { Authorization: `Bearer ${TOKEN}` };

if (process.argv.includes('--list')) {
  const r = await fetch(`${BASE}/v2/schedules`, { headers: auth });
  const list = await r.json();
  if (!r.ok) { console.error(r.status, list); process.exit(1); }
  for (const s of list) {
    const last = s.lastScheduleTime ? new Date(s.lastScheduleTime).toISOString() : '-';
    console.log(`${s.scheduleId}  ${s.cron}  ${s.method ?? 'POST'} ${s.destination}  마지막 ${last}  상태 ${s.lastScheduleStates ? JSON.stringify(s.lastScheduleStates) : '-'}${s.isPaused ? '  (멈춤)' : ''}`);
  }
  process.exit(0);
}

const r = await fetch(`${BASE}/v2/schedules/${DEST}`, {
  method: 'POST',
  headers: {
    ...auth,
    'Upstash-Cron': CRON,
    'Upstash-Schedule-Id': ID,
    'Upstash-Method': 'POST',
    // 실패해도 다음 5분 호출이 곧 오니 재시도는 한 번만
    'Upstash-Retries': '1',
    'Upstash-Timeout': '60s',
  },
});
const out = await r.text();
if (!r.ok) { console.error(r.status, out); process.exit(1); }
console.log(`일정 등록: ${ID} (${CRON}) -> ${DEST}`, out);
