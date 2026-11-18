// 공연이 끝난 뒤 실황·반응 글을 쓸 후보 목록.
//   npm run posts:after            # 최근 10일 안에 끝난 공연
//   npm run posts:after -- 14      # 기간(일) 바꾸기
// 끝난 공연 가운데 아직 후기 글이 없는 것을 우선순위대로 보여 준다.
// "후기 글 있음"의 기준: 그 공연(/events/<id>/)을 링크하고, 공연 마지막 날 뒤에 발행됐고, 태그에 "공연 후기"가 있는 글.
// 우선순위: 공연 전에 우리 글이 다룬 공연 > demand·ticketingDifficulty가 높은 공연 > 최근에 끝난 순.
// 글 쓰는 법은 docs/blog-post-rules.md 5절. 종료 코드는 항상 0.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const POSTS = path.join(ROOT, 'src/content/posts');
const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/events.json'), 'utf8'));
const days = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 10;
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const ago = (iso) => Math.round((Date.parse(today) - Date.parse(iso)) / 86400_000);

const posts = fs.readdirSync(POSTS).filter((n) => /\.mdx?$/.test(n)).map((f) => {
  const src = fs.readFileSync(path.join(POSTS, f), 'utf8');
  const fm = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  return {
    name: f.replace(/\.mdx?$/, ''),
    src,
    pubDate: (fm.match(/^pubDate:\s*(\S+)/m)?.[1] ?? '').slice(0, 10),
    review: /^tags:.*공연 후기/m.test(fm),
    draft: /^draft:\s*true/m.test(fm),
  };
}).filter((p) => !p.draft);

const rows = [];
for (const e of events) {
  const d = ago(e.endDate);
  if (d < 1 || d > days || (e.status ?? 'scheduled') !== 'scheduled') continue;
  const linked = posts.filter((p) => p.src.includes(`/events/${e.id}/`));
  const review = linked.find((p) => p.review && p.pubDate > e.endDate);
  const before = linked.filter((p) => p.pubDate <= e.endDate);
  const hot = e.demand === 'high' || e.ticketingDifficulty === 'hard';
  rows.push({ e, d, review, before, hot, score: (before.length ? 100 : 0) + (hot ? 50 : 0) - d });
}
rows.sort((a, b) => b.score - a.score);

const q = (e) => e.artist.replace(/\s*\([^)]*\)/g, '').replace(/[\[<〈［][^\]>〉］]*[\]>〉］]/g, '').replace(/\s+-\s+.*$/, '').replace(/:.*$/, '').replace(/\s*(전국투어\s*)?(단독\s*)?(콘서트|Concert|CONCERT)\s*$/i, '').trim();
const todo = rows.filter((r) => !r.review);
console.log(`오늘 ${today} · 최근 ${days}일 안에 끝난 공연 ${rows.length}건 · 후기 글 없는 공연 ${todo.length}건`);
for (const r of todo) {
  const { e } = r;
  const mark = r.before.length || r.hot ? '!!' : '  ';
  console.log(`\n${mark} ${e.id}  (${e.startDate === e.endDate ? e.endDate : `${e.startDate}~${e.endDate}`} · ${e.venue} · 끝난 지 ${r.d}일)`);
  console.log(`     공연 전 글: ${r.before.length ? r.before.map((p) => p.name).join(', ') : '없음'}${r.hot ? ' · 수요 높음' : ''} · 셋리스트 ${(e.setlists ?? []).length}건`);
  console.log(`     → 셋리스트: https://www.setlist.fm/search?query=${encodeURIComponent(q(e))}`);
  console.log(`     → 기사 검색어: "${q(e)} 콘서트 ${e.endDate.slice(0, 4)}" + 성료 / 관객 / 매진 / 현장`);
  if (e.officialUrl) console.log(`     → 공식: ${e.officialUrl}`);
}
const done = rows.filter((r) => r.review);
console.log(`\n후기 글 있는 공연 ${done.length}건`);
for (const r of done) console.log(`  ${r.e.id} → ${r.review.name}`);
console.log('\n!! = 공연 전에 우리 글이 다뤘거나 수요가 높은 공연. 여기부터 쓴다.');
