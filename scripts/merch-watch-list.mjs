#!/usr/bin/env node
// Computes the current "MD 굿즈 워치 리스트": events whose ticketing has already
// opened, that don't have full `merch` data yet, and that haven't happened yet.
// Read-only - prints JSON to stdout, sorted by how soon the show is.
//
// This exists because MD/굿즈 사전예약 info is a one-time, time-boxed window
// (unlike 운영공지, which stays useful right up to the show) - if it's found
// too late the reservation window may already be closed. The merch-watch
// Local Routine runs this each pass to know which events to research, then
// edits src/data/events.json directly (never this script) to add real
// `merch` / `updates` / `officialSns` / `merchCheckedAt` data. Never invent
// data to fill a gap this script surfaces - leave it empty if nothing real
// is found, same as every other field on this project.
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

// Once a show is this close (or closer), also check the known official SNS
// account (if any) - see officialSns in lib/events.ts and the standing
// "on-demand social-media checks" policy: bounded to one known account, one
// event, this window - never a general sweep.
const SNS_CHECK_WINDOW_DAYS = 30;

const watchList = events
  .filter((e) => e.status !== 'cancelled')
  .filter((e) => !e.ticketingAnnounced) // ticketing must have actually opened
  .filter((e) => !e.merch || e.merch.length === 0) // no full merch data yet
  .map((e) => ({ e, daysUntilShow: daysUntil(e.endDate || e.startDate) }))
  .filter(({ daysUntilShow }) => daysUntilShow >= 0) // show hasn't passed
  .map(({ e, daysUntilShow }) => ({
    id: e.id,
    artist: e.artist,
    daysUntilShow,
    withinSnsWindow: daysUntilShow <= SNS_CHECK_WINDOW_DAYS,
    hasKnownSnsAccount: Boolean(e.officialSns && e.officialSns.length > 0),
    officialSns: e.officialSns ?? [],
    mdUrl: e.mdUrl ?? null,
    ticketUrl: e.ticketUrl ?? null,
    ticketLinks: e.ticketLinks ?? [],
    officialUrl: e.officialUrl ?? null,
    sources: e.sources ?? [],
    merchCheckedAt: e.merchCheckedAt ?? null,
  }))
  .sort((a, b) => a.daysUntilShow - b.daysUntilShow);

console.log(JSON.stringify(watchList, null, 2));
