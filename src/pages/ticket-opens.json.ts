// 푸시 발송 함수(/api/push-send)가 읽는 티켓오픈 단계 목록. 공식 공지로 확인된 시각만 들어 있다.
// 앞으로 열릴 단계만 담아 작게 유지한다(지난 단계는 빌드 때 빠진다).
import { upcomingOpenStages } from '../lib/events';

export function GET() {
  const out = upcomingOpenStages(300)
    .filter(({ event }) => (event.status ?? 'scheduled') === 'scheduled')
    .map(({ event, stage, multi }) => ({
      id: event.id,
      artist: event.artist.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim(),
      label: stage.label,
      at: stage.at,
      multi,
    }));
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
