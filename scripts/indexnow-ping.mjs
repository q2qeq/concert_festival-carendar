#!/usr/bin/env node
/**
 * Pings the IndexNow aggregator endpoint with every URL in the site's own
 * sitemap, so Bing/Naver/Yandex/Seznam (all IndexNow-participating engines)
 * get an immediate "these URLs changed" signal instead of waiting for their
 * own discovery crawl. Google does NOT participate in IndexNow - for Google
 * we still rely on the sitemap + the MusicEvent structured data on event
 * pages (see events/[id].astro) for its separate Event rich-result surface.
 *
 * Naver matters more than usual for this project since a meaningful share
 * of the target audience (concert-goers) searches in Korean on Naver, not
 * Google - see project memory (Naver 서치어드바이저 인증만 되어있고 자동
 * 색인 요청 파이프라인은 없었음, added 2026-09-04).
 *
 * WHY read the URL list from the BUILT sitemap instead of re-deriving it
 * from events.json/venues.json/blog content by hand: @astrojs/sitemap
 * already correctly enumerates every real route (including dynamic ones
 * like /events/[id], /venues/[slug], /tag/[slug]) from the actual build.
 * Hand-reimplementing that routing logic here would drift out of sync the
 * next time a route is added or renamed - reading dist/ is the single
 * source of truth.
 *
 * Requires `npm run build` to have already produced dist/ in this run
 * (the GitHub Actions workflow does this before calling this script).
 *
 * IndexNow key: this is NOT a secret - it's meant to be publicly readable
 * at https://jikgwannyang.com/<key>.txt as the ownership-verification
 * mechanism, so it's fine to hardcode here (same pattern as SITE_URL being
 * hardcoded in astro.config.mjs / tweet-new-events.mjs). If this key ever
 * needs rotating, generate a new one, replace the public/<key>.txt file,
 * and update INDEXNOW_KEY below to match.
 */
import { readFileSync, existsSync } from 'node:fs';

const SITE_URL = 'https://jikgwannyang.com';
const HOST = 'jikgwannyang.com';
const INDEXNOW_KEY = '67ae4b019f2076e69820538a615e9078';
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
// 공용 집계 엔드포인트(api.indexnow.org)는 빙 쪽 사이트 확인이 안 돼 403(UserForbiddedToAccessSite)을 돌려주지만,
// 네이버·얀덱스는 각자 엔드포인트로 직접 보내면 받아준다(2026-11-07 직접 확인: 네이버 200, 얀덱스 202).
// IndexNow는 한 엔진에 보내면 참여 엔진들이 공유하는 구조라, 엔진별로 따로 보내고 하나라도 받으면 성공으로 본다.
const ENDPOINTS = [
  { name: 'Naver', url: 'https://searchadvisor.naver.com/indexnow' },
  { name: 'Yandex', url: 'https://yandex.com/indexnow' },
  { name: 'IndexNow(Bing)', url: 'https://api.indexnow.org/indexnow' },
];
const DIST_DIR = 'dist';
const DRY_RUN = process.argv.includes('--dry-run');

function extractLocs(xml) {
  const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  return [...matches].map((m) => m[1].trim());
}

function readSitemapUrls() {
  const indexPath = `${DIST_DIR}/sitemap-index.xml`;
  if (!existsSync(indexPath)) {
    console.error(
      `${indexPath} not found - did \`npm run build\` run first? (@astrojs/sitemap writes this file into dist/ during build)`
    );
    process.exit(1);
  }
  const indexXml = readFileSync(indexPath, 'utf8');
  // sitemap-index.xml's <loc> entries point at nested sitemap files (e.g.
  // sitemap-0.xml), not pages themselves - astro writes these as absolute
  // SITE_URL-prefixed URLs, so map them back to local dist/ paths to read.
  const nestedSitemapUrls = extractLocs(indexXml);
  const pageUrls = [];
  for (const sitemapUrl of nestedSitemapUrls) {
    const localPath = sitemapUrl.replace(SITE_URL, DIST_DIR);
    if (!existsSync(localPath)) {
      console.warn(`Warning: referenced sitemap ${sitemapUrl} not found locally at ${localPath}, skipping.`);
      continue;
    }
    pageUrls.push(...extractLocs(readFileSync(localPath, 'utf8')));
  }
  return [...new Set(pageUrls)];
}

async function submit(endpoint, urlList) {
  const body = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
}

const urls = readSitemapUrls();
console.log(`Found ${urls.length} URLs in the built sitemap.`);

if (urls.length === 0) {
  console.error('No URLs found - refusing to submit an empty list.');
  process.exit(1);
}
if (urls.length > 10000) {
  console.error(`${urls.length} URLs exceeds IndexNow's 10,000-per-request limit - this script doesn't chunk yet.`);
  process.exit(1);
}

if (DRY_RUN) {
  console.log('--dry-run: would submit these URLs to', ENDPOINTS.map((e) => e.name).join(', '));
  for (const u of urls) console.log(' ', u);
  process.exit(0);
}

let accepted = 0;
for (const ep of ENDPOINTS) {
  try {
    const res = await submit(ep.url, urls);
    const text = await res.text();
    // 200(처리됨)·202(접수됨, 큐 대기)는 성공. 본문은 비어 있거나 최소한이다.
    if (res.status === 200 || res.status === 202) {
      accepted++;
      console.log(`[OK]   ${ep.name}: HTTP ${res.status} (${urls.length} URLs)`);
    } else {
      console.warn(`[FAIL] ${ep.name}: HTTP ${res.status} ${text.slice(0, 160)}`);
    }
  } catch (err) {
    console.warn(`[FAIL] ${ep.name}: ${err.name} ${err.message}`);
  }
}
if (accepted === 0) {
  console.error('모든 IndexNow 엔드포인트가 거절했습니다.');
  process.exit(1);
}
