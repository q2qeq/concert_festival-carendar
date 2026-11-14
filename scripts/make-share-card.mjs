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
// 색은 사이트와 같은 값을 쓰도록 BaseLayout의 :root 변수에서 읽는다(값을 여기 따로 적지 않는다).
const layout = readFileSync(join(root, 'src/layouts/BaseLayout.astro'), 'utf8');
const C = Object.fromEntries([...layout.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((m) => [m[1], m[2]]));
for (const k of ['bg', 'fg', 'fg-2', 'muted', 'line', 'cheese', 'eye', 'ink']) {
  if (!C[k]) throw new Error(`BaseLayout.astro에서 --${k} 색을 찾지 못했어요`);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dow = ['일', '월', '화', '수', '목', '금', '토'];
function dateLabel(e) {
  const f = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}(${dow[d.getUTCDay()]})`; };
  return e.startDate === e.endDate ? f(e.startDate) : `${f(e.startDate)} - ${f(e.endDate).slice(5)}`;
}
// 긴 글을 폭에 맞게 줄바꿈한다(글자 수 기준). 띄어쓰기가 있으면 단어 사이에서 끊어
// "FANT / ASY"처럼 단어가 쪼개지지 않게 하고, 한 단어가 줄보다 길 때만 글자 단위로 자른다.
function wrap(text, perLine, maxLines) {
  const lines = []; let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= perLine) { cur = next; continue; }
    if (cur) lines.push(cur);
    let w = word;
    while (w.length > perLine) { lines.push(w.slice(0, perLine)); w = w.slice(perLine); }
    cur = w;
  }
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
  const nameLines = wrap(name, 14, 3);
  const size = nameLines.length >= 3 ? 68 : nameLines.some((l) => l.length > 10) ? 84 : 104;
  const y0 = nameLines.length >= 3 ? 210 : 250;
  const nameSvg = nameLines.map((l, i) => `<text x="80" y="${y0 + i * (size + 12)}" font-size="${size}" font-weight="800" fill="${C.fg}">${esc(l)}</text>`).join('');
  const yInfo = y0 + (nameLines.length - 1) * (size + 12) + 90;
  const st = status(e);
  const venue = wrap(`${e.venue}${e.city && e.city !== '한국' ? ` · ${e.city}` : ''}`, 30, 1)[0];
  const isNew = isRecent(e);
  // 위쪽 라벨: 신규면 연두노랑(--eye) 칩 + 장르, 아니면 장르만. 영어 대문자 라벨은 쓰지 않는다
  const label = isNew
    ? `<rect x="80" y="86" width="84" height="46" rx="6" fill="${C.eye}"/><text x="122" y="119" font-size="26" font-weight="800" fill="${C.ink}" text-anchor="middle">신규</text><text x="184" y="119" font-size="28" font-weight="600" fill="${C['fg-2']}">${esc(e.genre)}</text>`
    : `<text x="80" y="119" font-size="28" font-weight="600" fill="${C['fg-2']}">${esc(e.genre)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="${FONT}">
  <rect width="1200" height="630" fill="${C.bg}"/>
  ${label}
  ${nameSvg}
  <text x="80" y="${yInfo}" font-size="44" font-weight="700" fill="${C.cheese}">${esc(dateLabel(e))}</text>
  <text x="80" y="${yInfo + 62}" font-size="34" font-weight="500" fill="${C['fg-2']}">${esc(venue)}</text>
  ${st ? `<text x="80" y="${yInfo + 120}" font-size="30" font-weight="600" fill="${st.startsWith('티켓 오픈') ? C.eye : C.muted}">${esc(st)}</text>` : ''}
  <text x="1120" y="119" font-size="26" fill="${C.muted}" text-anchor="end">jikgwannyang.com</text>
  <text x="1120" y="80" font-size="30" font-weight="800" fill="${C.fg}" text-anchor="end">직관냥</text>
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
