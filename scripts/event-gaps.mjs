#!/usr/bin/env node
// 예정 공연마다 "방문자가 보는 정보 중 비어 있는 것"을 뽑아 보강할 목록으로 보여준다.
//   npm run events:gaps            사람이 읽는 목록 (공연 가까운 순)
//   npm run events:gaps -- --json  스케줄 작업이 읽는 JSON
//   npm run events:gaps -- --links 예매 링크를 실제로 열어 죽은 링크(다른 주소로 넘어감)까지 확인
//
// 왜 있나 (2026-11-17): 자동 게시(KOPIS·셔틀 스캔·티켓오픈 공지 워치)는 "공연이 있다"만 빨리 올리고
// 나머지는 나중에 채우기로 했는데, 채우는 단계가 audit 경고에 흩어져 있어 아무도 따라가지 않았다.
// 그 결과 예매가 열린 지 몇 주 된 공연이 "발표 전"으로 보이거나(NCT WISH), 예매 버튼이 사라진 공지로
// 연결되거나(5SOS·FKJ), 가격이 화면에 안 나오는 공연이 대부분이었다. 이 스크립트는 그 빈틈을
// 한 목록으로 모으고, 어디서 확인하면 되는지(찾는 순서)를 같이 알려준다. 데이터는 고치지 않는다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const events = JSON.parse(readFileSync(join(root, 'src/data/events.json'), 'utf8'));
const args = process.argv.slice(2);
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

// 예매처 "상품 페이지" 주소. 공지·목록·검색 주소는 시간이 지나면 사라지거나 다른 곳으로 넘어간다.
export const PRODUCT_URL = [
  /nol\.yanolja\.com\/ticket\/(places\/\d+\/)?products\/\w+/,
  /tickets\.interpark\.com\/goods\/\w+/,
  /ticket\.yes24\.com\/(Perf|Special)\/\d+/,
  /ticket\.melon\.com\/performance\/index\.htm\?prodId=\d+/,
  /tkglobal\.melon\.com\/performance\/index\.htm\?.*prodId=\d+/,
  /ticketlink\.co\.kr\/product\/\d+/,
  /ticket\.29cm\.co\.kr\/catalog\/\d+/,
];
// 공지·오픈 예정 글. 예매 버튼으로 쓰면 안 된다(sources에만 둔다).
export const NOTICE_URL = /\/contents\/notice\/|ticket\.yes24\.com\/Notice|\/csoon\/|\/help\/notice\/|\/display\/upcoming/;
export const linksOf = (e) => [e.ticketUrl, ...(e.ticketLinks ?? []).map((l) => l.url)].filter(Boolean);
export const isProduct = (u) => PRODUCT_URL.some((re) => re.test(u));

const kopisId = (e) => {
  const fromId = e.id.match(/^kopis-(PF\d+)$/)?.[1];
  const fromSrc = (e.sources ?? []).map((s) => s.url.match(/mt20Id=(PF\d+)/)?.[1]).find(Boolean);
  return fromId ?? fromSrc;
};
const q = (e) => encodeURIComponent(e.artist.replace(/\s*\([^)]*\)/g, '').replace(/\s+-\s+.*$/, '').trim());

function gapsOf(e) {
  const g = [];
  const links = linksOf(e);
  const openMs = e.ticketOpenAt ? Date.parse(e.ticketOpenAt) : NaN;
  const openPassed = Number.isFinite(openMs) && openMs < Date.now();
  const openFuture = Number.isFinite(openMs) && openMs >= Date.now();
  const days = Math.ceil((Date.parse(e.startDate) - Date.now()) / 86400000);
  const venuePending = /추후|미정|미발표/.test(e.venue);

  if (links.length === 0 && !openFuture && !venuePending) {
    g.push({ key: 'no-link', level: openPassed || days <= 60 ? 'high' : 'mid', msg: openPassed ? `티켓오픈(${e.ticketOpenAt.slice(0, 10)})이 지났는데 예매 링크 없음` : '예매 링크 없음 (화면에 "티켓 오픈 일정 발표 전"으로 보임)' });
  }
  for (const u of links) {
    if (NOTICE_URL.test(u)) g.push({ key: 'notice-link', level: 'high', msg: `예매 버튼이 공지 주소로 연결됨(사라지면 목록으로 넘어감): ${u}` });
    else if (!isProduct(u)) g.push({ key: 'other-link', level: 'low', msg: `예매처 상품 페이지가 아닌 링크: ${u} (공연장 직접 예매면 그대로 둠)` });
  }
  if (!e.prices?.length && (links.length > 0 || openPassed)) g.push({ key: 'no-price', level: 'mid', msg: '티켓 가격(prices) 없음' });
  if (e.prices?.length && e.pricesCheckedAt && (Date.parse(today) - Date.parse(e.pricesCheckedAt)) / 86400000 > 45 && days > 0) {
    g.push({ key: 'old-price', level: 'low', msg: `가격 확인한 지 45일 넘음(${e.pricesCheckedAt})` });
  }
  if (!e.facts && links.some(isProduct)) g.push({ key: 'no-facts', level: 'low', msg: '관람 조건(facts: 시작 시각·러닝타임·연령·매수 제한) 없음. 예매처 상품 페이지에서 확인해 넣기' });
  if (!e.posterUrl) g.push({ key: 'no-poster', level: links.length ? 'mid' : 'low', msg: '포스터 없음' });
  if (!e.description) g.push({ key: 'no-desc', level: 'mid', msg: '소개(description) 없음' });
  if (!e.sources?.length) g.push({ key: 'no-source', level: 'mid', msg: '출처(sources) 없음' });
  if (/공지 워치로 막 발견|자동 발견·게시/.test(e.note ?? '') && e.addedAt === undefined && !e.description) {
    g.push({ key: 'thin', level: 'low', msg: '자동 게시 후 보강된 적 없음' });
  }
  return g;
}

