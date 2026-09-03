#!/usr/bin/env node
// Computes the current "티켓 판매처 워치 리스트": on-sale events that currently
// list zero or only one real ticket vendor, so a person can periodically check
// whether the show is actually also sold through other vendors (인터파크/NOL,
// YES24, 티켓링크, 멜론티켓, 예매처 등) and only one happened to get entered.
// Read-only - prints JSON to stdout, sorted by how soon the show is.
//
// This exists because a single-vendor listing is ambiguous: it might be
// genuinely exclusive (common for K-pop agency-run shows), or it might just be
// the one vendor that was found first while the show is actually also on sale
// elsewhere. Unlike merch/fanchant windows, this isn't a one-time gap - a show
// can add vendors over time as presales roll out - so re-check periodically
// even after ticketLinks already has one entry, using ticketLinksCheckedAt to
// avoid re-checking the same show same-day. The ticket-vendor-watch Local
// Routine runs this each pass, researches each candidate (official site,
// promoter notices, news coverage, KOPIS 예매처 field), and edits
// src/data/events.json directly (never this script) to add any real
// additional vendor found. Never invent a vendor that wasn't actually
// confirmed selling the show - leave it as-is if only one real vendor exists.
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

// Once a show has been checked, skip re-checking it again the same day.
function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((today - d) / 86400000);
}

const watchList = events
  .filter((e) => e.status !== 'cancelled')
  .filter((e) => !e.ticketingAnnounced) // only shows actually on sale somewhere
  .map((e) => {
    const links = e.ticketLinks ? e.ticketLinks.slice() : [];
    const urls = new Set(links.map((l) => l.url));
    if (e.ticketUrl && !urls.has(e.ticketUrl)) {
      links.push({ vendor: '티켓 예매', url: e.ticketUrl });
    }
    return { e, links };
  })
  .filter(({ links }) => links.length <= 1) // 0 or 1 known vendor
  .filter(({ e }) => daysSince(e.ticketLinksCheckedAt) >= 1)
  .map(({ e, links }) => ({ e, daysUntilShow: daysUntil(e.endDate || e.startDate) }))
  .filter(({ daysUntilShow }) => daysUntilShow >= 0) // show hasn't passed
  .map(({ e, daysUntilShow }) => ({
    id: e.id,
    artist: e.artist,
    venue: e.venue,
    daysUntilShow,
    knownVendors: (e.ticketLinks ?? []).map((l) => l.vendor),
    ticketUrl: e.ticketUrl ?? null,
    officialUrl: e.officialUrl ?? null,
    sources: e.sources ?? [],
    ticketLinksCheckedAt: e.ticketLinksCheckedAt ?? null,
  }))
  .sort((a, b) => a.daysUntilShow - b.daysUntilShow);

console.log(JSON.stringify(watchList, null, 2));
