// 공연 다음날 셋리스트 채우기 후보 목록.
//   npm run setlists:due          # 최근 7일 안에 공연한 날이 있는 공연
//   npm run setlists:due -- 14    # 기간(일) 바꾸기
// "OO 셋리스트"는 공연 직후에 검색이 몰린다. 그래서 끝난 공연(여러 날 공연은 지난 회차)의
// 실제 셋리스트를 공연 페이지 setlists에 빨리 넣는다. 새 글이 아니라서 주 2편 한도와 상관없다.
// "이번 공연 셋리스트 있음"의 기준: setlists 항목의 date(YYYY-MM-DD)가 공연 기간 안에 있다.
//   그런 항목은 공연 페이지에서 '이번 공연 셋리스트'로 맨 위에 펼쳐져 나온다(SetlistBox).
// 페스티벌은 아티스트가 많아 빼고, 공연 전 우리 글이 다룬 공연 > 수요 높은 공연 > 최근 순으로 보여 준다.
// 종료 코드는 항상 0.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const POSTS = path.join(ROOT, 'src/content/posts');
const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/events.json'), 'utf8'));
const days = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 7;
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const shift = (iso, n) => new Date(Date.parse(iso) + n * 86400_000).toISOString().slice(0, 10);
const from = shift(today, -days);

const posts = fs.readdirSync(POSTS).filter((n) => /\.mdx?$/.test(n))
  .map((f) => ({ name: f.replace(/\.mdx?$/, ''), src: fs.readFileSync(path.join(POSTS, f), 'utf8') }));

const inRange = (e, d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') && d >= e.startDate && d <= e.endDate;
const rows = [];
for (const e of events) {
  if ((e.status ?? 'scheduled') !== 'scheduled' || e.genre === '페스티벌') continue;
  // 지난 회차가 기간 안에 하나라도 있어야 한다(어제까지)
  const lastPlayed = e.endDate < today ? e.endDate : shift(today, -1);
  if (lastPlayed < e.startDate || lastPlayed < from) continue;
  const have = (e.setlists ?? []).filter((s) => inRange(e, s.date));
  if (have.length) continue;
  const before = posts.filter((p) => p.src.includes(`/events/${e.id}/`)).length;
  const hot = e.demand === 'high' || e.ticketingDifficulty === 'hard';
  const ago = Math.round((Date.parse(today) - Date.parse(lastPlayed)) / 86400_000);
  rows.push({ e, ago, before, hot, score: (before ? 100 : 0) + (hot ? 50 : 0) - ago * 5 });
}
rows.sort((a, b) => b.score - a.score);

const q = (e) => e.artist.replace(/\s*\([^)]*\)/g, '').replace(/[\[<〈［][^\]>〉］]*[\]>〉］]/g, '').replace(/\s+-\s+.*$/, '').replace(/:.*$/, '').replace(/\s+(\d+(ST|ND|RD|TH)\s+)?(WORLD\s+)?TOUR\b.*$/i, '').replace(/\s*(전국투어\s*)?(단독\s*)?(콘서트|Concert|CONCERT)\s*$/i, '').trim();
console.log(`오늘 ${today} · ${from} 이후 공연한 날이 있는데 이번 공연 셋리스트가 없는 공연 ${rows.length}건 (페스티벌 제외)`);
for (const { e, ago, before, hot } of rows) {
  const mark = before || hot ? '!!' : '  ';
  const when = e.startDate === e.endDate ? e.startDate : `${e.startDate}~${e.endDate}`;
  console.log(`\n${mark} ${e.id}  (${when} · ${e.venue} · 마지막 회차 ${ago}일 전)`);
  console.log(`     우리 글 ${before}편${hot ? ' · 수요 높음' : ''} · 지금 셋리스트 ${(e.setlists ?? []).length}건(다른 공연 기준)`);
  console.log(`     → setlist.fm: https://www.setlist.fm/search?query=${encodeURIComponent(q(e))}`);
  console.log(`     → 검색어: "${q(e)} 셋리스트" / "${q(e)} ${e.city} 세트리스트" (기사·공식 SNS·팬 정리)`);
}
console.log(`
!! = 공연 전에 우리 글이 다뤘거나 수요가 높은 공연. 여기부터 채운다.
넣는 모양: setlists 맨 앞에 { label: "${today.slice(0, 4)} <도시> 공연 셋리스트", date: "<공연한 날 YYYY-MM-DD>", venue, songs, sourceUrl }.
  여러 날 공연은 날마다 따로 넣고, 곡 순서가 다른 출처끼리 엇갈리면 넣지 않는다. 곡명은 출처에 적힌 그대로 쓴다.`);
