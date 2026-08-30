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
 *
 * POSTER IMAGES (added 2026-08-29): the list endpoint above (pblprfr) never returns
 * a poster. KOPIS's separate *detail* endpoint (pblprfr/{mt20id}) does, in a <poster>
 * tag — real government open data, safe to use directly (no scraping/rehosting risk
 * the way an unofficial promoter poster would be). Only candidates that already
 * survived the venue-whitelist + dedup filters get a detail call, one at a time with
 * a short delay between requests to be polite to a public API. A failed/missing
 * poster for one candidate never aborts the run — it just ships with posterUrl: ''.
 * International-tour events entered by hand in events.json are NOT covered by this —
 * KOPIS doesn't list most of them, so their posters (if added) stay a manual,
 * copyright-conscious job (link to the official source rather than rehosting art).
 *
 * FESTIVALS WERE NEVER FETCHED AT ALL (found + fixed 2026-08-29): this script only
 * ever called KOPIS's general performance-list endpoint (pblprfr) with
 * shcate=CCCD (대중음악), which is why every festival on this site — all 7 of
 * them, KOPIS-sourced or not — has always shipped with posterUrl: ''. KOPIS does
 * NOT file festivals under a concert genre code at all; it has a wholly separate
 * REST resource for them, `prffest` (confirmed via a third-party KOPIS API
 * wrapper's source — github.com/jinwooYoon/kopisapi — which documents both
 * `pblprfr` and `prffest` as sibling endpoints sharing the same request shape
 * (service/stdate/eddate/cpage/rows/shcate/signgucode) and the same response shape
 * (<dbs><db>...). This script now also queries `prffest` (see fetchKopisFestivalsRaw
 * below) and runs its survivors through the exact same venue-whitelist, dedup and
 * per-item poster-detail-call pipeline as concerts, tagging them genre: '페스티벌'.
 * UNVERIFIED against a live response (same kopis.or.kr network block as the rest of
 * this file — see the class doc above) — confirm field names/poster presence on
 * the next real `npm run fetch:kopis` run, same as the original poster feature was.
 *
 * J-POP AUTO-PUBLISH PIPELINE (added 2026-08-30, site-owner request):
 * KOPIS has no nationality/genre field - `genrenm` is always the same generic
 * "대중음악" bucket for a K-indie livehouse show and a touring J-pop act alike (see
 * README's 2026-08-30 note). The major-venue whitelist below (VENUE_CITY_MAP) was
 * doubling as an accidental "is this probably a real touring act" filter, which
 * meant small/club-tier J-pop shows never surfaced at all. Per an explicit decision
 * to prioritize catching minor J-pop artists over filtering noise:
 *   - Every raw KOPIS title is checked against scripts/jpop-artists.mjs
 *     (matchJpopArtist below) - a maintained name whitelist (Korean transliteration
 *     + romaji/English aliases), chosen over a Japanese-script heuristic because a
 *     stage name written entirely in Korean (e.g. "후지이 카제") would not contain
 *     any Japanese characters to detect.
 *   - A match BYPASSES the VENUE_CITY_MAP whitelist entirely (arena or livehouse,
 *     it still ships) and is written straight into src/data/events.json - no PR/
 *     hand-copy step - since the whole point was to stop losing minor shows to
 *     manual curation. City comes from KOPIS's own <area> field (metro-level, e.g.
 *     "서울특별시" -> "서울") when the venue isn't one of the already-known
 *     VENUE_CITY_MAP entries, so a club show doesn't get dropped just for missing a
 *     precise city (see resolveCityForJpop/normalizeArea below).
 *   - A non-match keeps the exact pre-existing behavior: VENUE_CITY_MAP filter,
 *     staged in kopis-candidates.json for hand review. This pipeline only changes
 *     what happens to KOPIS titles that match the J-pop artist list.
 * TRADE-OFF (accepted, not a bug): auto-published J-pop entries only carry the bare
 * KOPIS fields (artist/venue/city/dates/poster) - none of the hand-researched
 * description/funFacts/sources/setlists/presale/youtubeVideos every other event on
 * this site has (those fields are optional in ConcertEvent, so nothing breaks, but
 * these entries will look noticeably thinner than a hand-curated page). A `note`
 * on each auto-added entry says so plainly for anyone reading the raw data later.
 * A missed brand-new/very obscure artist not yet in jpop-artists.mjs is silently
 * skipped rather than mis-filed - extend that file by hand as new acts are found.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JPOP_ARTISTS } from './jpop-artists.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_PATH = path.join(__dirname, '..', 'src', 'data', 'events.json');
