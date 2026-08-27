#!/usr/bin/env node
/**
 * Pulls upcoming concert listings from KOPIS (공연예술통합전산망), Korea's official
 * performing-arts open data service, and writes CANDIDATES to
 * src/data/kopis-candidates.json — it does NOT touch src/data/events.json.
 *
 * WHY A SEPARATE CANDIDATES FILE (changed 2026-08-27):
 * The first version of this script merged straight into events.json and was run
 * via a weekly GitHub Action that opened a PR. In practice `shcate=CCCD` ("대중음악
 * 콘서트") returns EVERY registered show under that KOPIS category, which is
 * dominated by small indie/club shows (홍대 소극장, 스튜디오 라이브 등) — a single
 * run pulled ~80 new "candidates," almost none of which fit this site's actual
 * scope (해외 아티스트 내한 공연 + 대형 페스티벌/아레나급 공연). Auto-merging that
 * into events.json would have buried the curated content in noise.
 *
 * So this script now:
 *   1. Only keeps entries whose venue matches a small whitelist of major venues
 *      (see VENUE_CITY_MAP below) — arenas, domes, stadiums, and other venues
 *      already used by this site's curated events. This also solves the
 *      "city is always empty" problem, since we already know the city for every
 *      whitelisted venue.
 *   2. Skips anything whose (venue, startDate) or artist name looks like it's
 *      already in events.json, so already-curated shows don't reappear.
 *   3. OVERWRITES src/data/kopis-candidates.json with the current result (not a
 *      running merge) — it's meant to be read, cherry-picked into events.json by
 *      hand with a real id/description, and then ignored. events.json is the only
 *      file the site actually renders (see src/lib/events.ts), so this file is
 *      inert to the live site even if it's out of date or never touched.
 *
 * WHY KOPIS AND NOT SCRAPING TICKET SITES:
 * - Interpark Ticket's robots.txt disallows crawling outright.
 * - Other ticket platforms have mixed rules and (separately from robots.txt) commercial
 *   terms of service that likely restrict automated data collection.
 * - KOPIS is a government-backed, public, sanctioned data source for exactly this kind
 *   of data — no ToS risk, no anti-bot fight.
 *
 * STATUS (updated 2026-08-27): registered + live-tested with a real KOPIS key.
 *   - Endpoint, params (service/stdate/eddate/cpage/rows/shcate), and the concert
 *     genre code (shcate=CCCD, verified live — NOT the commonly-guessed BBBF, which
 *     returned zero results) all confirmed working against real data.
 *   - KOPIS's coverage skews toward domestic acts/festivals/jazz; several major
 *     foreign arena tours (e.g. Post Malone, Charlie Puth) did NOT show up in test
 *     queries. Treat KOPIS as a supplement for domestic-leaning listings, not a full
 *     replacement for manually entering major international tours in events.json.
 *   - KOPIS keys expire 1 year after issue, and auto-cancel after 3 months of no use —
 *     the weekly GitHub Action (.github/workflows/fetch-kopis.yml) keeps this from
 *     going stale even between manual curation passes.
 *   - Run `npm run fetch:kopis` and inspect src/data/kopis-candidates.json, then
 *     hand-copy anything worth publishing into src/data/events.json yourself.
 *
 * KOPIS returns XML by default; this script asks for XML and parses it with a tiny
 * regex-based extractor to avoid adding an XML parser dependency for a scaffold —
 * swap in a real XML parser (e.g. fast-xml-parser) if this grows beyond a scaffold.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_PATH = path.join(__dirname, '..', 'src', 'data', 'events.json');
const CANDIDATES_PATH = path.join(__dirname, '..', 'src', 'data', 'kopis-candidates.json');

const SERVICE_KEY = process.env.KOPIS_SERVICE_KEY;
// Verified live on 2026-08-27 by actually calling the API: CCCD returned real
// concert/festival entries (윤종신, 10CM, 자라섬재즈페스티벌, etc). An earlier guess,
// BBBF, returned zero results for the same date range and was wrong - don't reuse it.
const CONCERT_GENRE_CODE = 'CCCD';

// Major venues this site already curates events at (extend as needed — anything
// NOT in this map gets dropped rather than published with a guessed/empty city).
// Substring-matched against KOPIS's `fcltynm` field, so partial/alternate names
// still hit (e.g. "KBS스포츠월드(아레나)" matches the "KBS스포츠월드" key).
const VENUE_CITY_MAP = {
  'KSPO DOME': '서울',
  '올림픽공원': '서울',
  '잠실종합운동장': '서울',
  '잠실실내체육관': '서울',
  '고척스카이돔': '서울',
  '장충체육관': '서울',
  'KBS스포츠월드': '서울',
  '상암월드컵경기장': '서울',
  '공감센터': '서울',
  'KINTEX': '고양',
  '고양종합운동장': '고양',
  '인스파이어 아레나': '인천',
  '인천문학경기장': '인천',
  '강릉아트센터': '강릉',
  '엑스코': '대구',
  'EXCO': '대구',
  '소향씨어터': '부산',
  '벡스코': '부산',
  'BEXCO': '부산',
  '사직실내체육관': '부산',
  '한국소리문화의전당': '전주',
  '밀양아리랑아트센터': '밀양',
  '평화누리': '파주',
  '자라섬': '가평',
  '창원실내체육관': '창원',
  '김대중컨벤션센터': '광주',
  '한밭종합운동장': '대전',
};

function resolveCity(venue) {
  for (const [key, city] of Object.entries(VENUE_CITY_MAP)) {
    if (venue.includes(key)) return city;
  }
  return null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function monthsFromNowISO(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 'g');
  return Array.from(xml.matchAll(re)).map((m) => m[1]);
}

// Very small XML entity unescape — KOPIS titles/venues commonly contain &amp; etc.
function unescapeXml(s) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function normalizeForMatch(s) {
  return s.toLowerCase().replace(/[\s()[\].,'"“”·:!?-]/g, '');
}

async function fetchKopisRaw() {
  if (!SERVICE_KEY) {
    console.error('Missing KOPIS_SERVICE_KEY env var. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  const params = new URLSearchParams({
    service: SERVICE_KEY,
    stdate: todayISO(),
    eddate: monthsFromNowISO(6),
    cpage: '1',
    rows: '100', // KOPIS rejected rows=200 (returned an empty result set, no error) - 100 is the verified-working value, don't raise it without testing against the real API first
    shcate: CONCERT_GENRE_CODE,
  });
  const url = `https://www.kopis.or.kr/openApi/restful/pblprfr?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KOPIS request failed: ${res.status}`);
  const xml = await res.text();

  const ids = extractTag(xml, 'mt20id');
  const names = extractTag(xml, 'prfnm');
  const startDates = extractTag(xml, 'prfpdfrom');
  const endDates = extractTag(xml, 'prfpdto');
  const venues = extractTag(xml, 'fcltynm');

  return ids.map((id, i) => ({
    kopisId: id,
    artist: unescapeXml(names[i] ?? '(제목 확인 필요)'),
    venue: unescapeXml(venues[i] ?? ''),
    startDate: (startDates[i] ?? '').replaceAll('.', '-'),
    endDate: (endDates[i] ?? startDates[i] ?? '').replaceAll('.', '-'),
  }));
}

async function main() {
  const existing = JSON.parse(await readFile(EVENTS_PATH, 'utf-8'));
  const existingIds = new Set(existing.map((e) => e.id));
  const existingArtistKeys = new Set(existing.map((e) => normalizeForMatch(e.artist)));
  const existingVenueDatePairs = new Set(
    existing.filter((e) => e.venue && e.startDate).map((e) => `${e.venue}__${e.startDate}`)
  );

  const raw = await fetchKopisRaw();

  const candidates = [];
  let droppedNoVenueMatch = 0;
  let droppedDuplicate = 0;

  for (const r of raw) {
    const id = `kopis-${r.kopisId}`;
    if (existingIds.has(id)) {
      droppedDuplicate++;
      continue;
    }
    if (existingArtistKeys.has(normalizeForMatch(r.artist))) {
      droppedDuplicate++;
      continue;
    }
    if (existingVenueDatePairs.has(`${r.venue}__${r.startDate}`)) {
      droppedDuplicate++;
      continue;
    }
    const city = resolveCity(r.venue);
    if (!city) {
      droppedNoVenueMatch++;
      continue;
    }
    candidates.push({
      id,
      artist: r.artist,
      genre: '콘서트',
      venue: r.venue,
      city,
      startDate: r.startDate,
      endDate: r.endDate,
      ticketUrl: '',
      officialUrl: '',
      note: 'KOPIS 자동 수집 후보 - 실제 게시 전 events.json에 직접 옮기고 링크를 보강하세요.',
    });
  }

  candidates.sort((a, b) => a.startDate.localeCompare(b.startDate));
  await writeFile(CANDIDATES_PATH, JSON.stringify(candidates, null, 2) + '\n');

  console.log(`KOPIS raw results: ${raw.length}`);
  if (raw.length === 0) {
    console.warn(
      'WARNING: KOPIS returned 0 raw results. This usually means the API rejected a ' +
      'request parameter (e.g. rows/date range) rather than "no concerts in range" - ' +
      'check the KOPIS response manually if this keeps happening.'
    );
  }
  console.log(`Dropped (already in events.json / duplicate): ${droppedDuplicate}`);
  console.log(`Dropped (venue not in whitelist, see VENUE_CITY_MAP): ${droppedNoVenueMatch}`);
  console.log(`Wrote ${candidates.length} candidate(s) to src/data/kopis-candidates.json`);
  console.log('This file is NOT read by the site — review it and hand-copy anything worth publishing into events.json.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
