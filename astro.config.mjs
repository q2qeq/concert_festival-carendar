import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const SITE_URL = 'https://jikgwannyang.com';

// 사이트맵 lastmod: 구글이 어떤 페이지가 새로 바뀌었는지 알고 크롤 우선순위를 잡도록
// 데이터에 남아 있는 실제 날짜만 쓴다(없으면 lastmod를 비워 둔다).
const lastmodByPath = new Map();
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
const latest = (dates) => dates.filter(isDate).map((d) => d.slice(0, 10)).sort().at(-1);

const events = JSON.parse(readFileSync(path.join(process.cwd(), 'src/data/events.json'), 'utf8'));
for (const e of events) {
  const d = latest([
    e.addedAt,
    e.enrichmentCheckedAt,
    e.merchCheckedAt,
    ...(e.updates ?? []).map((u) => u.date),
  ]);
  if (d) lastmodByPath.set(`/events/${e.id}/`, d);
}

const postsDir = path.join(process.cwd(), 'src/content/posts');
for (const file of readdirSync(postsDir)) {
  const m = file.match(/^(.+)\.mdx?$/);
  if (!m) continue;
  const fm = readFileSync(path.join(postsDir, file), 'utf8').match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m);
  if (fm) lastmodByPath.set(`/blog/${m[1]}/`, fm[1]);
}

// 개인용 페이지(브라우저 저장소로만 내용이 채워짐)는 색인 대상이 아니다
const SITEMAP_EXCLUDE = new Set(['/my/', '/lab/stage/']);

// 끝난 지 7일 넘은 공연 중 셋리스트가 없는 페이지는 사이트맵에서 뺀다.
// 서치콘솔에서 75개가 "발견됨 - 색인 안 됨"에 걸려 있었는데(2026-11), 얇은 지난 공연 페이지가
// 크롤 순서를 차지하지 않게 하려는 것이다. 페이지 자체는 그대로 두고 /events/archive/에서 링크한다.
// 셋리스트가 있는 지난 공연은 "OO 셋리스트" 검색 수요가 있어 남긴다.
const kstToday = new Date(Date.now() + 9 * 3600 * 1000);
const staleCutoff = new Date(kstToday.getTime() - 7 * 86400 * 1000).toISOString().slice(0, 10);
for (const e of events) {
  const end = e.endDate ?? e.startDate;
  if (isDate(end) && end < staleCutoff && !(e.setlists?.length > 0)) {
    SITEMAP_EXCLUDE.add(`/events/${e.id}/`);
  }
}

export default defineConfig({
  site: SITE_URL,
  integrations: [
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.has(new URL(page).pathname),
      serialize(item) {
        const d = lastmodByPath.get(new URL(item.url).pathname);
        if (d) item.lastmod = d;
        return item;
      },
    }),
    mdx(),
  ],
  // 옛 주소 리디렉션(/game, kopis-PF304185, kopis-PF299935)은 vercel.json에서 진짜 301/308로 처리한다.
  // Astro redirects는 정적 빌드에서 200 + meta refresh 페이지를 만들어 서치콘솔에 '대체 페이지'로 남았다.
});
