// 푸시 발송 함수(/api/push-send)가 읽는 공연 목록: 소식 알림·공연 전날 알림용.
// 아직 안 끝난 공연만, 첫 공연일과 가장 최근 소식 한 줄만 담아 작게 유지한다.
import { upcomingEvents } from '../lib/events';

const clean = (s: string) => s.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

export function GET() {
  const out = upcomingEvents().map((e) => {
    const latest = (e.updates ?? []).reduce<{ date: string; text: string } | null>((a, b) => (!a || b.date > a.date ? b : a), null);
    return {
      id: e.id,
      artist: clean(e.artist),
      start: e.startDate,
      status: e.status ?? 'scheduled',
      news: latest ? { d: latest.date, t: latest.text.length > 110 ? latest.text.slice(0, 108) + '…' : latest.text } : null,
    };
  });
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
