import type { APIRoute } from 'astro';
import { upcomingTicketOpens } from '../../lib/events';
import { calendar, openVevent, icsResponse } from '../../lib/ics';

export const GET: APIRoute = () => {
  const now = Date.now();
  const list = upcomingTicketOpens(200, now);
  return icsResponse(calendar(
    { name: '직관냥 · 티켓오픈 일정', desc: '오픈 시각이 확인된 공연의 티켓오픈 일정이에요. 10분 전·하루 전 알림이 들어 있어요.' },
    list.map((e) => openVevent(e, now)),
  ));
};
