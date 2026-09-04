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
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
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

async function submit(urlList) {
  const body = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return res;
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
  console.log('--dry-run: would submit these URLs to', INDEXNOW_ENDPOINT);
  for (const u of urls) console.log(' ', u);
  process.exit(0);
}

const res = await submit(urls);
const bodyText = await res.text();
// IndexNow success responses are 200 (processed) or 202 (accepted, still
// queued) with an empty or minimal body - not an error if bodyText is empty.
if (res.status === 200 || res.status === 202) {
  console.log(`IndexNow submission accepted (HTTP ${res.status}) for ${urls.length} URLs.`);
} else {
  console.error(`IndexNow submission failed: HTTP ${res.status} ${res.statusText}`);
  if (bodyText) console.error(bodyText);
  process.exit(1);
}