const CANDIDATES_PATH = path.join(__dirname, '..', 'src', 'data', 'kopis-candidates.json');

const SERVICE_KEY = process.env.KOPIS_SERVICE_KEY;
// Verified live on 2026-08-27 by actually calling the API: CCCD returned real
// concert/festival entries (윤종신, 10CM, 자라섬재즈페스티벌, etc). An earlier guess,
// BBBF, returned zero results for the same date range and was wrong - don't reuse it.
const CONCERT_GENRE_CODE = 'CCCD';

// KOPIS endpoint for the pblprfr (general performance) list — kept as a named
// constant now that a second endpoint (FESTIVAL_ENDPOINT below) exists alongside it.
const CONCERT_ENDPOINT = 'pblprfr';
// Festivals are NOT under a genre code within pblprfr — they live at this sibling
// REST resource instead (see the FESTIVALS WERE NEVER FETCHED AT ALL header note).
// UNVERIFIED against a live response; confirm on the next real fetch:kopis run.
const FESTIVAL_ENDPOINT = 'prffest';

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
  '엑스코': '대구', // NOT also 'EXCO' - that's a substring of 'BEXCO' (Busan) and matched it first, see troubleshooting log in README
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
  '파라다이스시티': '인천', // added 2026-08-27 after manually curating XMF 2026
};

function resolveCity(venue) {
  for (const [key, city] of Object.entries(VENUE_CITY_MAP)) {
    if (venue.includes(key)) return city;
  }
  return null;
}

// KOPIS's own <area> field (added to the extractor 2026-08-30 - see fetchKopisList),
// a metro-level region name like "서울특별시" or "경기도". Used only for
// J-pop-matched shows at a venue NOT already in VENUE_CITY_MAP, so a small livehouse
// show still gets a real city instead of being dropped for lacking one. Deliberately
// NOT used for the non-J-pop candidates path below - that filter's whole job is
// "only venues we already trust", and giving it a city via <area> would let every
// registered concert in the country through, defeating the whitelist entirely.
const AREA_CITY_MAP = {
  '서울특별시': '서울',
  '부산광역시': '부산',
  '대구광역시': '대구',
  '인천광역시': '인천',
  '광주광역시': '광주',
  '대전광역시': '대전',
  '울산광역시': '울산',
  '세종특별자치시': '세종',
  '경기도': '경기',
  '강원도': '강원',
  '강원특별자치도': '강원',
  '충청북도': '충북',
  '충청남도': '충남',
  '전라북도': '전북',
  '전북특별자치도': '전북',
  '전라남도': '전남',
  '경상북도': '경북',
  '경상남도': '경남',
  '제주특별자치도': '제주',
  '제주도': '제주',
};

function normalizeArea(area) {
  if (!area) return null;
  if (AREA_CITY_MAP[area]) return AREA_CITY_MAP[area];
  for (const [key, city] of Object.entries(AREA_CITY_MAP)) {
    if (area.includes(key)) return city;
  }
  return area; // unrecognized format - use KOPIS's raw area string rather than dropping the show
}

// City resolution for J-pop-matched shows only: prefer the precise VENUE_CITY_MAP
// entry when we have one (keeps e.g. KINTEX -> its curated city instead of the
// coarser province-level name from <area>), otherwise fall back to KOPIS's area.
function resolveCityForJpop(venue, area) {
  return resolveCity(venue) ?? normalizeArea(area) ?? null;
}

// Returns the canonical name from JPOP_ARTISTS if `title` (a raw KOPIS prfnm)
// matches a known J-pop artist, else null. Non-Latin aliases (Korean
// transliteration, kanji/hiragana/katakana) match by substring after the same
// normalization used for dedup elsewhere in this file - real collisions between
// an artist's Korean stage-name spelling and unrelated Korean text are very rare.
// Latin-script aliases are matched against the RAW (unnormalized) title with a
// word-boundary regex instead, so a short alias like "Eve" or "SiM" can't fire
// inside an unrelated word (e.g. "everyone") - normalizeForMatch strips spaces/
// punctuation entirely, which would defeat any boundary check if used here.
// Hangul syllable block - used by hangulBoundaryOk to tell "glued onto another
// Korean word" apart from "a real word boundary" for non-Latin alias matches.
const HANGUL_RE = /[\uAC00-\uD7A3]/;

