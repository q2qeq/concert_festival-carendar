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

// 한 상품 = label(이름) + price/variants(사이즈·색상 등 옵션) + note(추가 설명) +
// imageUrl(있으면 개별 사진) + url(개별 구매 링크, 없으면 이벤트의 mdUrl로 대체).
// 개별 사진은 벤더 페이지에서도 못 찾는 경우가 많다 - 그럴 땐 imageUrl을 비워두고
// 이벤트 레벨의 merchPhotoUrl(여러 상품이 한 번에 나온 사진)으로 대신한다.
export interface MerchItem {
  label: string;
  price?: string; // e.g. "66,000원" - 실제 공지된 가격만, 추측 금지
  variants?: string; // e.g. "오렌지/블루 2色", "S/M/L" - 실제 옵션만
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

// A real, sourced fan-chant/응원법("cheer guide") reference for this show - an
// officially published 콜 가이드/응원법 (agency/promoter PDF or image), or a
// well-known, credited fan-made guide. Only ever added when a real link exists
// (same sourcing bar as SetlistEntry/PresaleInfo) - the generic search links in
// FanChantGuide.astro cover every other case without needing curated data.
export interface FanChantGuideEntry {
  title: string; // e.g. "위버스 공식 응원법 가이드", "이번 투어 콜 가이드 (팬 제작)"
  url: string;
  note?: string;
}

// Editorial call on which lineup act is generating the most buzz right now for a
// festival - grounded in a real, citable signal (a promoter's own "메인
// 헤드라이너" billing, a genuine news/화제성 spike, a sold-out previous stop),
// never a guess dressed up as fact. `act` should match a string in
// `lineup`/`lineupByDay` exactly so the lineup list can visually flag it.
// Leave unset for most festivals - most should stay unset until a real signal
// is found (same convention as ticketingDifficulty/crowdOutlook).
export interface FestivalHighlightAct {
  act: string;
  reason: string; // short, sourced note on why this act is the pick
  sourceUrl?: string;
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
  // Known official promoter/artist SNS account(s) for this show - only set
  // when a specific account was actually found and verified (e.g. while
  // researching a ticket-open or operating-hours notice). Used to scope the
  // bounded, on-demand MD/운영공지 SNS check to "the one known account for this
  // event", never a general sweep - see the "Standing policy: on-demand
  // social-media checks" note in project memory. Do not add an unverified
  // guess just to populate this field.
  officialSns?: { label: string; url: string }[];
  fanclubUrl?: string; // official fan club page, mostly relevant for K-pop/J-pop acts
  // Official poster image URL. For KOPIS-sourced domestic events this can be filled
  // automatically (scripts/fetch-kopis.mjs calls KOPIS's detail API, a legit gov
  // open-data source). For hand-entered international tours, only set this from a
  // real official source and prefer linking over rehosting — never generated,
  // scraped from an unofficial site, or fabricated.
  posterUrl?: string;
  // Original remote URL the poster was downloaded from (ticket vendor /
  // news CDN), kept for provenance after scripts/cache-posters.mjs
  // rewrites posterUrl to a self-hosted /posters/<id>.webp path.
  posterSourceUrl?: string;
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
  // 여러 굿즈가 한 번에 나온 사진(부스컷/전체 상품컷) - 개별 상품 사진 하나하나
  // 찾기 어려울 때 이걸 우선 노출한다. 실제로 찾은 공식/보도 사진에만 채운다.
  merchPhotoUrl?: string;
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
  // Machine-readable ISO 8601 version of the same ticket-open moment (e.g.
  // "2026-10-07T12:00:00+09:00"), only set when the source notice states an exact
  // time. Powers the "티켓팅 시계로 준비하기" link on the event page (links to
  // /ticketing-clock?open=...&artist=... for a synced countdown) - purely
  // additive, ticketOpenDate above still carries the human-readable label.
  ticketOpenAt?: string;
  // Editorial judgment on how hard tickets are to get, grounded in a real,
  // citable signal (e.g. a past/this-year sale selling out immediately, a
  // small venue vs a huge-demand artist). This is commentary, like
  // crowdOutlook - never a guess dressed up as fact. Leave unset (the badge
  // just doesn't render) unless there's a real basis; most shows should stay
  // unset. 'hard' = 피켓팅 (brutal), 'normal' = 무난, 'easy' = 현장에서도
  // 구할 수 있을 정도로 여유 있음.
  ticketingDifficulty?: 'hard' | 'normal' | 'easy';
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
  // Real, sourced fan-chant/응원법 guide(s) for this show - see FanChantGuideEntry.
  // Leave unset for the vast majority of events; FanChantGuide.astro always
  // renders its own generic search links regardless of whether this is set.
  fanChantGuide?: FanChantGuideEntry[];
  // ISO date (yyyy-mm-dd) of the last time a real fan-chant/응원법 guide was
  // actively searched for this event - set by the fanchant-watch routine (see
  // scripts/fanchant-watch-list.mjs). Only meaningful while `fanChantGuide` is
  // still empty; stop updating once it has real data. Mirrors merchCheckedAt/
  // enrichmentCheckedAt.
  fanChantGuideCheckedAt?: string;
  // Real, sourced picks for "지금 가장 화제인" acts in this festival's lineup -
  // see FestivalHighlightAct for sourcing rules. Leave unset for the vast
  // majority of festivals.
  festivalHighlight?: FestivalHighlightAct[];
  // ISO date (yyyy-mm-dd) of the last time MD/굿즈 info was actively checked
  // for this event (notice page + web search, and the known SNS account if
  // within the D-30 window) - set by the merch-watch routine. Lets it skip
  // re-checking the same event same-day and shows how stale the last check
  // is. Only meaningful while `merch` is still empty; stop updating once
  // `merch` has real data.
  merchCheckedAt?: string;
  // ISO date (yyyy-mm-dd) of the last time the enrichment routine actively
  // researched this event for the baseline narrative fields (description/
  // funFacts/sources, and posterUrl when findable) - set by the enrichment
  // routine (see scripts/enrichment-watch-list.mjs) whether or not it found
  // anything, so a genuinely-empty result isn't re-researched every single
  // pass. Only meaningful while `description` is still empty; stop updating
  // once the baseline fields have real data.
  enrichmentCheckedAt?: string;
  // ISO date (yyyy-mm-dd) of the last time this show was actively checked for
  // additional real ticket vendors beyond what's already listed (ticketLinks/
  // ticketUrl) - set by the ticket-vendor-watch routine (see
  // scripts/ticket-vendor-watch-list.mjs). This is a periodic re-check, not a
  // one-time gap fill: a show can go from one vendor to several as ticketing
  // rolls out over time, so keep updating this even after ticketLinks has
  // data - never invent a vendor that wasn't actually found selling the show.
  ticketLinksCheckedAt?: string;
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

// URL-safe slugs for genre tag pages (/tag/[slug]). Explicit map (rather than a
// generic transliterator) since there are only a handful of real genres and a
// hand-picked English slug reads better in a URL than an auto-romanized one.
// Falls back to a lowercased/encoded version of the raw genre for anything new
// that shows up before this map is updated, so a new KOPIS genre never 404s.
const GENRE_SLUG_MAP: Record<string, string> = {
  'J-POP': 'jpop',
  '페스티벌': 'festival',
  '가요': 'kayo',
  '팝': 'pop',
  '팝/락': 'pop-rock',
  '팝/힙합': 'pop-hiphop',
  '재즈/내한': 'jazz',
  '클래식': 'classical',
  '버라이어티': 'variety',
};
const SLUG_TO_GENRE: Record<string, string> = Object.fromEntries(
  Object.entries(GENRE_SLUG_MAP).map(([genre, slug]) => [slug, genre])
);

export function genreSlug(genre: string): string {
  return GENRE_SLUG_MAP[genre] ?? encodeURIComponent(genre.toLowerCase());
}

export function genreFromSlug(slug: string): string | undefined {
  return SLUG_TO_GENRE[slug] ?? events.find((e) => genreSlug(e.genre) === slug)?.genre;
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
export const TICKETING_DIFFICULTY_LABEL: Record<'hard' | 'normal' | 'easy', string> = {
  hard: '피켓팅',
  normal: '무난',
  easy: '현장발권 가능',
};

export function hasTicketsOnSale(event: ConcertEvent): boolean {
  return allTicketLinks(event).length > 0;
}

// Which lineup acts (if any) are flagged as this festival's real, sourced
// "지금 화제인" pick(s) - see FestivalHighlightAct. Returns a Set for O(1)
// lookup while rendering the lineup list.
export function festivalHighlightSet(event: ConcertEvent): Set<string> {
  return new Set((event.festivalHighlight ?? []).map((h) => h.act));
}

// Whether this show is "화제" (buzzing) enough to earn extra visual emphasis on
// cards/rails. Deliberately reuses signals that are already editorially
// grounded elsewhere on the page (a real 피케팅-difficulty call, or a sourced
// festivalHighlight pick) instead of introducing a brand-new unsourced flag -
// see ticketingDifficulty/FestivalHighlightAct for the sourcing bar each one
// has to clear before it's ever set.
export function isBuzzing(event: ConcertEvent): boolean {
  return event.ticketingDifficulty === 'hard' || (event.festivalHighlight?.length ?? 0) > 0;
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

// Curated "hot picks" for the homepage hero/gallery - not just the soonest
// shows, but the ones worth spotlighting right now. Scores in favour of
// brutal-demand shows (ticketingDifficulty 'hard'), shows with fresh news,
// and shows already on sale, then breaks ties by how soon the show is.
// Requires a poster (nothing to show in a poster gallery without one), so a
// well-researched-but-unposterred event never takes a slot it can't render.
export function spotlightEvents(limit = 4, fromISO?: string): ConcertEvent[] {
  const from = fromISO ?? new Date().toISOString().slice(0, 10);
  const pool = upcomingEvents(from).filter(
    (e) => e.posterUrl && (e.status ?? 'scheduled') === 'scheduled'
  );
  function score(e: ConcertEvent): number {
    let s = 0;
    if (e.ticketingDifficulty === 'hard') s -= 100;
    if (hasRecentUpdate(e, 7, from)) s -= 20;
    if (hasTicketsOnSale(e)) s -= 10;
    const days = Math.max(
      0,
      Math.floor(
        (new Date(e.startDate + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) /
          86400000
      )
    );
    s += days * 0.1;
    return s;
  }
  return pool
    .slice()
    .sort((a, b) => score(a) - score(b))
    .slice(0, limit);
}

// "관련 공연" cross-links for the event detail page - same venue first (fans
// going to that venue often want to know what else is on), then same genre,
// then same city, then everything else, deprioritizing shows that have
// already happened. This exists for two reasons at once: it's genuinely
// useful to a reader deciding what else to see, AND it gives Googlebot/other
// crawlers a real link path into every event page instead of relying solely
// on the sitemap for discovery (added 2026-09-04, see project memory).
export function relatedEvents(event: ConcertEvent, limit = 4, fromISO?: string): ConcertEvent[] {
  const from = fromISO ?? new Date().toISOString().slice(0, 10);
  const pool = events.filter((e) => e.id !== event.id && (e.status ?? 'scheduled') !== 'cancelled');
  function score(e: ConcertEvent): number {
    let s = 0;
    if (e.venue === event.venue) s -= 100;
    if (e.genre === event.genre) s -= 40;
    if (e.city === event.city) s -= 10;
    if (e.startDate < from) s += 1000; // heavily deprioritize (but don't exclude) past shows
    const daysDiff =
      Math.abs(
        new Date(e.startDate + 'T00:00:00').getTime() - new Date(event.startDate + 'T00:00:00').getTime()
      ) / 86400000;
    s += daysDiff * 0.01;
    return s;
  }
  return pool
    .slice()
    .sort((a, b) => score(a) - score(b))
    .slice(0, limit);
}
