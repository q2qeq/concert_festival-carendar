// 외부 링크 클릭 집계 리포트 (api/click.js가 쌓은 Redis 카운터를 읽는다).
//   npm run clicks:report            # 최근 14일
//   npm run clicks:report -- 30      # 최근 30일
// 접속 정보: 환경변수 REDIS_URL(또는 UPSTASH_REDIS_REST_URL/TOKEN). 없으면 .env.local 을 읽는다.
//   처음 한 번: `vercel env pull .env.local` (Vercel CLI 로그인 필요)
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from 'redis';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const days = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 14;
if (!process.env.REDIS_URL) {
  console.error('REDIS_URL이 없습니다. `vercel env pull .env.local` 로 받아 오세요.');
  process.exit(1);
}

const client = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 5000, reconnectStrategy: false } });
client.on('error', () => {});
await client.connect();

const rows = [];
for (let i = 0; i < days; i++) {
  const day = new Date(Date.now() + 9 * 3600000 - i * 86400000).toISOString().slice(0, 10);
  const h = await client.hGetAll(`clicks:${day}`);
  for (const [field, n] of Object.entries(h)) {
    const [kind, event, host] = field.split('|');
    rows.push({ day, kind, event, host, n: Number(n) });
  }
}
await client.quit();

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
