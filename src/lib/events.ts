import raw from '../data/events.json';

export interface EventSource {
  label: string;
  url: string;
}

// One day's worth of festival lineup. `date` is an ISO date when known; leave it
// unset (and use `label` instead) for a bucket of acts whose exact day hasn't been
// announced yet - never guess a date just to fill the field in.
export interface LineupDay {
  date?: string;
  label?: string;
  acts: string[];
}

export interface MerchItem {
  label: string;
  imageUrl?: string;
  url?: string;
  note?: string;
}

// A dated research/verification log entry, shown to readers as a timeline instead
// of buried inside `note`. This is also where "새 소식이 있었다" issue-tracking
// updates belong (lineup reveals, ticket opens, controversies, etc).
export interface UpdateLogEntry {
  date: string; // ISO date
  text: string;
  sourceUrl?: string;
}

// One vendor's purchase page for a show. Many shows sell through more than one
// vendor at once (e.g. 인터파크 + NOL티켓, or 예스24 + 멜론티켓) - list every real
// one found rather than picking a single "main" link. `vendor` is a short display
// name (e.g. "인터파크", "NOL티켓", "예스24", "멜론티켓", "티켓링크").
export interface TicketLink {
  vendor: string;
  url: string;
  note?: string; // e.g. "스탠딩 전용", "1차 선예매 종료, 일반예매만 가능"
}

// A promoter/fanclub-specific presale (선예매) window - membership presale, credit
// card presale, fanclub presale, etc. `howTo` should be concrete step-by-step
// guidance when the source gives it (which site, which login/membership is
// required, what day it opens) - never invented, only what's actually announced.
export interface PresaleInfo {
  title: string; // e.g. "위버스 팬클럽 선예매", "현대카드 선예매"
  detail: string; // what this presale is and who's eligible
  howTo?: string; // concrete steps to participate
  date?: string; // ISO date or a human label like "2026-09-01 오후 8시"
  url?: string;
}

// A setlist from a specific show - usually a previous stop on the same tour, or
// (when the Korea stop hasn't happened yet) the most recent tour leg elsewhere.
// Always tag which show it's from via `label`/`date`/`venue` so readers don't
// mistake it for a confirmed Korea setlist unless it explicitly is one.
export interface SetlistEntry {
  label: string; // e.g. "2026 도쿄돔 공연 셋리스트", "2025 월드투어 서울 공연"
  date?: string;
  venue?: string;
  songs: string[];
  sourceUrl?: string;
  note?: string; // e.g. "실제 세트리스트는 공연마다 조금씩 달라질 수 있어요"
}

// A notable YouTube video worth surfacing - a viral clip, an official live
// performance, a fancam of a previous tour stop. `videoId` is the raw 11-char
// YouTube id (extracted from the URL at data-entry time) so the page can embed it
// directly without parsing at render time.
export interface YoutubeVideo {
  title: string;
  videoId: string;
  note?: string;
  sourceUrl?: string; // the original watch URL, for the "출처" line
}

// A shuttle bus service to/from a venue - usually a paid app-booking service run
// by a third-party operator (buses to festivals at remote venues like 자라섬,
// KINTEX, 인천 등) rather than the promoter itself. Only include real, currently
// bookable services found on the event's official site/notice - never a generic
// "보통 셔틀이 있어요" guess, and never invent an app/operator name.
export interface ShuttleBusInfo {
  operator: string; // e.g. "타고가campus", "waybus", "대성고속 전세버스"
  appName?: string; // booking app/platform name, if different from operator
  url?: string; // booking link
  routes?: string[]; // e.g. ["서울(잠실) ↔ 자라섬", "홍대 ↔ 인천 파라다이스시티"]
  note?: string; // price, schedule caveats, "선착순 마감" etc.
}

// A single earlier real-world edition of a recurring event (annual festival, tour
// series, etc.), used to build a "지난 회차와 비교" section. Only include editions
// with at least one verified real data point (attendance, lineup, or a notable
// change) - never guess or interpolate a past year's numbers just to fill the
// field in. `year` is a display label (usually the year, optionally with an
// edition number) rather than a strict ISO value since sources cite these
// inconsistently (e.g. "2025", "2025 (2회)").
export interface PreviousEdition {
  year: string;
  label?: string; // edition number/name if known, e.g. "1회", "22회"
  date?: string;
  venue?: string;
  // Verified attendance figure only - prefer an official/government count (e.g.
  // KOPIS) over a promoter's rounded press-release number when both exist, and
  // note the discrepancy in `attendanceNote` rather than picking one silently.
  attendance?: number;
  attendanceNote?: string;
  // Notable acts from that edition, real only - not the full lineup unless it's
  // short enough to be meaningful at a glance.
  lineupHighlights?: string[];
  scaleNote?: string; // e.g. "라인업 42팀, 이틀간 진행"
  sourceUrl?: string;
}

