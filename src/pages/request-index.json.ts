// 공연 요청 맞춰 보기용 목록. 요청 상자(브라우저)가 "이미 있는 공연인지" 볼 때,
// 푸시 발송 함수(/api/push-send)가 "요청한 공연이 올라왔는지" 볼 때 읽는다.
// 다가오는 공연만, 비교 키를 미리 만들어 담아 작게 유지한다.
import { upcomingEvents } from '../lib/events';
import { nameKeys } from '../../api/_match.js';

export function GET() {
  const out = upcomingEvents()
    .filter((e) => (e.status ?? 'scheduled') !== 'cancelled')
    .map((e) => ({
      id: e.id,
      a: e.artist,
      d: e.startDate,
      v: e.venue,
      k: nameKeys(e.artist, [...(e.lineup ?? []), ...(e.lineupByDay ?? []).flatMap((d) => d.acts)]),
    }));
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
