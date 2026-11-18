// 블로그 글의 연습 안내가 티켓 오픈 상태와 맞는지 본다.
//   오픈 전 → 티켓팅 연습(/practice/) · 오픈이 지남 → 취켓팅 연습(/practice/?stage=cancel)
// 글 본문에 처음 나오는 다가오는 공연(/events/<id>/)을 그 글의 공연으로 본다(PostToolShelf와 같은 기준).
//
// 출력:
//   !! 취켓팅으로 바꿀 글   오픈이 지났는데(오픈 단계가 모두 지났거나 예매 링크가 걸림) 취켓팅 링크가 없는 글
//   !! 되돌릴 글            취켓팅 링크가 있는데 그 공연이 아직 오픈 전인 글(글의 공연이 잘못 잡힌 경우가 많다)
//   ?? 판매 상태 확인 필요   글에 나온 공연 중 예매처 페이지를 열어 본 기록이 없거나 오래된 것
//
// 판매 상태는 events.json의 saleState·saleCheckedAt에 적는다. 예매처 상품 페이지를 실제로 연 날만 적는다.
// 데이터(오픈 시각·링크)만 보고 글을 고치면 틀린다: NOL의 "예매대기"는 오픈 전이 아니라 매진 좌석 대기 서비스다(2026-11-18).
// 사용: npm run posts:cancel  (종료 코드는 항상 0)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const POSTS = path.join(ROOT, 'src/content/posts');
const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/events.json'), 'utf8'));
const list = Array.isArray(events) ? events : events.events;

const STALE_DAYS = 7; // 확인한 지 이만큼 지나면 다시 본다
const nowMs = Date.now();
const today = new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400_000);
const stagesOf = (e) =>
  e.ticketOpens?.length ? e.ticketOpens.map((s) => s.at) : e.ticketOpenAt ? [e.ticketOpenAt] : [];
const linksOf = (e) => [e.ticketUrl, ...(e.ticketLinks ?? []).map((l) => l.url)].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);
const kst = (ms) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
const STATE = { upcoming: '오픈 예정', open: '예매 가능', soldout: '매진', closed: '판매 종료' };

function stateOf(e) {
  const stages = stagesOf(e).map((s) => new Date(s).getTime()).sort((a, b) => a - b);
  const last = stages.at(-1);
  const onSale = linksOf(e).length > 0;
  // 오픈 단계가 하나라도 남았으면 아직 오픈 전으로 본다(선예매만 지난 경우 포함).
  const future = last !== undefined && last > nowMs;
  const opened = !future && (last !== undefined || onSale);
  const checkedAgo = e.saleCheckedAt ? dayDiff(today, e.saleCheckedAt) : null;
  // 마지막 확인 뒤에 오픈 시각이 지나갔으면 그 확인은 낡은 것이다.
  const openedSinceCheck = e.saleCheckedAt && last !== undefined && last <= nowMs && kst(last).slice(0, 10) >= e.saleCheckedAt && e.saleState === 'upcoming';
  const needsCheck = (opened || onSale) && (checkedAgo === null || checkedAgo > STALE_DAYS || openedSinceCheck);
  return { last, future, opened, onSale, checkedAgo, needsCheck };
}
const checkedLabel = (e, st) =>
  st.checkedAgo === null ? '예매처 미확인' : `${STATE[e.saleState] ?? e.saleState} · ${e.saleCheckedAt} 확인${st.needsCheck ? ' (다시 확인)' : ''}`;

const todo = [];
const revert = [];
const done = [];
const toCheck = new Map();
for (const f of fs.readdirSync(POSTS).filter((n) => /\.mdx?$/.test(n))) {
  const src = fs.readFileSync(path.join(POSTS, f), 'utf8');
  if (/^draft:\s*true/m.test(src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '')) continue;
  const name = f.replace(/\.mdx?$/, '');
  const linked = list
    .map((e) => ({ e, pos: src.indexOf(`/events/${e.id}/`) }))
    .filter(({ pos, e }) => pos >= 0 && e.endDate >= today && (e.status ?? 'scheduled') === 'scheduled')
    .sort((a, b) => a.pos - b.pos)
    .map(({ e }) => e);
  for (const e of linked) {
    if (!stateOf(e).needsCheck) continue;
    if (!toCheck.has(e.id)) toCheck.set(e.id, { e, posts: [] });
    toCheck.get(e.id).posts.push(name);
  }
  const primary = linked[0];
  if (!primary) continue;
  const st = stateOf(primary);
  const hasCancel = src.includes('/practice/?stage=cancel');
  const when = st.last !== undefined ? `마지막 오픈 ${kst(st.last)} KST` : '오픈 시각 없음 · 예매 중';
  const row = `${name} → ${primary.id} (${when}, 공연 ${primary.startDate}) [${checkedLabel(primary, st)}]`;
  if (st.future || primary.saleState === 'upcoming') {
    if (hasCancel && !st.needsCheck) revert.push(row);
    continue;
  }
  if (!st.opened) continue;
  // 판매가 끝난 공연(공연 전날·당일 마감)은 취소표를 안내할 수 없으니 대상에서 뺀다.
  if (primary.saleState === 'closed' && !st.needsCheck && !hasCancel) continue;
  (hasCancel ? done : todo).push(row);
}

console.log(`오늘 ${today} · 글의 연습 안내와 티켓 오픈 상태`);
console.log(`\n!! 취켓팅으로 바꿀 글 ${todo.length}건 (고치기 전에 그 공연의 예매처 페이지를 열어 상태를 확인한다)`);
for (const r of todo) console.log(`  !! ${r}`);
console.log(`\n!! 되돌릴 글 ${revert.length}건 (취켓팅 링크가 있는데 공연은 오픈 전. 글 앞쪽의 /events/ 링크 순서를 본다)`);
for (const r of revert) console.log(`  !! ${r}`);
console.log(`\n?? 판매 상태 확인 필요 ${toCheck.size}건 (예매처를 열어 saleState·saleCheckedAt을 적는다)`);
for (const { e, posts } of [...toCheck.values()].sort((a, b) => a.e.startDate.localeCompare(b.e.startDate))) {
  console.log(`  ?? ${e.id} (공연 ${e.startDate}) [${checkedLabel(e, stateOf(e))}] 글: ${posts.join(', ')}`);
  for (const u of linksOf(e)) console.log(`       → ${u}`);
}
console.log(`\n이미 바꾼 글 ${done.length}건`);
for (const r of done) console.log(`  ${r}`);
