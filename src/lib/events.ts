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
  note?: string;
  description?: string;
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
