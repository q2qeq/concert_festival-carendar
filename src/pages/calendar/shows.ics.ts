import type { APIRoute } from 'astro';
import { scheduleEvents } from '../../lib/events';
import { calendar, showVevent, icsResponse } from '../../lib/ics';

export const GET: APIRoute = () => {
  const now = Date.now();
  const list = scheduleEvents();
  return icsResponse(calendar(
    { name: '직관냥 · 내한공연 일정', desc: '직관냥에 등록된 예정 내한공연·페스티벌 일정이에요. 공연 페이지 링크가 들어 있어요.' },
    list.map((e) => showVevent(e, now)),
  ));
};
