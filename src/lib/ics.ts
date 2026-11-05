// 구독 가능한 캘린더(.ics) 피드 생성 - 정적 빌드 시 생성되고, 캘린더 앱이 주기적으로 다시 받아간다.
// RFC 5545: CRLF 줄바꿈, 75옥텟 줄접기, 텍스트 이스케이프. 지어낸 값 없이 events.json의 확인된 정보만 쓴다.
import type { ConcertEvent } from './events';
import { hasTicketsOnSale } from './events';

export const SITE = 'https://jikgwannyang.com';

const pad = (n: number) => String(n).padStart(2, '0');
export const utcStamp = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const dateOnly = (iso: string) => iso.replace(/-/g, '');
const nextDay = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
};
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// 75옥텟(UTF-8 바이트) 단위로 줄접기. 멀티바이트 문자가 중간에 잘리지 않게 문자 단위로 센다.
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

interface CalMeta { name: string; desc: string }
export function calendar(meta: CalMeta, vevents: string[][], stampMs = Date.now()): string {
  void stampMs;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//직관냥//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(meta.name)}`, `X-WR-CALDESC:${esc(meta.desc)}`, 'X-WR-TIMEZONE:Asia/Seoul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H',
    ...vevents.flat(),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

const eventUrl = (e: ConcertEvent) => `${SITE}/events/${e.id}/`;

// 공연 일정: 종일 일정(시작일~종료일). 연기는 제목에 표시, 취소는 호출 쪽에서 제외한다.
export function showVevent(e: ConcertEvent, stampMs: number): string[] {
  const status = e.status ?? 'scheduled';
  const prefix = status === 'postponed' ? '[연기] ' : '';
  const sale = hasTicketsOnSale(e) ? '예매 오픈중' : e.ticketOpenAt ? '티켓오픈 예정' : '예매 일정 미정';
  const desc = `${e.genre} · ${e.venue} (${e.city}) · ${sale}\n일정·예매처는 변경될 수 있으니 공식 공지를 확인하세요.\n${eventUrl(e)}`;
  return [
    'BEGIN:VEVENT',
    `UID:${e.id}-show@jikgwannyang.com`,
    `DTSTAMP:${utcStamp(stampMs)}`,
    `DTSTART;VALUE=DATE:${dateOnly(e.startDate)}`,
    `DTEND;VALUE=DATE:${nextDay(e.endDate)}`,
    `SUMMARY:${esc(prefix + e.artist)}`,
    `LOCATION:${esc(`${e.venue} (${e.city})`)}`,
    `DESCRIPTION:${esc(desc)}`,
    `URL:${eventUrl(e)}`,
    `CATEGORIES:${esc(e.genre)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
}

// 티켓오픈 알림: 오픈 시각부터 30분, 10분 전·하루 전 알림.
export function openVevent(e: ConcertEvent, stampMs: number): string[] {
  const start = new Date(e.ticketOpenAt as string).getTime();
  const desc = `공연: ${e.artist} (${e.startDate} · ${e.venue})\n오픈 시각은 예매처 공지 기준이에요. 꼭 다시 확인하세요.\n${eventUrl(e)}`;
  return [
    'BEGIN:VEVENT',
    `UID:${e.id}-ticketopen@jikgwannyang.com`,
    `DTSTAMP:${utcStamp(stampMs)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(start + 30 * 60_000)}`,
    `SUMMARY:${esc(`티켓오픈 · ${e.artist}`)}`,
    `DESCRIPTION:${esc(desc)}`,
    `URL:${eventUrl(e)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${e.artist} 티켓오픈 10분 전`)}`, 'TRIGGER:-PT10M', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${e.artist} 티켓오픈 하루 전`)}`, 'TRIGGER:-P1D', 'END:VALARM',
    'END:VEVENT',
  ];
}

export function icsResponse(body: string): Response {
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
