#!/usr/bin/env node
// Computes the current "보강(enrichment) 워치 리스트": events that were published
// with only the bare minimum (shuttle-scan auto-discovery, KOPIS auto-fetch) and
// are still missing the baseline narrative fields that hand-researched events
// have - description/funFacts/sources, and usually posterUrl.
//
// This exists because shuttle-scan publishes the instant it cross-verifies a
// show (so discovery stays fast), which leaves those events reading noticeably
// thinner than events researched directly in a session. This script is the
// enrichment-routine's equivalent of merch-watch-list.mjs: read-only, prints
// JSON to stdout, sorted by priority. The enrichment routine reads this each
// pass to know which events to research, then edits src/data/events.json
// directly (never this script) to add real description/funFacts/sources/
// posterUrl/etc. Never invent data to fill a gap this script surfaces - leave
// it empty and move on, same as every other field on this project.
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

// The baseline narrative fields every hand-researched event has. Missing any
// of these is what "정보가 얇다" means in practice - not the niche/opportunistic
// fields (setlists, presale, shuttleBus, ...) that most events lack regardless
// of how they were added.
const BASELINE_FIELDS = ['description', 'funFacts', 'sources'];

function missingBaselineFields(e) {
  return BASELINE_FIELDS.filter((f) => {
    const v = e[f];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  });
}

// Which pipeline published this event originally - purely informational, so a
// human (or the routine's own log) can see whether the gap tracks the known
// thin tiers (shuttle-scan, kopis auto-fetch) or is a one-off from elsewhere.
// Not every shuttle-scan event got a `shuttle-` id prefix (some early ones were
// given a descriptive id instead) - the `note` field is the reliable signal, so
// check both.
function sourceTier(e) {
  if (e.id.startsWith('shuttle-') || (e.note ?? '').includes('셔틀 스캔')) return 'shuttle-scan';
  if (e.id.startsWith('kopis-')) return 'kopis-fetch';
  return 'other';
}

const watchList = events
  .filter((e) => e.status !== 'cancelled')
  .map((e) => ({ e, missing: missingBaselineFields(e), daysUntilShow: daysUntil(e.endDate || e.startDate) }))
  .filter(({ missing }) => missing.length > 0)
  .filter(({ daysUntilShow }) => daysUntilShow >= -7) // skip shows that passed a while ago
  .map(({ e, missing, daysUntilShow }) => ({
    id: e.id,
    artist: e.artist,
    sourceTier: sourceTier(e),
    daysUntilShow,
    missingFields: missing,
    hasPosterUrl: Boolean(e.posterUrl),
    officialUrl: e.officialUrl ?? null,
    ticketUrl: e.ticketUrl ?? null,
    officialSns: e.officialSns ?? [],
    enrichmentCheckedAt: e.enrichmentCheckedAt ?? null,
  }))
  // Never-checked events first, then by how soon the show is (soonest = most
  // reader-facing value from filling it in now).
  .sort((a, b) => {
    const aChecked = a.enrichmentCheckedAt ? 1 : 0;
    const bChecked = b.enrichmentCheckedAt ? 1 : 0;
    if (aChecked !== bChecked) return aChecked - bChecked;
    return a.daysUntilShow - b.daysUntilShow;
  });

console.log(JSON.stringify(watchList, null, 2));
