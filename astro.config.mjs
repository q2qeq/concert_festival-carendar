import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { venueSlug } from './src/lib/venues.ts';

export const SITE_URL = 'https://jikgwannyang.com';

// 사이트맵 lastmod: 구글이 어떤 페이지가 새로 바뀌었는지 알고 크롤 우선순위를 잡도록
// 데이터에 남아 있는 실제 날짜만 쓴다(없으면 lastmod를 비워 둔다).
const lastmodByPath = new Map();
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
const latest = (dates) => dates.filter(isDate).map((d) => d.slice(0, 10)).sort().at(-1);

const events = JSON.parse(readFileSync(path.join(process.cwd(), 'src/data/events.json'), 'utf8'));
// 공연 페이지에 보이는 사실(가격표·판매 상태·관람 조건·소식)을 확인하거나 넣은 날
const eventDates = (e) => [
  e.addedAt,
  e.enrichmentCheckedAt,
  e.merchCheckedAt,
  e.pricesCheckedAt,
  e.saleCheckedAt,
  e.facts?.checkedAt,
  ...(e.updates ?? []).map((u) => u.date),
];
for (const e of events) {
  const d = latest(eventDates(e));
  if (d) lastmodByPath.set(`/events/${e.id}/`, d);
}

// 공연장 페이지: 공연장 정보(주차·좌석)를 확인한 날과, 그 공연장 공연 목록이 바뀐 날(공연 추가) 중 늦은 날.
// 공연장 이름 → 주소 변환은 페이지와 같은 함수를 쓴다(별칭 처리 포함).
const venueInfo = JSON.parse(readFileSync(path.join(process.cwd(), 'src/data/venues.json'), 'utf8'));
for (const [name, v] of Object.entries(venueInfo)) {
  const own = [v.parkingCheckedAt, v.seating?.checkedAt];
  const listed = events.filter((e) => venueSlug(e.venue) === venueSlug(name)).map((e) => e.addedAt);
  const d = latest([...own, ...listed]);
  if (d) lastmodByPath.set(`/venues/${venueSlug(name)}/`, d);
}

const postsDir = path.join(process.cwd(), 'src/content/posts');
for (const file of readdirSync(postsDir)) {
  const m = file.match(/^(.+)\.mdx?$/);
  if (!m) continue;
  const src = readFileSync(path.join(postsDir, file), 'utf8');
  const d = latest([
    src.match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1],
    src.match(/^updatedDate:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1],
  ]);
  if (d) lastmodByPath.set(`/blog/${m[1]}/`, d);
}

// 개인용 페이지(브라우저 저장소로만 내용이 채워짐)는 색인 대상이 아니다
const SITEMAP_EXCLUDE = new Set(['/my/']);

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

// noindex 페이지(얇은 태그·일정 목록 등)는 사이트맵에 넣지 않는다. 페이지가 스스로 noindex를 정하므로
// 빌드가 끝난 뒤 HTML을 보고 사이트맵에서 지운다. sitemap 통합보다 뒤에 둬야 한다.
function sitemapDropNoindex() {
  return {
    name: 'sitemap-drop-noindex',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const files = readdirSync(out).filter((f) => /^sitemap-\d+\.xml$/.test(f));
        let dropped = 0;
        for (const f of files) {
          const p = path.join(out, f);
          const xml = readFileSync(p, 'utf8');
          const next = xml.replace(/<url>.*?<\/url>/gs, (block) => {
            const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
            if (!loc) return block;
            const rel = decodeURIComponent(new URL(loc).pathname);
            const html = path.join(out, rel, 'index.html');
            if (existsSync(html) && /<meta name="robots" content="noindex/.test(readFileSync(html, 'utf8'))) {
              dropped++;
              return '';
            }
            return block;
          });
          if (next !== xml) writeFileSync(p, next);
        }
        logger.info(`noindex 페이지 ${dropped}개를 사이트맵에서 뺐어요`);
      },
    },
  };
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
    sitemapDropNoindex(),
  ],
  // 옛 주소 리디렉션(/game, kopis-PF304185, kopis-PF299935)은 vercel.json에서 진짜 301/308로 처리한다.
  // Astro redirects는 정적 빌드에서 200 + meta refresh 페이지를 만들어 서치콘솔에 '대체 페이지'로 남았다.
});