// Common single/multi-syllable particles (조사) that can legitimately attach
// directly to a Korean name with no space (e.g. "카제가", "카제는") - added
// 2026-08-30 after a live bug (see below) proved plain substring matching on
// short Korean aliases is not safe. Not exhaustive, but covers the common cases;
// an unlisted particle just means that one specific phrasing gets missed rather
// than mis-published, which is the safer failure direction here.
const KOREAN_PARTICLES = [
  '에서', '으로', '부터', '까지', '에게', '한테', '처럼', '같이', '보다', '마저', '조차',
  '이나', '이란', '이라', '이', '가', '은', '는', '을', '를', '의', '에', '와', '과',
  '도', '만', '랑', '나', '요', '께', '로',
];

// Whether a non-Latin alias match at title[start:end] sits on a real word
// boundary rather than being glued to a longer, unrelated Korean word. Rejects
// if immediately preceded by another Hangul syllable (glued onto a preceding
// word - a real name is never mid-word) or immediately followed by a Hangul
// syllable that doesn't start a known particle (glued onto a following word,
// e.g. "레오나" inside "레오나르도"). Anything non-Hangul (space, punctuation,
// Latin, digit, string start/end) is always a safe boundary.
function hangulBoundaryOk(text, start, end) {
  const before = start > 0 ? text[start - 1] : '';
  if (before && HANGUL_RE.test(before)) return false;
  const after = text.slice(end);
  if (after.length === 0 || !HANGUL_RE.test(after[0])) return true;
  return KOREAN_PARTICLES.some((p) => after.startsWith(p));
}

