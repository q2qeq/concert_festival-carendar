#!/usr/bin/env node
/**
 * 공유 카드(og:image 1200x630 PNG) 생성 - 포스터가 없는 공연이나 신규 공연을 SNS에 공유할 때 보이는 이미지.
 * 사진·포스터는 쓰지 않고 글자만 쓴다(저작권 문제 없음). 결과: public/og/<공연id>.png (커밋해서 배포).
 *
 * 사용:  npm run og:cards                  포스터 없는 예정 공연 + 최근 7일 신규 공연 전부
 *        npm run og:cards -- <id> [<id>]   지정한 공연만
 * 글꼴은 이 컴퓨터(macOS)의 Apple SD Gothic Neo를 쓴다. 서버(Vercel)에는 한글 글꼴이 없어서
 * 빌드 때 만들지 않고, 여기서 만들어 PNG를 커밋하는 방식이다.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const events = JSON.parse(readFileSync(join(root, 'src/data/events.json'), 'utf8'));
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const FONT = "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dow = ['일', '월', '화', '수', '목', '금', '토'];
function dateLabel(e) {
  const f = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}(${dow[d.getUTCDay()]})`; };
  return e.startDate === e.endDate ? f(e.startDate) : `${f(e.startDate)} - ${f(e.endDate).slice(5)}`;
}
// 긴 글을 폭에 맞게 줄바꿈한다(한글은 글자 폭이 일정해서 글자 수로 끊는다).
function wrap(text, perLine, maxLines) {
  const lines = []; let cur = '';
  for (const ch of text) { cur += ch; if (cur.length >= perLine) { lines.push(cur); cur = ''; } }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; }
  return lines;
}
function status(e) {
  if (/추후|미정|미발표/.test(e.venue)) return '공연장·티켓 일정 발표 전';
  if (e.ticketOpenDate) return `티켓 오픈 ${e.ticketOpenDate.split(' (')[0]}`;
  if (!e.ticketOpenAt && !e.ticketingAnnounced && !(e.ticketLinks?.length || e.ticketUrl)) return '티켓 일정 발표 전';
  return '';
}

function svg(e) {
  const name = e.artist.replace(/\s*\(.*\)\s*$/, '');
  const nameLines = wrap(name, 14, 2);
  const size = nameLines.some((l) => l.length > 10) ? 84 : 104;
  const y0 = 250;
  const nameSvg = nameLines.map((l, i) => `<text x="80" y="${y0 + i * (size + 12)}" font-size="${size}" font-weight="800" fill="#f4f4f0">${esc(l)}</text>`).join('');
  const yInfo = y0 + (nameLines.length - 1) * (size + 12) + 90;
  const st = status(e);
  const venue = wrap(`${e.venue}${e.city && e.city !== '한국' ? ` · ${e.city}` : ''}`, 30, 1)[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="${FONT}">
  <rect width="1200" height="630" fill="#0e0e10"/>
  <rect x="0" y="0" width="14" height="630" fill="#ff5fa2"/>
  <text x="80" y="120" font-size="28" font-weight="700" fill="#ff5fa2" letter-spacing="4">NEW · ${esc(e.genre)}</text>
  ${nameSvg}
  <text x="80" y="${yInfo}" font-size="44" font-weight="700" fill="#f4f4f0">${esc(dateLabel(e))}</text>
  <text x="80" y="${yInfo + 62}" font-size="34" font-weight="500" fill="#c4c4c8">${esc(venue)}</text>
  ${st ? `<text x="80" y="${yInfo + 120}" font-size="30" font-weight="600" fill="#8f8f97">${esc(st)}</text>` : ''}
  <text x="80" y="580" font-size="30" font-weight="800" fill="#f4f4f0">직관냥</text>
  <text x="190" y="580" font-size="26" fill="#8f8f97">jikgwannyang.com</text>
</svg>`;
}

const args = process.argv.slice(2);
const isRecent = (e) => e.addedAt && (new Date(today) - new Date(e.addedAt)) / 86400000 <= 7;
const targets = args.length
  ? events.filter((e) => args.includes(e.id))
  : events.filter((e) => e.endDate >= today && e.status !== 'cancelled' && (!e.posterUrl || isRecent(e)));
mkdirSync(join(root, 'public/og'), { recursive: true });
for (const e of targets) {
  const png = await sharp(Buffer.from(svg(e))).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(root, 'public/og', `${e.id}.png`), png);
  console.log(`og/${e.id}.png  ${(png.length / 1024).toFixed(0)}KB`);
}
if (targets.length === 0) console.log('만들 공연이 없어요.');
