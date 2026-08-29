import raw from '../data/events.json';

export interface ConcertEvent {
  id: string;
  artist: string;
  genre: string;
  venue: string;
  city: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  ticketUrl?: string; // official ticket vendor page for this specific show
  officialUrl?: string; // artist/tour official site or promoter's official event page
  mdUrl?: string; // official merch/goods store, only when a real one was found
  fanclubUrl?: string; // official fan club page, mostly relevant for K-pop/J-pop acts
  // Official poster image URL. For KOPIS-sourced domestic events this can be filled
  // automatically (scripts/fetch-kopis.mjs calls KOPIS's detail API, a legit gov
  // open-data source). For hand-entered international tours, only set this from a
  // real official source and prefer linking over rehosting — never generated,
  // scraped from an unofficial site, or fabricated.
  posterUrl?: string;
  // Headliner/confirmed-artist list. Required in spirit for genre === '페스티벌' -
  // events/[id].astro always renders a 라인업 section for festivals (showing a
  // "공개 예정" placeholder when this is empty) so the gap is visible rather than
  // silently missing. No API provides festival lineups, so this stays a manual,
  // sourced-from-the-official-announcement field - never guessed.
  lineup?: string[];
  note?: string;
  description?: string;
  // Absent/undefined is treated as 'scheduled'. Set when a show's status changes
  // after it was first published (e.g. a postponement announced in the news, not
  // something the KOPIS auto-fetch pipeline can detect on its own).
  status?: 'scheduled' | 'postponed' | 'cancelled';
}

export const events: ConcertEvent[] = (raw as ConcertEvent[]).slice();

export function sortedEvents(): ConcertEvent[] {
  return events.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function upcomingEvents(fromISO?: string): ConcertEvent[] {
  const from = fromISO ?? new Date().toISOString().slice(0, 10);
  return sortedEvents().filter((e) => e.endDate >= from);
}

export function pastEvents(fromISO?: string): ConcertEvent[] {
  const from = fromISO ?? new Date().toISOString().slice(0, 10);
  return sortedEvents().filter((e) => e.endDate < from);
}

export function allGenres(): string[] {
  return Array.from(new Set(events.map((e) => e.genre))).sort();
}

export function allCities(): string[] {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.city, (counts.get(e.city) ?? 0) + 1);
  // Most events first (bigger cities/venues surface first), alphabetical as tiebreak.
  return Array.from(counts.keys()).sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b, 'ko')
  );
}

export function monthLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}
