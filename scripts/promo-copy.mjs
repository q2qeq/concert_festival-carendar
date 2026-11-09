#!/usr/bin/env node
/**
 * 신규 공연 홍보 문안 생성 - 팬 커뮤니티·SNS·카톡에 직접 올릴 때 복사해 쓰는 글.
 * 자동 게시는 하지 않는다(커뮤니티 규칙 위반·차단 위험). events.json의 확인된 정보만 쓰고, 없는 정보는 "발표 전"으로 적는다.
 * 사용:  npm run promo:copy -- <공연id>      (id를 안 주면 최근 7일 신규 공연 전체)
 * 올릴 때 지킬 것: 1) 해당 커뮤니티 홍보 규칙 확인  2) 링크는 한 번만  3) 공식 발표가 바뀌면 글도 고치기
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const events = JSON.parse(readFileSync(join(root, 'src/data/events.json'), 'utf8'));
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const dow = ['일', '월', '화', '수', '목', '금', '토'];
const f = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${dow[d.getUTCDay()]})`; };

const ids = process.argv.slice(2);
const list = ids.length ? events.filter((e) => ids.includes(e.id))
  : events.filter((e) => e.addedAt && (new Date(today) - new Date(e.addedAt)) / 86400000 <= 7);
if (!list.length) { console.log('대상 공연이 없어요. id를 직접 넘겨 주세요.'); process.exit(0); }

for (const e of list) {
  const name = e.artist.replace(/\s*\(.*\)\s*$/, '');
  const when = e.startDate === e.endDate ? f(e.startDate) : `${f(e.startDate)} ~ ${f(e.endDate)}`;
  const venueKnown = !/추후|미정|미발표/.test(e.venue);
  const where = venueKnown ? `${e.venue}` : '공연장 추후 발표';
  const ticket = e.ticketOpenDate ? `티켓 오픈: ${e.ticketOpenDate}` : (e.ticketLinks?.length ? '티켓 판매 중' : '티켓 오픈 일정 발표 전');
  const url = `https://jikgwannyang.com/events/${e.id}/`;
  const src = e.sources?.[0]?.url ?? e.officialUrl ?? '';
  console.log(`\n==================== ${name} (${e.id}) ====================`);
  console.log(`\n[커뮤니티 게시글용 - 제목]\n${name} 내한 정보 정리 (${when.replace(/ ~.*/, '')}, ${where})`);
  console.log(`\n[커뮤니티 게시글용 - 본문]\n- 일정: ${when}\n- 장소: ${where}\n- ${ticket}\n${src ? `- 출처: ${src}\n` : ''}\n일정·가격은 바뀔 수 있어서 예매 전에 공식 공지를 꼭 확인하세요.\n발표되는 대로 정리해 둔 페이지에 업데이트합니다: ${url}`);
  console.log(`\n[X(트위터)용]\n${name} 내한 ${when}${venueKnown ? ` @ ${e.venue}` : ''}\n${ticket}\n${url}`);
  console.log(`\n[카톡 공유용]\n${name} ${when.replace(/ ~.*/, '')} 내한! ${where} / ${ticket}\n${url}`);
  console.log(`\n(공유 이미지: https://jikgwannyang.com/og/${e.id}.png 가 있으면 첨부 - 없으면 npm run og:cards -- ${e.id})`);
}