// Returns the canonical name from JPOP_ARTISTS if `title` (a raw KOPIS prfnm)
// matches a known J-pop artist, else null. Latin-script aliases are matched
// against the RAW title with a word-boundary regex, so a short alias like "Eve"
// or "SiM" can't fire inside an unrelated word (e.g. "everyone"). Non-Latin
// (Korean/kanji/hiragana/katakana) aliases are ALSO matched against the raw
// title (not the punctuation-stripped normalizeForMatch() form used elsewhere in
// this file for dedup - stripping spaces here would destroy the very boundary
// information hangulBoundaryOk needs) and additionally must pass hangulBoundaryOk.
//
// BUG THAT MADE THIS NECESSARY (found live 2026-08-30, session 5, second live
// run after the MAX_LIST_PAGES pagination fix surfaced far more raw titles to
// check against): "대전국제기타페스티벌: 레오나르도 브라보, 페스티벌 앙상블" (a
// classical guitar festival) matched artist "ReoNa" because her 3-char Korean
// alias "레오나" is a literal substring of "레오나르도" (Leonardo). Raising the
// minimum alias length (the 2026-08-30 fix for the earlier 리사/리사이틀 bug,
// see README) does NOT catch this - "레오나" already passed the length-3 floor.
// A length threshold alone can never fully solve "is this alias glued onto a
// longer unrelated word" - only a real boundary check can.
function matchJpopArtist(title) {
  for (const entry of JPOP_ARTISTS) {
    for (const alias of entry.aliases) {
      const isLatin = /^[\x00-\x7f]+$/.test(alias);
      if (isLatin) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
        if (re.test(title)) return entry.name;
      } else {
        if (alias.length < 3) continue;
        let idx = title.indexOf(alias);
        while (idx !== -1) {
          if (hangulBoundaryOk(title, idx, idx + alias.length)) return entry.name;
          idx = title.indexOf(alias, idx + 1);
        }
      }
    }
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

// Shared list-fetch for both KOPIS endpoints — pblprfr (concerts, filtered to
// CONCERT_GENRE_CODE) and prffest (festivals; no shcate filter, since a festival's
// own internal genre is beside the point — see FESTIVAL_ENDPOINT above). Tags every
// row with `sourceEndpoint` and `genre` so downstream code (the poster detail call,
// the candidate's genre field) doesn't need to re-derive which list it came from.
// Max list pages to fetch per endpoint (at rows=100/page, 30 pages = up to 3000
// listings). Live-tested 2026-08-30: a 6-month concerts window alone returned 435
// results (5 pages) and festivals 413 (5 pages) - MAX_LIST_PAGES leaves generous
// headroom above that so a real busy season can't silently get truncated the same
// way the old cpage:'1'-only version was (see PAGINATION BUG note below). This is
// a safety valve against a runaway loop, not an expected ceiling.
const MAX_LIST_PAGES = 30;

async function fetchKopisList(endpoint, { shcate, genre } = {}) {
  if (!SERVICE_KEY) {
    console.error('Missing KOPIS_SERVICE_KEY env var. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  // PAGINATION BUG (found + fixed 2026-08-30, session 5): this function used to
  // fetch only cpage:'1' and assume 100 rows was "the results". Live-tested against
  // real KOPIS data this session and confirmed that's wrong - a routine 6-month
  // window has 400+ concerts/festivals registered, so a single 100-row page was
  // silently discarding roughly 3 out of every 4 listings. This is almost
  // certainly why the first live run of the J-pop auto-publish pipeline (added the
  // same session) found 0 new matches - it was only ever looking at a small,
  // arbitrarily-ordered slice of what KOPIS actually has. Fixed by looping cpage
  // until a page comes back with fewer than `rows` results (the real last page).
  // rows itself stays capped at 100 - confirmed live that rows=200/500 both
  // silently return 0 results (not an error), same behavior noted (but never
  // proven live) in the original 2026-08-27 comment this replaces.
  const collected = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const params = new URLSearchParams({
      service: SERVICE_KEY,
      stdate: todayISO(),
      eddate: monthsFromNowISO(6),
      cpage: String(page),
      rows: '100', // KOPIS silently returns 0 results for rows>100 (confirmed live 2026-08-30) - do not raise
      ...(shcate ? { shcate } : {}),
    });
    const url = `https://www.kopis.or.kr/openApi/restful/${endpoint}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`KOPIS request failed (${endpoint} page ${page}): ${res.status}`);
    const xml = await res.text();

    const ids = extractTag(xml, 'mt20id');
    if (ids.length === 0) break; // past the last page

    const names = extractTag(xml, 'prfnm');
    const startDates = extractTag(xml, 'prfpdfrom');
    const endDates = extractTag(xml, 'prfpdto');
    const venues = extractTag(xml, 'fcltynm');
    // Metro-level region (e.g. "서울특별시") - added 2026-08-30 for the J-pop
    // pipeline's resolveCityForJpop fallback; unused by the pre-existing non-J-pop path.
    const areas = extractTag(xml, 'area');

    for (let i = 0; i < ids.length; i++) {
      collected.push({
        kopisId: ids[i],
        artist: unescapeXml(names[i] ?? '(제목 확인 필요)'),
        venue: unescapeXml(venues[i] ?? ''),
        area: unescapeXml(areas[i] ?? ''),
        startDate: (startDates[i] ?? '').replaceAll('.', '-'),
        endDate: (endDates[i] ?? startDates[i] ?? '').replaceAll('.', '-'),
        sourceEndpoint: endpoint,
        genre,
      });
    }

    if (ids.length < 100) break; // partial page = definitely the last one
    if (page === MAX_LIST_PAGES) {
      console.warn(`  WARNING: hit MAX_LIST_PAGES (${MAX_LIST_PAGES}) fetching ${endpoint} - there may be more results than were fetched. Raise MAX_LIST_PAGES if this keeps happening.`);
    }
    await sleep(200); // be polite between list-page requests, same spirit as the detail-call delay below
  }
  return collected;
}

async function fetchKopisRaw() {
  return fetchKopisList(CONCERT_ENDPOINT, { shcate: CONCERT_GENRE_CODE, genre: '콘서트' });
}

async function fetchKopisFestivalsRaw() {
  return fetchKopisList(FESTIVAL_ENDPOINT, { genre: '페스티벌' });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetches the KOPIS *detail* record for one item and pulls its <poster> image URL,
// if any. `endpoint` is whichever list resource the item came from (pblprfr or
// prffest) — RESTful symmetry suggests each has its own /{id} detail route, but
// that's UNVERIFIED for prffest specifically (see the FESTIVALS WERE NEVER FETCHED
// AT ALL header note), so a festival item that 404s/empties there falls back to the
// general pblprfr detail route once, in case festival mt20ids resolve there too.
// Never throws past its own boundary — a missing poster is not worth failing the
// whole fetch run over.
async function fetchKopisDetailPoster(kopisId, endpoint) {
  const params = new URLSearchParams({ service: SERVICE_KEY });
  const fetchPosterFrom = async (ep) => {
    const url = `https://www.kopis.or.kr/openApi/restful/${ep}/${kopisId}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, status: res.status };
    const xml = await res.text();
    const [poster] = extractTag(xml, 'poster');
    return { ok: true, poster: poster ? unescapeXml(poster) : '' };
  };
  try {
    const result = await fetchPosterFrom(endpoint);
    if (result.ok) return result.poster;
    console.warn(`  poster lookup failed for ${kopisId} via ${endpoint}: HTTP ${result.status}`);
    if (endpoint !== CONCERT_ENDPOINT) {
      const fallback = await fetchPosterFrom(CONCERT_ENDPOINT);
      if (fallback.ok) return fallback.poster;
      console.warn(`  poster lookup fallback (${CONCERT_ENDPOINT}) also failed for ${kopisId}: HTTP ${fallback.status}`);
    }
    return '';
  } catch (err) {
    console.warn(`  poster lookup failed for ${kopisId}: ${err.message}`);
    return '';
  }
}

async function main() {
  const existing = JSON.parse(await readFile(EVENTS_PATH, 'utf-8'));
  const existingIds = new Set(existing.map((e) => e.id));
  const existingArtistKeys = new Set(existing.map((e) => normalizeForMatch(e.artist)));
  const existingVenueDatePairs = new Set(
    existing.filter((e) => e.venue && e.startDate).map((e) => `${e.venue}__${e.startDate}`)
  );
  // (artist, date) dedup for the J-POP PATH specifically (added 2026-08-30, second
  // live-test fix): existingArtistKeys/existingVenueDatePairs above compare exact
  // strings, but a raw KOPIS title ("back number 내한공연: Grateful Yesterdays Tour
  // [서울]") almost never exactly equals a hand-curated events.json `artist` field
  // ("back number (백넘버)"), and the SAME real show can be registered in KOPIS
  // under a differently-worded venue string than the one already curated (e.g.
  // "킨텍스" vs "KINTEX", "인스파이어 엔터테인먼트 리조트" vs "인스파이어 아레나") -
  // both of those real cases slipped past the string-exact checks in live testing.
  // Running every EXISTING event's artist field back through matchJpopArtist gives
  // a semantic key (canonical artist, exact date) that catches both: the same
  // artist already published for that date, regardless of how the venue or title
  // happens to be spelled this time.
  const existingJpopDates = new Set();
  for (const e of existing) {
    const m = matchJpopArtist(e.artist);
    if (m) existingJpopDates.add(`${m}__${e.startDate}`);
  }

  const [concertRaw, festivalRaw] = await Promise.all([fetchKopisRaw(), fetchKopisFestivalsRaw()]);

  // A big festival can also show up as its own entry in the general concert list
  // (or vice versa) - dedupe the combined pool by kopisId before filtering so it
  // never gets processed (and poster-detail-called) twice under two genre labels.
  const seenKopisIds = new Set();
  const raw = [];
  for (const r of [...concertRaw, ...festivalRaw]) {
    if (seenKopisIds.has(r.kopisId)) continue;
    seenKopisIds.add(r.kopisId);
    raw.push(r);
  }

  const candidates = [];
  const jpopAdded = [];
  let droppedNoVenueMatch = 0;
  let droppedDuplicate = 0;
  let postersFound = 0;

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

    const jpopMatch = matchJpopArtist(r.artist);

    if (jpopMatch) {
      // J-POP PATH (2026-08-30): no venue-whitelist gate at all - every matched
      // J-pop show ships, arena or livehouse alike. See the J-POP AUTO-PUBLISH
      // PIPELINE header comment above for the full rationale.
      const jpopKey = `${jpopMatch}__${r.startDate}`;
      if (existingJpopDates.has(jpopKey)) {
        // Already published (from a prior run) OR already added earlier THIS run
        // (e.g. the same real show registered in KOPIS under two different
        // mt20ids/titles - both a Korean-titled and an English-titled listing for
        // the same date have both shown up live). See existingJpopDates above.
        droppedDuplicate++;
        continue;
      }
      const city = resolveCityForJpop(r.venue, r.area);
      const posterUrl = await fetchKopisDetailPoster(r.kopisId, r.sourceEndpoint);
      if (posterUrl) postersFound++;
      await sleep(300); // be polite to a shared public API between detail calls
      jpopAdded.push({
        id,
        artist: r.artist,
        genre: 'J-POP',
        venue: r.venue,
        city: city ?? '확인 필요',
        startDate: r.startDate,
        endDate: r.endDate,
        posterUrl,
        note:
          'KOPIS 공공데이터로 자동 수집된 공연입니다 (매칭 아티스트 포함 자동 게시). ' +
          '설명/펀팩트/선예매 등 상세 정보는 아직 없어요 - 필요하면 직접 보강해주세요.',
      });
      existingJpopDates.add(jpopKey);
      continue;
    }

    // NON-J-POP PATH: unchanged pre-existing behavior - major-venue whitelist
    // required, written to the staging candidates file for manual review.
    const city = resolveCity(r.venue);
    if (!city) {
      droppedNoVenueMatch++;
      continue;
    }
    // Only reached for candidates that already survived every filter above, so this
    // never fires more than once per genuinely new listing (raw results are usually
    // ~100, surviving candidates are usually single digits - see README log).
    const posterUrl = await fetchKopisDetailPoster(r.kopisId, r.sourceEndpoint);
    if (posterUrl) postersFound++;
    await sleep(300); // be polite to a shared public API between detail calls
    candidates.push({
      id,
      artist: r.artist,
      genre: r.genre,
      venue: r.venue,
      city,
      startDate: r.startDate,
      endDate: r.endDate,
      ticketUrl: '',
      officialUrl: '',
      posterUrl,
      note: 'KOPIS 자동 수집 후보 - 실제 게시 전 events.json에 직접 옮기고 링크를 보강하세요.',
    });
  }

  candidates.sort((a, b) => a.startDate.localeCompare(b.startDate));
  await writeFile(CANDIDATES_PATH, JSON.stringify(candidates, null, 2) + '\n');

  if (jpopAdded.length > 0) {
    const merged = [...existing, ...jpopAdded].sort((a, b) => a.startDate.localeCompare(b.startDate));
    await writeFile(EVENTS_PATH, JSON.stringify(merged, null, 2) + '\n');
  }

  console.log(`KOPIS raw results: ${raw.length} (concerts: ${concertRaw.length}, festivals: ${festivalRaw.length}, after cross-endpoint dedupe: ${raw.length})`);
  if (concertRaw.length === 0 || festivalRaw.length === 0) {
    console.warn(
      `WARNING: one KOPIS endpoint returned 0 raw results (concerts: ${concertRaw.length}, ` +
      `festivals: ${festivalRaw.length}). This usually means the API rejected a request ` +
      'parameter (e.g. rows/date range) rather than "nothing in range" - check the KOPIS ' +
      'response manually if this keeps happening. (The prffest festival endpoint is newer ' +
      'and UNVERIFIED against a live response - 0 results there specifically could also mean ' +
      'the endpoint name or param shape is wrong, see the header comment.)'
    );
  }
  console.log(`J-pop matches auto-published to events.json: ${jpopAdded.length}`);
  if (jpopAdded.length > 0) {
    for (const e of jpopAdded) console.log(`  + ${e.artist} - ${e.venue} (${e.city}) ${e.startDate}`);
  }
  console.log(`Dropped (already in events.json / duplicate): ${droppedDuplicate}`);
  console.log(`Dropped (non-J-pop, venue not in whitelist, see VENUE_CITY_MAP): ${droppedNoVenueMatch}`);
  console.log(`Posters found via KOPIS detail API: ${postersFound}/${candidates.length + jpopAdded.length}`);
  console.log(`Wrote ${candidates.length} non-J-pop candidate(s) to src/data/kopis-candidates.json`);
  console.log('kopis-candidates.json is NOT read by the site - review it and hand-copy anything worth publishing into events.json.');
  console.log('J-pop matches (any venue) were written directly into src/data/events.json - the site will render them on the next build/deploy.');
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
