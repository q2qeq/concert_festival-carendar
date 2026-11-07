// 공연 데이터 점검. 사람이 틀리기 쉬운 항목을 한 번에 훑어 "고칠 것" 목록으로 보여준다.
//   node scripts/audit-events.mjs          # 로컬 데이터만 검사 (빠름, 네트워크 없음)
//   node scripts/audit-events.mjs --links  # 예매·공식 링크까지 HEAD/GET으로 열어 확인 (느림)
// 종료 코드: ERROR가 있으면 1, WARN/INFO만 있으면 0.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const events = JSON.parse(readFileSync(join(root, 'src/data/events.json'), 'utf8'));
const venues = JSON.parse(readFileSync(join(root, 'src/data/venues.json'), 'utf8'));
const venuesSrc = readFileSync(join(root, 'src/lib/venues.ts'), 'utf8');
// venues.ts의 별칭 표를 그대로 읽어 별칭 때문에 거짓 경고가 나지 않게 한다.
const aliasBlock = venuesSrc.match(/VENUE_ALIASES[^{]*\{([\s\S]*?)\n\};/)?.[1] ?? '';
const aliasKeys = new Set([...aliasBlock.matchAll(/^\s*'([^']+)'\s*:/gm)].map((m) => m[1]));

const today = new Date().toISOString().slice(0, 10);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const out = { ERROR: [], WARN: [], INFO: [] };
const missingVenues = new Map(); // 공연장 정보가 없는 곳은 공연 건별이 아니라 공연장별로 묶는다
const add = (level, e, msg) => out[level].push(`${e.id}: ${msg}`);

const ids = new Map();
for (const e of events) {
  if (ids.has(e.id)) add('ERROR', e, `id 중복`);
  ids.set(e.id, true);

  if (!ISO.test(e.startDate) || !ISO.test(e.endDate)) { add('ERROR', e, `날짜 형식 이상 (${e.startDate} ~ ${e.endDate})`); continue; }
  if (e.endDate < e.startDate) add('ERROR', e, `종료일이 시작일보다 빠름`);

  const upcoming = e.endDate >= today;
  const active = upcoming && e.status !== 'cancelled';

  if (e.endDate >= today && e.status !== 'cancelled' && !venues[e.venue] && !aliasKeys.has(e.venue)) {
    missingVenues.set(e.venue, (missingVenues.get(e.venue) ?? 0) + 1);
  }

  if (e.posterUrl) {
    if (!e.posterUrl.startsWith('http') && !existsSync(join(root, 'public', e.posterUrl))) add('ERROR', e, `포스터 파일 없음 ${e.posterUrl}`);
    if (!e.posterSourceUrl) add('WARN', e, `포스터 출처(posterSourceUrl) 없음`);
  }

  if (e.ticketOpenAt && Number.isNaN(Date.parse(e.ticketOpenAt))) add('ERROR', e, `ticketOpenAt 파싱 불가 (${e.ticketOpenAt})`);

  if (!active) continue;

  if (!e.sources || e.sources.length === 0) add('WARN', e, `출처(sources) 없음`);
  // 자동 게시(셔틀 스캔)는 지난해 공연을 올해로 잘못 올린 사례가 있었다(테디 스윔스 2025-11-15 -> 2026으로 게시).
  // 출처·예매 링크 URL 어디에도 공연 연도 단서(2026/2027, NOL 상품번호 26xxxxxx)가 없으면 사람이 날짜를 대조해야 한다.
  if (/자동 발견|자동 게시/.test(e.note ?? '')) {
    const urls = [...(e.sources ?? []).map((x) => x.url), ...(e.ticketLinks ?? []).map((x) => x.url), e.ticketUrl ?? ''].join(' ');
    const yr = e.startDate.slice(0, 4);
    // 기사 URL 날짜는 공연 전년도(예: 2027-01 공연을 2026-10에 발표)일 수 있어 전년도까지 인정한다.
    if (!urls.includes(yr) && !urls.includes(String(Number(yr) - 1)) && !/products\/26\d{6}/.test(urls) && !(e.updates ?? []).some((u) => u.date.startsWith('2026'))) {
      add('WARN', e, `자동 게시인데 출처에서 ${yr}년 근거를 못 찾음 - 예매 페이지 날짜와 대조 필요`);
    }
  }
  if (!e.description) add('INFO', e, `소개(description) 없음`);
  if (!e.posterUrl) add('INFO', e, `포스터 없음`);

  const hasLinks = (e.ticketLinks?.length ?? 0) > 0 || Boolean(e.ticketUrl);
  // 티켓오픈 시각이 이미 지났는데 예매 링크가 비어 있으면 갱신이 누락됐을 가능성이 크다.
  if (e.ticketOpenAt && Date.parse(e.ticketOpenAt) < Date.now() && !hasLinks) add('WARN', e, `티켓오픈(${e.ticketOpenAt.slice(0, 16)})이 지났는데 예매 링크 없음`);
  if (e.ticketingAnnounced && !e.ticketOpenDate && !hasLinks) add('INFO', e, `티켓팅 공지 표시만 있고 오픈 일정·링크 없음`);
  // 곧 열리는 공연인데 예매처가 없으면 사용자에게 가장 아픈 구멍이다.
  const days = (Date.parse(e.startDate) - Date.now()) / 86400000;
  if (days <= 30 && !hasLinks && !e.ticketingAnnounced) add('WARN', e, `공연 ${Math.ceil(days)}일 전인데 예매 링크/공지 정보 없음`);

  for (const u of e.updates ?? []) {
    if (!ISO.test(u.date)) add('ERROR', e, `updates 날짜 형식 이상 (${u.date})`);
    else if (u.date > today) add('WARN', e, `updates에 미래 날짜 (${u.date})`);
  }
}

// 같은 날·같은 공연장·비슷한 이름 = 중복 등록 의심
for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) {
  const a = events[i], b = events[j];
  if (a.startDate !== b.startDate || a.venue !== b.venue) continue;
  const n = (s) => s.toLowerCase().replace(/\(.*?\)|[^a-z0-9가-힣]/g, '');
  const x = n(a.artist), y = n(b.artist);
  if (x && y && (x === y || x.includes(y) || y.includes(x))) add('WARN', a, `${b.id}와 같은 날·같은 장소·비슷한 이름 (중복 의심)`);
}

if (process.argv.includes('--links')) {
  const targets = [];
  for (const e of events) {
    if (e.endDate < today || e.status === 'cancelled') continue;
    for (const u of [e.ticketUrl, ...(e.ticketLinks ?? []).map((t) => t.url), e.officialUrl]) if (u) targets.push([e, u]);
  }
  const seen = new Set();
  for (const [e, u] of targets) {
    if (seen.has(u)) continue; seen.add(u);
    try {
      const res = await fetch(u, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 krconcerts-audit' }, signal: AbortSignal.timeout(12000) });
      // 403/429는 봇 차단일 수 있어 경고로만, 404/410은 확실한 깨짐.
      if (res.status === 404 || res.status === 410) add('ERROR', e, `링크 ${res.status}: ${u}`);
      else if (res.status >= 400) add('INFO', e, `링크 ${res.status}(봇 차단 가능성): ${u}`);
    } catch (err) {
      add('WARN', e, `링크 접속 실패(${err.name}): ${u}`);
    }
  }
}

if (missingVenues.size > 0) {
  const top = [...missingVenues.entries()].sort((a, b) => b[1] - a[1]);
  out.INFO.push(`공연장 정보(venues.json) 없는 공연장 ${top.length}곳 - 공연 많은 순: ` + top.slice(0, 8).map(([v, n]) => `${v}(${n})`).join(', '));
}

for (const level of ['ERROR', 'WARN', 'INFO']) {
  if (out[level].length === 0) continue;
  console.log(`\n[${level}] ${out[level].length}건`);
  out[level].forEach((m) => console.log(' - ' + m));
}
console.log(`\n총 ${events.length}건 검사 · ERROR ${out.ERROR.length} · WARN ${out.WARN.length} · INFO ${out.INFO.length}`);
process.exit(out.ERROR.length > 0 ? 1 : 0);
