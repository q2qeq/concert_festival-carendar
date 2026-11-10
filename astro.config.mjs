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
const SITEMAP_EXCLUDE = new Set(['/my/']);

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
  // 예전 주소(/game)로 공유된 링크가 깨지지 않도록
  redirects: {
    '/game': '/practice/',
    // KOPIS 자동 수집본과 직접 정리한 페이지가 중복돼 하나로 합침 (2026-11-06)
    '/events/kopis-PF304185': '/events/kenshi-yonezu-ghost-incheon-2027-01/',
  },
});