// A short, honest read on how this edition's lineup/scale compares to the most
// recent previous one, and what that might reasonably mean for turnout. This is
// commentary grounded in `previousEditions` + this year's own lineup/venue data -
// never a hard number prediction, and never invented beyond what the cited
// comparison actually supports. Frame it as "~일 가능성이 있다/높다" rather than a
// guaranteed outcome. Most useful for festivals whose lineup changes year to year
// (university festivals especially - a stronger/weaker lineup than last year is a
// genuine, citable reason to expect more or less crowd).
export interface CrowdOutlook {
  text: string;
  basis?: string; // e.g. "라인업 규모 유지 + 화제성 있는 신규 팀 추가"
}

export interface ConcertEvent {
  id: string;
  artist: string;
  genre: string;
  venue: string;
  city: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  ticketUrl?: string; // legacy single-vendor field - kept for back-compat, prefer ticketLinks
  // All real vendor pages selling this show. Prefer this over `ticketUrl` for any
  // show sold through more than one vendor. events/[id].astro merges both fields
  // (ticketLinks first, then ticketUrl if its URL isn't already listed) so old
  // entries keep working without edits.
  ticketLinks?: TicketLink[];
  officialUrl?: string; // artist/tour official site or promoter's official event page
  mdUrl?: string; // official merch/goods store, only when a real one was found
  fanclubUrl?: string; // official fan club page, mostly relevant for K-pop/J-pop acts
  // Official poster image URL. For KOPIS-sourced domestic events this can be filled
  // automatically (scripts/fetch-kopis.mjs calls KOPIS's detail API, a legit gov
  // open-data source). For hand-entered international tours, only set this from a
  // real official source and prefer linking over rehosting — never generated,
  // scraped from an unofficial site, or fabricated.
  posterUrl?: string;
  // Headliner/confirmed-artist list, flat (no per-day breakdown known/needed).
  // Prefer `lineupByDay` when the festival spans multiple days with different
  // acts each day - events/[id].astro falls back to this field wrapped as a
  // single group when `lineupByDay` isn't set.
  lineup?: string[];
  // Per-day lineup breakdown. Use this whenever official sources confirm which
  // acts play which day. A bucket with no confirmed date yet (rest of the lineup,
  // TBA) should omit `date` and use `label` instead - never invent a date.
  lineupByDay?: LineupDay[];
  // A specific start time / running time detail worth surfacing on its own
  // (e.g. "16:30 시작, 관람 시간 약 270분"), separate from the date range.
  schedule?: string;
  // Short, essential caveats only (e.g. "공식 홈페이지 없음 — 아래는 공식 인스타그램").
  // Long research reasoning belongs in `updates` instead, and citations in `sources`.
  note?: string;
  description?: string;
  // Researched trivia/context that makes the event worth reading about, not just
  // attending - history, scale, why a lineup choice is notable, practical tips.
  // Always sourced from real reporting; never invented. Write these with personality
  // (직관냥's voice) - a punchy hook or a "왜 화제인지" angle reads better than a flat
  // fact statement, as long as the underlying claim stays accurate and sourced.
  funFacts?: string[];
  // Official merch/goods info, only when a real product photo/listing was found.
  // Leave unset (not a placeholder) when nothing official has been announced yet.
  merch?: MerchItem[];
  // Promoter/fanclub/card-company presale windows, only when a real announced
  // presale process exists - never invented on the assumption "there's probably one".
  presale?: PresaleInfo[];
  // Past-tour setlists worth showing readers (see SetlistEntry for sourcing rules).
  setlists?: SetlistEntry[];
  // Notable YouTube videos (official live clips, viral fancams) - see YoutubeVideo.
  youtubeVideos?: YoutubeVideo[];
  // Dated timeline of what's changed or been confirmed since the event was first
  // published - lineup reveals, ticket opens, notable news. Renders as a visible
  // "최근 업데이트" log so readers have a reason to check back on this page.
  updates?: UpdateLogEntry[];
  // Citations for the research above. Rendered in small print at the very bottom
  // of the page, separate from the reader-facing content.
  sources?: EventSource[];
  // Absent/undefined is treated as 'scheduled'. Set when a show's status changes
  // after it was first published (e.g. a postponement announced in the news, not
  // something the KOPIS auto-fetch pipeline can detect on its own).
  status?: 'scheduled' | 'postponed' | 'cancelled';
  // True when tickets aren't on sale yet but the show/tour has been officially
  // announced (a "티켓오픈 예정" listing). Lets the homepage/card surface these
  // separately from shows that are already on sale. Leave unset once ticketing
  // opens (or set it to false and add the real ticketLinks instead).
  ticketingAnnounced?: boolean;
  // Human-readable ticket-open date/time when known ahead of the actual open
  // (e.g. "2026-09-01 오후 8시 (예정)"). Only for shows with ticketingAnnounced.
  ticketOpenDate?: string;
  // Official/known shuttle bus services to the venue. Mostly relevant for festivals
  // at remote or hard-to-reach venues (자라섬, KINTEX, 파라다이스시티 등) - see
  // ShuttleBusInfo for sourcing rules. Rendered next to VenueInfoBox.
  shuttleBus?: ShuttleBusInfo[];
  // Real prior editions of this same event/series, oldest-first or any order -
  // events/[id].astro sorts by `year` for display. Leave unset for a first-time
  // event; see PreviousEdition for sourcing rules.
  previousEditions?: PreviousEdition[];
  // Optional editorial read on expected turnout vs the most recent previous
  // edition - see CrowdOutlook. Only set when previousEditions has real data to
  // ground it in.
  crowdOutlook?: CrowdOutlook;
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

// Normalizes an event's lineup into day-grouped form for rendering, whether the
// data came in as `lineupByDay` (preferred) or a flat `lineup` array (fallback,
// wrapped as a single unlabeled group).
export function festivalLineupDays(event: ConcertEvent): LineupDay[] {
  if (event.lineupByDay && event.lineupByDay.length > 0) return event.lineupByDay;
  if (event.lineup && event.lineup.length > 0) return [{ acts: event.lineup }];
  return [];
}

// Most recent update date for an event, or null. Used to surface a "최근 업데이트"
// signal on list cards so returning readers can spot pages with fresh news.
export function latestUpdateISO(event: ConcertEvent): string | null {
  if (!event.updates || event.updates.length === 0) return null;
  return event.updates.reduce((max, u) => (u.date > max ? u.date : max), event.updates[0].date);
}

// True when an event's most recent update happened within `days` days of `fromISO`
// (defaults to today). Drives the "업데이트" badge on EventCard.
export function hasRecentUpdate(event: ConcertEvent, days = 7, fromISO?: string): boolean {
  const latest = latestUpdateISO(event);
  if (!latest) return false;
  const from = fromISO ? new Date(fromISO + 'T00:00:00') : new Date();
  const latestDate = new Date(latest + 'T00:00:00');
  const diffDays = Math.floor((from.getTime() - latestDate.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= days;
}

// Merges `ticketLinks` and the legacy `ticketUrl` into one de-duplicated list, so
// every page can just call this instead of re-implementing the merge/fallback.
export function allTicketLinks(event: ConcertEvent): TicketLink[] {
  const links: TicketLink[] = event.ticketLinks ? event.ticketLinks.slice() : [];
  if (event.ticketUrl && !links.some((l) => l.url === event.ticketUrl)) {
    links.push({ vendor: '티켓 예매', url: event.ticketUrl });
  }
  return links;
}

// Whether an event has at least one working way to buy tickets right now (used by
// EventCard's "예매 가능" tag and anywhere else that used to just check ticketUrl).
export function hasTicketsOnSale(event: ConcertEvent): boolean {
  return allTicketLinks(event).length > 0;
}

// True when we have at least one verified prior edition to compare against.
export function hasPreviousEditions(event: ConcertEvent): boolean {
  return !!(event.previousEditions && event.previousEditions.length > 0);
}

// Previous editions sorted oldest-first by `year` (lexicographic - fine since
// these are always "YYYY" or "YYYY..." style labels).
export function sortedPreviousEditions(event: ConcertEvent): PreviousEdition[] {
  return (event.previousEditions ?? []).slice().sort((a, b) => a.year.localeCompare(b.year));
}

// Simple attendance-trend read across editions with a verified attendance
// figure (needs at least 2 such editions). +-10% counts as flat so small
// year-to-year noise doesn't get overstated as growth/decline.
export function attendanceTrend(event: ConcertEvent): 'growing' | 'shrinking' | 'flat' | null {
  const withAttendance = sortedPreviousEditions(event).filter((e) => typeof e.attendance === 'number');
  if (withAttendance.length < 2) return null;
  const first = withAttendance[0].attendance as number;
  const last = withAttendance[withAttendance.length - 1].attendance as number;
  if (last > first * 1.1) return 'growing';
  if (last < first * 0.9) return 'shrinking';
  return 'flat';
}
