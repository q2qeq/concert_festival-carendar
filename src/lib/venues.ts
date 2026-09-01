import raw from '../data/venues.json';

export interface VenueFood {
  name: string;
  desc: string;
}

export interface VenueInfo {
  address?: string;
  transit?: string[];
  parking?: string;
  nearbyFood?: VenueFood[];
  tip?: string;
}

const venues = raw as Record<string, VenueInfo>;

// Looks up shared transit/parking/food info by exact venue name. Multiple events
// at the same physical venue (e.g. two festivals both at 임진각 평화누리) reuse one
// entry here instead of repeating researched transit details per event.
export function getVenueInfo(venueName: string): VenueInfo | undefined {
  return venues[venueName];
}

export function allVenueNames(): string[] {
  return Object.keys(venues);
}

// URL-safe slugs for standalone venue pages (/venues/[slug]) - same rationale as
// events.ts's genre slug map: a handful of real venues, hand-picked English slugs
// read better in a URL than an auto-romanized one. New venues fall back to an
// encoded lowercase slug so nothing 404s before this map is updated.
const VENUE_SLUG_MAP: Record<string, string> = {
  '파주 임진각 평화누리': 'imjingak-peace-nuri',
  '임진각 평화누리': 'imjingak-peace-nuri',
  '킨텍스 제2전시장': 'kintex-hall2',
  'KSPO DOME': 'kspo-dome',
  '올림픽공원': 'olympic-park',
  'KINTEX': 'kintex',
  '인스파이어 아레나': 'inspire-arena',
  'KBS스포츠월드(아레나)': 'kbs-sportsworld-arena',
  '고양종합운동장': 'goyang-stadium',
  '파라다이스시티': 'paradise-city',
};
const SLUG_TO_VENUE: Record<string, string> = Object.fromEntries(
  Object.entries(VENUE_SLUG_MAP).map(([venue, slug]) => [slug, venue])
);

export function venueSlug(venueName: string): string {
  return VENUE_SLUG_MAP[venueName] ?? encodeURIComponent(venueName.toLowerCase());
}

export function venueFromSlug(slug: string): string | undefined {
  if (SLUG_TO_VENUE[slug]) return SLUG_TO_VENUE[slug];
  return allVenueNames().find((v) => venueSlug(v) === slug);
}
