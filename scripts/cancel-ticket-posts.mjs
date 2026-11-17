// 티켓 오픈이 다 지났는데 공연은 아직 안 한 글 목록 (취켓팅으로 바꿀 글).
// 글 본문에 처음 나오는 다가오는 공연(/events/<id>/)을 그 글의 공연으로 본다(PostToolShelf와 같은 기준).
// 그 공연의 오픈 단계(ticketOpens / ticketOpenAt)가 모두 지났고 공연 날짜가 오늘 이후이면 대상이다.
// 본문에 이미 /practice/?stage=cancel 링크가 있으면 "바꿈"으로 센다.
// 사용: npm run posts:cancel  (대상이 남아 있으면 !! 표시, 종료 코드는 항상 0)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const POSTS = path.join(ROOT, 'src/content/posts');
const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/events.json'), 'utf8'));
const list = Array.isArray(events) ? events : events.events;

const nowMs = Date.now();
const today = new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10);
const stagesOf = (e) =>
  e.ticketOpens?.length ? e.ticketOpens.map((s) => s.at) : e.ticketOpenAt ? [e.ticketOpenAt] : [];
const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');

const todo = [];
const done = [];
for (const f of fs.readdirSync(POSTS).filter((n) => /\.mdx?$/.test(n))) {
  const src = fs.readFileSync(path.join(POSTS, f), 'utf8');
  if (/^draft:\s*true/m.test(src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '')) continue;
  const primary = list
    .map((e) => ({ e, pos: src.indexOf(`/events/${e.id}/`) }))
    .filter(({ pos, e }) => pos >= 0 && e.endDate >= today)
    .sort((a, b) => a.pos - b.pos)[0]?.e;
  if (!primary || (primary.status ?? 'scheduled') !== 'scheduled') continue;
  const stages = stagesOf(primary);
  if (stages.length === 0) continue;
  const last = stages.map((s) => new Date(s).getTime()).sort((a, b) => a - b).at(-1);
  if (last > nowMs) continue;
  const row = `${f.replace(/\.mdx?$/, '')} → ${primary.id} (마지막 오픈 ${kst(new Date(last).toISOString())} KST, 공연 ${primary.startDate})`;
  (src.includes('/practice/?stage=cancel') ? done : todo).push(row);
}

console.log(`오늘 ${today} · 오픈은 끝났고 공연은 남은 글`);
console.log(`\n!! 취켓팅으로 바꿀 글 ${todo.length}건`);
for (const r of todo) console.log(`  !! ${r}`);
console.log(`\n이미 바꾼 글 ${done.length}건`);
for (const r of done) console.log(`  ${r}`);
