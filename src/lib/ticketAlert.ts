// 티켓오픈 알림용 캘린더 데이터 - 이미 확인된 ticketOpenAt이 있는 공연만 대상.
// 빌드 시점(NextSteps의 data URI)과 브라우저(/my의 일괄 저장)에서 같은 코드를 쓴다.
export interface OpenAlertEvent {
  id: string;
  artist: string;
  ticketOpenAt: string; // ISO (+09:00 포함)
  key?: string; // 같은 공연의 선예매·일반예매를 한 파일에 담을 때 UID가 겹치지 않게
}

const SITE = 'https://jikgwannyang.com';
const DURATION_MIN = 30;

const pad = (n: number) => String(n).padStart(2, '0');
function toUtcStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\;').replace(/\n/g, '\\n');

function vevent(e: OpenAlertEvent): string[] {
  const start = new Date(e.ticketOpenAt).getTime();
  const url = `${SITE}/events/${e.id}/`;
  return [
    'BEGIN:VEVENT',
    `UID:${e.id}${e.key ? '-' + e.key : ''}-ticketopen@jikgwannyang.com`,
    `DTSTAMP:${toUtcStamp(start)}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(start + DURATION_MIN * 60_000)}`,
    `SUMMARY:${esc(`🎫 ${e.artist} 티켓 오픈`)}`,
    `DESCRIPTION:${esc(`예매처 공지 기준으로 오픈 시각을 꼭 다시 확인하세요.\n${url}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${e.artist} 티켓 오픈 10분 전`)}`, 'TRIGGER:-PT10M', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${e.artist} 티켓 오픈 하루 전`)}`, 'TRIGGER:-P1D', 'END:VALARM',
    'END:VEVENT',
  ];
}

export function ticketOpenIcs(events: OpenAlertEvent[]): string {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//직관냥//KO', 'CALSCALE:GREGORIAN',
    ...events.flatMap(vevent),
    'END:VCALENDAR',
  ].join('\r\n');
}

export function ticketOpenGoogleUrl(e: OpenAlertEvent): string {
  const start = new Date(e.ticketOpenAt).getTime();
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(`🎫 ${e.artist} 티켓 오픈`)}` +
    `&dates=${toUtcStamp(start)}/${toUtcStamp(start + DURATION_MIN * 60_000)}` +
    `&details=${encodeURIComponent(`예매처 공지 기준으로 오픈 시각을 다시 확인하세요.\n${SITE}/events/${e.id}/`)}`
  );
}

export const icsDataUri = (ics: string) => `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
