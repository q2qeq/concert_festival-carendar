// 이번 주(월~일, KST) 새 글이 몇 편인지와 남은 편수를 보여 준다. 새 글은 모든 작업을 합쳐 주 2편까지다.
//   npm run posts:week
import { readdirSync, readFileSync } from 'node:fs';

const WEEKLY_LIMIT = 2;
const DIR = 'src/content/posts';

const today = new Date(Date.now() + 9 * 3600000);
const sinceMonday = (today.getUTCDay() + 6) % 7;
const day = (offset) => new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);
const monday = day(-sinceMonday);
const sunday = day(6 - sinceMonday);

const posts = readdirSync(DIR)
  .filter((f) => f.endsWith('.mdx'))
  .map((file) => {
    const m = readFileSync(`${DIR}/${file}`, 'utf8').match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m);
    return { file, pubDate: m?.[1] ?? '' };
  })
  .filter((p) => p.pubDate >= monday && p.pubDate <= sunday)
  .sort((a, b) => a.pubDate.localeCompare(b.pubDate));

console.log(`이번 주(${monday} ~ ${sunday}) 새 글 ${posts.length}편 / 한도 ${WEEKLY_LIMIT}편`);
posts.forEach((p) => console.log(`  ${p.pubDate}  ${p.file}`));
console.log(`남은 편수: ${Math.max(0, WEEKLY_LIMIT - posts.length)}`);
