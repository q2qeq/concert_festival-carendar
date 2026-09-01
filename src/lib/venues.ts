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
  '강릉아트센터': 'gangneung-art-center',
  '한국소리문화의전당': 'sori-arts-center-jeonju',
  '소향씨어터': 'sohyang-theater-busan',
  '밀양아리랑아트센터': 'miryang-arirang-art-center',
  '공감센터': 'gonggam-center',
  '엑스코(EXCO)': 'exco-daegu',
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

// Venues where a shuttle bus (official free venue shuttle, or a promoter/third-
// party charter) is plausible enough that a reader should always be pointed at
// how to check - even on events where we haven't sourced a confirmed
// ShuttleBusInfo entry yet. This covers two real patterns: (1) remote/outdoor
// venues with no direct subway access (임진각, 파라다이스시티, regional halls in
// 강릉/전주/부산/밀양/대구), and (2) venues like KINTEX that *do* have direct
// rail access but where readers keep expecting (and sometimes finding, on a
// per-exhibition basis) a shuttle - see README's "셔틀버스 정보 찾는 법" section.
// Matched via venueSlug() so venue-name aliases (e.g. "임진각 평화누리" vs "파주
// 임진각 평화누리") don't need to be listed twice.
const SHUTTLE_LIKELY_SLUGS = new Set(
  [
    '파주 임진각 평화누리',
    '임진각 평화누리',
    '킨텍스 제2전시장',
    'KINTEX',
    '인스파이어 아레나',
    '파라다이스시티',
    '강릉아트센터',
    '한국소리문화의전당',
    '소향씨어터',
    '밀양아리랑아트센터',
    '엑스코(EXCO)',
  ].map(venueSlug)
);

export function isShuttleLikely(venueName: string): boolean {
  return SHUTTLE_LIKELY_SLUGS.has(venueSlug(venueName));
}

// Naver Map / Google Maps search links for a place, built from a plain-text
// query (e.g. "반구정나루터집 파주 임진각 평화누리") rather than stored
// coordinates - no per-restaurant data entry required, and never wrong the way
// a stale/guessed coordinate could be. Used by VenueInfoBox and the venue pages
// so a nearby-food entry is always one tap from directions, not just a name.
export function mapLinks(query: string): { naver: string; google: string } {
  const q = encodeURIComponent(query);
  return {
    naver: `https://map.naver.com/p/search/${q}`,
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}
