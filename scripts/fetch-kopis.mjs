#!/usr/bin/env node
/**
 * Pulls upcoming concert listings from KOPIS (공연예술통합전산망), Korea's official
 * performing-arts open data service, and merges them into src/data/events.json.
 *
 * WHY KOPIS AND NOT SCRAPING TICKET SITES:
 * - Interpark Ticket's robots.txt disallows crawling outright.
 * - Other ticket platforms have mixed rules and (separately from robots.txt) commercial
 *   terms of service that likely restrict automated data collection.
 * - KOPIS is a government-backed, public, sanctioned data source for exactly this kind
 *   of data — no ToS risk, no anti-bot fight, and it's the source many existing Korean
 *   concert/performance apps already build on.
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
 *     run this on a schedule (see README) so the key doesn't go stale, and renew via
 *     kopis@gokams.or.kr before the 1-year mark.
 *   - Run `npm run fetch:kopis` and inspect src/data/events.json before publishing.
 *
 * KOPIS returns XML by default; this script asks for XML and parses it with a tiny
 * regex-based extractor to avoid adding an XML parser dependency for a scaffold —
 * swap in a real XML parser (e.g. fast-xml-parser) once you're building this out for
 * real production use.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_PATH = path.join(__dirname, '..', 'src', 'data', 'events.json');

const SERVICE_KEY = process.env.KOPIS_SERVICE_KEY;
// Verified live on 2026-08-27 by actually calling the API: CCCD returned real
// concert/festival entries (윤종신, 10CM, 자라섬재즈페스티벌, etc). An earlier guess,
// BBBF, returned zero results for the same date range and was wrong - don't reuse it.
const CONCERT_GENRE_CODE = 'CCCD';

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

async function fetchKopisList() {
  if (!SERVICE_KEY) {
    console.error('Missing KOPIS_SERVICE_KEY env var. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  const params = new URLSearchParams({
    service: SERVICE_KEY,
    stdate: todayISO(),
    eddate: monthsFromNowISO(6),
    cpage: '1',
    rows: '100',
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
    id: `kopis-${id}`,
    artist: names[i] ?? '(제목 확인 필요)',
    genre: '콘서트',
    venue: venues[i] ?? '',
    city: '',
    startDate: (startDates[i] ?? '').replaceAll('.', '-'),
    endDate: (endDates[i] ?? startDates[i] ?? '').replaceAll('.', '-'),
    ticketUrl: '',
    note: 'KOPIS 자동 수집 - 도시/장르 등 세부 정보 확인 후 게시하세요.',
  }));
}

async function main() {
  const existingRaw = await readFile(EVENTS_PATH, 'utf-8');
  const existing = JSON.parse(existingRaw);
  const fetched = await fetchKopisList();

  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const e of fetched) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  const merged = Array.from(byId.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  await writeFile(EVENTS_PATH, JSON.stringify(merged, null, 2) + '\n');
  console.log(`Merged ${fetched.length} KOPIS entries. Total events: ${merged.length}.`);
  console.log('Review src/data/events.json (especially city/genre for new KOPIS entries) before deploying.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