// 어디서 찾나: 가장 믿을 만하고 빨리 끝나는 순서. (CLAUDE.md "공연 정보 보강" 절과 같은 내용)
function hintsOf(e, gaps) {
  const need = new Set(gaps.map((g) => g.key));
  const h = [];
  if (need.has('no-link') || need.has('notice-link') || need.has('no-price') || need.has('no-poster')) {
    const k = kopisId(e);
    if (k) h.push(`KOPIS '예매처 바로가기': https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id=${k}`);
    h.push(`멜론티켓 검색: https://ticket.melon.com/search/index.htm?q=${q(e)}`);
    h.push(`예스24 검색: https://ticket.yes24.com/New/Search/Search.aspx?query=${q(e)}`);
    if (e.officialUrl) h.push(`공식 공지(예매처·가격이 적혀 있는 경우가 많음): ${e.officialUrl}`);
    for (const s of (e.sources ?? []).filter((s) => NOTICE_URL.test(s.url)).slice(0, 2)) h.push(`티켓오픈 공지의 '예매하기/상세보기' 버튼: ${s.url}`);
  }
  if (need.has('no-price') && linksOf(e).some((u) => /yes24|melon/.test(u))) h.push('예스24·멜론 링크가 있으면 npm run prices:sync 로 자동 채움');
  return h;
}

let rows = events
  .filter((e) => e.endDate >= today && e.status !== 'cancelled')
  .map((e) => ({ e, gaps: gapsOf(e) }))
  .filter((r) => r.gaps.length > 0);

// --links: 예매 링크를 열어 다른 경로로 넘어가거나 404면 죽은 링크로 본다(느림, 예매처에 하루 한 번만).
if (args.includes('--links')) {
  const UA = 'Mozilla/5.0 (compatible; jikgwannyang-linkcheck; +https://jikgwannyang.com/about/)';
  const all = events.filter((e) => e.endDate >= today && e.status !== 'cancelled');
  for (const e of all) {
    // NOL은 브라우저가 아닌 요청을 막아서 여기서 열지 않는다. 주소 모양(NOTICE_URL)으로만 본다.
    for (const u of linksOf(e).filter((u) => !/nol\.yanolja\.com|interpark\.com/.test(u))) {
      let dead = '';
      try {
        const res = await fetch(u, { redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
        const from = new URL(u), to = new URL(res.url);
        if (res.status === 404 || res.status === 410) dead = `링크 ${res.status}`;
        else if (to.pathname !== from.pathname && !(/yes24/.test(u) && /\/(Perf|Special)\/\d+/.test(to.pathname))) dead = `다른 주소로 넘어감 → ${to.host}${to.pathname}`;
      } catch { /* 접속 실패는 일시적일 수 있어 빈틈으로 세지 않는다 */ }
      if (!dead) continue;
      let row = rows.find((r) => r.e.id === e.id);
      if (!row) { row = { e, gaps: [] }; rows.push(row); }
      row.gaps.push({ key: 'dead-link', level: 'high', msg: `${dead}: ${u}` });
    }
  }
}

const rank = { high: 0, mid: 1, low: 2 };
const top = (r) => Math.min(...r.gaps.map((g) => rank[g.level]));
rows.sort((a, b) => top(a) - top(b) || a.e.startDate.localeCompare(b.e.startDate));

if (args.includes('--json')) {
  console.log(JSON.stringify(rows.map((r) => ({ id: r.e.id, artist: r.e.artist, venue: r.e.venue, startDate: r.e.startDate, gaps: r.gaps, hints: hintsOf(r.e, r.gaps) })), null, 2));
} else {
  const mark = { high: '!!', mid: ' !', low: '  ' };
  for (const r of rows) {
    console.log(`\n${r.e.id}  (${r.e.startDate} · ${r.e.venue})`);
    for (const g of r.gaps.sort((a, b) => rank[a.level] - rank[b.level])) console.log(`  ${mark[g.level]} ${g.msg}`);
    for (const h of hintsOf(r.e, r.gaps)) console.log(`       → ${h}`);
  }
  const count = (lv) => rows.filter((r) => r.gaps.some((g) => g.level === lv)).length;
  const upcoming = events.filter((e) => e.endDate >= today && e.status !== 'cancelled').length;
  console.log(`\n예정 공연 ${upcoming}건 중 빈틈 있는 공연 ${rows.length}건 · 급함(!!) ${count('high')}건 · 보통(!) ${count('mid')}건`);
}
