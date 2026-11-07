// 찜한 공연의 "새 소식" 표시용. 공연별 가장 최근 업데이트(날짜·한 줄)만 담은 작은 정적 JSON.
// 브라우저가 찜 목록이 있을 때만 가져가서 마지막으로 본 날짜와 비교한다(서버로 나가는 정보 없음).
import { upcomingEvents } from '../lib/events';

export function GET() {
  const out: Record<string, { d: string; t: string }> = {};
  for (const e of upcomingEvents()) {
    if (!e.updates || e.updates.length === 0) continue;
    const latest = e.updates.reduce((a, b) => (b.date > a.date ? b : a));
    out[e.id] = { d: latest.date, t: latest.text.length > 90 ? latest.text.slice(0, 88) + '…' : latest.text };
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
