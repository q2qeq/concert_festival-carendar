#!/usr/bin/env node
// Computes the current "떼창·콜 가이드 워치 리스트": events whose show is coming
// up soon (roughly within a week - see WINDOW_DAYS) that don't have a real,
// sourced `fanChantGuide` entry yet. Read-only - prints JSON to stdout, sorted
// by how soon the show is.
//
// Why a window instead of "as soon as the event is published": official
// 응원법/콜 가이드 material (fan-made or agency-distributed) usually doesn't
// exist yet for a show that's months away, so searching early just wastes a
// pass finding nothing. Waiting until the show is close means a search is far
// more likely to find something real, if it exists at all - and
// FanChantGuide.astro's generic YouTube/네이버블로그/나무위키 search links are
// already live on every event page regardless of this data, so nothing is
// missing for readers in the meantime.
//
// A Local Routine runs this each pass to know which events to research, then
// edits src/data/events.json directly (never this script) to add a real
// `fanChantGuide` entry ({ title, url, note? }) + `fanChantGuideCheckedAt`.
// Same absolute rule as every other field on this project: never invent a
// guide or generate chant timing/lyrics ourselves - only ever link a real,
// credited, already-published guide. If nothing real is found, just update
// `fanChantGuideCheckedAt` so the same event isn't re-searched again the same
// week.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventsPath = path.join(__dirname, '../src/data/events.json');
const events = JSON.parse(readFileSync(eventsPath, 'utf-8'));

const today = new Date();
today.setHours(0, 0, 0, 0);

function daysUntil(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((d - today) / 86400000);
}

// "공연 일주일 전" ± a few days of slack either side, so a weekly-cadence
// Routine run doesn't skip a show that lands between two passes.
const WINDOW_START_DAYS = 0;
const WINDOW_END_DAYS = 10;

// Once we've checked and found nothing, don't re-check again for this many
// days (avoids re-searching the same "still nothing" event every single run
// during its window).
const RECHECK_COOLDOWN_DAYS = 4;

const watchList = events
  .filter((e) => e.status !== 'cancelled')
  .filter((e) => !e.fanChantGuide || e.fanChantGuide.length === 0)
  .map((e) => ({ e, daysUntilShow: daysUntil(e.startDate) }))
  .filter(({ daysUntilShow }) => daysUntilShow >= WINDOW_START_DAYS && daysUntilShow <= WINDOW_END_DAYS)
  .filter(({ e }) => {
    if (!e.fanChantGuideCheckedAt) return true;
    const lastChecked = new Date(`${e.fanChantGuideCheckedAt}T00:00:00`);
    const daysSinceCheck = Math.round((today - lastChecked) / 86400000);
    return daysSinceCheck >= RECHECK_COOLDOWN_DAYS;
  })
  .map(({ e, daysUntilShow }) => ({
    id: e.id,
    artist: e.artist,
    genre: e.genre,
    daysUntilShow,
    officialUrl: e.officialUrl ?? null,
    officialSns: e.officialSns ?? [],
    fanclubUrl: e.fanclubUrl ?? null,
    sources: e.sources ?? [],
    fanChantGuideCheckedAt: e.fanChantGuideCheckedAt ?? null,
  }))
  .sort((a, b) => a.daysUntilShow - b.daysUntilShow);

console.log(JSON.stringify(watchList, null, 2));
