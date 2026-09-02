import raw from '../data/venues.json';

export interface VenueFood {
  name: string;
  desc: string;
}

export interface VenueInfo {
  address?: string;
  transit?: string[];
  parking?: string;
  // 코인락커/화장실/흡연장 위치 - 셋 다 선택 필드. 다른 필드들과 같은 원칙으로,
  // 실제 확인된 정보만 채운다(추측·일반화 금지) - 확인 전까지는 비워둔다.
  coinLocker?: string;
  restroom?: string;
  smokingArea?: string;
  nearbyFood?: VenueFood[];
  tip?: string;
  // 공연장 공식/현장 사진 - 출처가 명확한(라이선스 확인된) 사진이 있을 때만 채운다.
  // 저작권 문제를 피하려고 자체 리호스팅 없이 원본(Wikimedia Commons 등)을 그대로
  // 링크한다 - posterUrl과 동일한 원칙. imageCredit/imageSourceUrl은 CC 라이선스
  // 사진의 출처 표기용(퍼블릭 도메인 사진도 검증 가능하도록 함께 채워둔다).
  imageUrl?: string;
  imageCredit?: string;
  imageSourceUrl?: string;
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

// 주소 앞부분(시/도)으로 지역을 묶어서 /venues 페이지를 지역별로 볼 수 있게 하는
// 헬퍼. 좌표 데이터 없이도 이미 모든 공연장에 있는 address 필드만으로 동작한다 -
// 새 공연장이 추가돼도 주소만 있으면 자동으로 올바른 지역에 들어간다. 목록에 없는
// 접두어(주소 누락 등)는 '기타'로 묶는다.
const REGION_PREFIXES: Array<[string, string]> = [
  ['서울', '서울'],
  ['경기', '경기'],
  ['인천', '인천'],
  ['강원', '강원'],
  ['충북', '충북'],
  ['충남', '충남'],
  ['대전', '대전'],
  ['세종', '세종'],
  ['전북', '전북'],
  ['전남', '전남'],
  ['광주', '광주'],
  ['대구', '대구'],
  ['경북', '경북'],
  ['경남', '경남'],
  ['부산', '부산'],
  ['울산', '울산'],
  ['제주', '제주'],
];

export function regionOf(address?: string): string {
  if (!address) return '기타';
  const hit = REGION_PREFIXES.find(([prefix]) => address.startsWith(prefix));
  return hit ? hit[1] : '기타';
}

// 수도권부터 남쪽으로 대략 훑는 순서 - 지역 섹션을 나열할 때 이 순서를 쓴다.
export const REGION_ORDER = [
  '서울', '경기', '인천', '강원',
  '대전', '세종', '충북', '충남',
  '광주', '전북', '전남',
  '대구', '경북', '부산', '울산', '경남', '제주',
  '기타',
];

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

// Kakao T 셔틀(카카오모빌리티의 행사/콘서트 전용 셔틀버스 예약 서비스) 검색 링크.
// 공식 홈페이지에 안 나오는 콘서트 셔틀도 실제로는 이 서비스로 많이 운영돼서
// (세븐틴/TWICE/오피셜히게단디즘 콘서트 등 확인됨), 확정된 셔틀 정보가 없는
// 공연이라도 항상 여기서 먼저 검색해보도록 안내한다. shuttle.kakaomobility.com의
// 태그 검색 페이지 - 좌표/장소 ID 없이 텍스트만으로 동작한다.
export function kakaoShuttleSearchUrl(query: string): string {
  return `https://shuttle.kakaomobility.com/shuttles/tags?tag=${encodeURIComponent(query)}`;
}

// Google Maps 길찾기 링크. destination만 지정하면 origin은 Google이 기기 위치를
// 기본값으로 쓰거나(가능한 경우) 빈 입력창을 띄워 직접 입력하게 한다 - 별도 API
// 키나 지오코딩 없이도 "출발지 입력 → 경로 검색"이 그대로 동작하는 이유.
// origin을 텍스트로 넘기면 Google이 알아서 지오코딩한다.
export function transitDirectionsUrl(destination: string, origin?: string): string {
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'transit' });
  if (origin && origin.trim()) params.set('origin', origin.trim());
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// Kakao/네이버 지도에서 이 장소를 검색해 보여주는 링크(길찾기는 지도 자체 UI에서
// 이어서 하도록 안내). 좌표 데이터가 없어도 동작해서 모든 공연장에 바로 쓸 수 있다.
export function kakaoMapSearchUrl(query: string): string {
  return `https://map.kakao.com/?q=${encodeURIComponent(query)}`;
}

// 콘서트 셔틀버스 시장 대부분을 차지하는 3대 업체 - 예매/노선 확인은 전부 각 사
// 앱(또는 앱과 연동된 자체 플랫폼)에서 이뤄지고, 범용 지도·포털 검색으로는 잘 안
// 걸린다. 그래서 셔틀 섹션에는 항상 이 3사를 먼저 눈에 띄게 링크해둔다 - 공식
// 홈페이지가 곧 앱 다운로드/예약 안내로 이어지는 실제 존재하는 링크만 사용
// (앱스토어 ID는 버전이 바뀔 수 있어 안정적인 공식 사이트를 링크).
export const GGOGGAMA_URL = 'https://www.ggoggama.com/';
export const QUEENS_SMILE_URL = 'https://queenssmile.co.kr/';
