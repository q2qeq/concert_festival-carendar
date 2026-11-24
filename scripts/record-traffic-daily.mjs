// 일별 방문자·유입원을 src/data/traffic-daily.csv 에 쌓는다(성장 곡선용).
//   VERCEL_TOKEN=... node scripts/record-traffic-daily.mjs
//
// Vercel Hobby 플랜은 Analytics를 최근 31일만 보여 줘서, 지난 숫자는 이 CSV에만 남는다.
// 매일 GitHub Action(.github/workflows/traffic-daily.yml)이 돌리고, 직접 돌려도 된다.
//
// - 날짜는 Vercel의 UTC 일 경계(KST 오전 9시)를 그대로 쓴다. 하루가 끝난 날(어제까지)만 넣는다.
// - 마지막 줄 다음 날부터 어제까지 비어 있는 날을 한 번에 채운다. 며칠 빠져도 다음 실행이 메운다.
//   단 Vercel이 31일치만 주므로 그보다 오래 빠진 날은 못 채운다(빈 채로 둔다).
// - 열: date,visitors,pageviews,naver,google,other (other = 전체 - 네이버 - 구글, 곧 직접·기타)
// - 환경변수: VERCEL_TOKEN(필수, 읽기 권한이면 된다). VERCEL_TEAM_ID·VERCEL_PROJECT_ID는 기본값이 있다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CSV = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'traffic-daily.csv');
const HEADER = 'date,visitors,pageviews,naver,google,other';
const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID || 'team_qHlwZT4tZiKEmOEeMZnVMGmJ';
const projectId = process.env.VERCEL_PROJECT_ID || 'prj_cqYtIXOTPbIKWy1GWgE2e8yE1JUN';
const base = process.env.VERCEL_API_BASE || 'https://api.vercel.com';
if (!token) {
  console.error('VERCEL_TOKEN이 없습니다.');
  process.exit(1);
}

const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86400000;
const todayUtc = dayStr(Date.now());
const yesterday = dayStr(Date.parse(todayUtc) - DAY);

const lines = existsSync(CSV) ? readFileSync(CSV, 'utf8').split('\n').filter((l) => l.trim()) : [HEADER];
const rows = lines.slice(1).map((l) => l.split(','));
const have = new Set(rows.map((r) => r[0]));
const last = rows.map((r) => r[0]).sort().pop();

// 채울 구간: 마지막 날 다음날 ~ 어제. 31일 보관 제한 때문에 30일 전까지만 요청한다.
const earliest = dayStr(Date.parse(todayUtc) - 30 * DAY);
let from = last ? dayStr(Date.parse(last) + DAY) : earliest;
if (from < earliest) from = earliest;
if (from > yesterday) {
  // 채울 날이 없어도 토큰·접근 권한이 살아 있는지 가볍게 한 번 확인한다(만료·권한 오류를 조용히 지나치지 않으려고).
  const probe = await fetch(
    `${base}/v1/query/web-analytics/visits/count?${new URLSearchParams({ teamId, projectId, since: `${yesterday}T00:00:00.000Z`, until: `${yesterday}T23:59:59.000Z` })}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!probe.ok) {
    console.error(`Vercel 접근 확인 실패: HTTP ${probe.status} ${(await probe.text()).slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`채울 날이 없어요(마지막 ${last}, 어제 ${yesterday}). Vercel 접근은 정상입니다.`);
  process.exit(0);
}

async function perDay(filter) {
  const qs = new URLSearchParams({
    teamId,
    projectId,
    by: 'day',
    since: `${from}T00:00:00.000Z`,
    until: `${yesterday}T23:59:59.000Z`,
    limit: '100',
  });
  if (filter) qs.set('filter', filter);
  const res = await fetch(`${base}/v1/query/web-analytics/visits/aggregate?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`Vercel 조회 실패: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const body = await res.json();
  const out = new Map();
  for (const d of body.data ?? []) out.set(String(d.timestamp).slice(0, 10), d);
  return out;
}

const all = await perDay('');
const naver = await perDay("referrerHostname in ('m.search.naver.com','search.naver.com')");
const google = await perDay("referrerHostname eq 'google.com'");

let added = 0;
for (let ms = Date.parse(from); ms <= Date.parse(yesterday); ms += DAY) {
  const day = dayStr(ms);
  if (have.has(day)) continue;
  const t = all.get(day);
  if (!t) {
    console.warn(`${day}: 전체 방문 기록이 없어 건너뜀(조회 가능 기간 밖이거나 데이터 없음)`);
    continue;
  }
  const n = naver.get(day)?.visitors ?? 0;
  const g = google.get(day)?.visitors ?? 0;
  rows.push([day, t.visitors, t.pageviews, n, g, Math.max(t.visitors - n - g, 0)].map(String));
  added++;
}

rows.sort((a, b) => a[0].localeCompare(b[0]));
writeFileSync(CSV, [HEADER, ...rows.map((r) => r.join(','))].join('\n') + '\n');
console.log(`${added}일 추가(${from} ~ ${yesterday}). 마지막 줄: ${rows.at(-1)?.join(',')}`);
