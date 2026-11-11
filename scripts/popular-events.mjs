// 인기 공연 디벨롭 루틴 - 1단계: 방문 많은 공연 후보 뽑기.
//   npm run popular:events -- "<Vercel Top Pages CSV 경로>"            # 상위 12건
//   npm run popular:events -- "<CSV>" 20 --must=kenshi-yonezu-ghost-incheon-2027-01
// 입력: Vercel Web Analytics > Top Pages 를 최근 7일로 놓고 내려받은 CSV (Page,Visitors,Total).
// 출력: 아직 안 끝난 공연만, 방문자 순으로 "이미 블로그에서 다뤘는지 / 공연 페이지 정보가 얼마나 찼는지"를 같이 보여준다.
// 다음 단계(조사·글쓰기)는 docs/popular-event-routine.md 를 따른다.
import { readFileSync, readdirSync } from 'node:fs';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const limit = Number(args.find((a) => /^\d+$/.test(a))) || 12;
const must = (args.find((a) => a.startsWith('--must=')) ?? '').replace('--must=', '').split(',').filter(Boolean);
if (!csvPath) {
  console.error('사용법: npm run popular:events -- "<Top Pages CSV>" [개수] [--must=id1,id2]');
  process.exit(1);
}

const events = JSON.parse(readFileSync('src/data/events.json', 'utf8'));
const byId = new Map(events.map((e) => [e.id, e]));
const today = new Date().toISOString().slice(0, 10);

const postsDir = 'src/content/posts';
const posts = readdirSync(postsDir)
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => ({ file: f, text: readFileSync(`${postsDir}/${f}`, 'utf8') }));

// 간단 CSV 파싱: 따옴표로 감싼 경로 + 숫자 두 칸
const rows = [];
for (const line of readFileSync(csvPath, 'utf8').split('\n').slice(1)) {
  const m = line.match(/^"?([^",]+)"?,(\d+),(\d+)/);
  if (m) rows.push({ page: m[1], visitors: Number(m[2]), views: Number(m[3]) });
}

const rowFor = (id) => rows.find((r) => r.page === `/events/${id}`);
const candidates = rows
  .filter((r) => r.page.startsWith('/events/') && !['/events/archive'].includes(r.page))
  .map((r) => ({ ...r, id: r.page.replace('/events/', '') }))
  .filter((r) => byId.has(r.id));
for (const id of must) if (byId.has(id) && !candidates.some((c) => c.id === id)) candidates.push({ id, page: `/events/${id}`, visitors: rowFor(id)?.visitors ?? 0, views: rowFor(id)?.views ?? 0 });

const rowsOut = candidates
  .map((c) => {
    const e = byId.get(c.id);
    const linked = posts.filter((p) => p.text.includes(`/events/${c.id}/`)).map((p) => p.file.replace(/\.mdx?$/, ''));
    const thin = /아직 부족해요/.test(e.note ?? '') || !e.description;
    return {
      id: c.id,
      visitors: c.visitors,
      views: c.views,
      ended: e.endDate < today,
      must: must.includes(c.id),
      posts: linked,
      thin,
      richness: ['funFacts', 'setlists', 'updates', 'presale', 'youtubeVideos', 'sources'].filter((k) => e[k]?.length).length,
    };
  })
  .filter((r) => !r.ended)
  .sort((a, b) => Number(b.must) - Number(a.must) || b.visitors - a.visitors)
  .slice(0, limit);

console.log(`새 글 파일 이름: src/content/posts/${today}-<영문-슬러그>.mdx  (postN 번호는 더 쓰지 않는다)\n`);
console.log('방문자  조회  글  정보  공연 id');
for (const r of rowsOut) {
  const flags = [r.must ? '필수' : '', r.thin ? '정보부족' : '', r.posts.length ? `글:${r.posts.join(',')}` : '글없음'].filter(Boolean).join(' ');
  console.log(`${String(r.visitors).padStart(5)}  ${String(r.views).padStart(4)}  ${String(r.posts.length).padStart(1)}   ${r.richness}/6  ${r.id}  ${flags}`);
}
console.log('\n우선순위: 필수 > 글없음 > 정보부족 > 방문자 많은 순. "정보 n/6"은 funFacts·setlists·updates·presale·영상·출처가 채워진 개수.');
