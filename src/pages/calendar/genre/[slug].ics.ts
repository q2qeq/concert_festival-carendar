import type { APIRoute } from 'astro';
import { scheduleEvents, allGenres, genreSlug, genreFromSlug } from '../../../lib/events';
import { calendar, showVevent, icsResponse } from '../../../lib/ics';

export function getStaticPaths() {
  const have = new Set(scheduleEvents().map((e) => e.genre));
  return allGenres().filter((g) => have.has(g)).map((g) => ({ params: { slug: genreSlug(g) } }));
}

export const GET: APIRoute = ({ params }) => {
  const genre = genreFromSlug(params.slug as string) ?? '';
  const now = Date.now();
  const list = scheduleEvents().filter((e) => e.genre === genre);
  return icsResponse(calendar(
    { name: `직관냥 · ${genre} 내한공연`, desc: `직관냥에 등록된 ${genre} 장르의 예정 공연 일정이에요.` },
    list.map((e) => showVevent(e, now)),
  ));
};
