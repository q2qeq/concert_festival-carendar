#!/usr/bin/env node
/**
 * 공유 카드(og:image 1200x630) 생성 - 공연 링크를 X·카톡 등에 공유할 때 보이는 썸네일.
 * 왼쪽에 공연명·날짜·공연장·티켓오픈 일정, 오른쪽에 공식 포스터(public/posters, 있을 때만)를 넣는다.
 * 세로 포스터를 그대로 og:image로 쓰면 X가 가운데만 잘라 보여 줘서 이 카드를 따로 만든다.
 * 결과: 포스터 있음 → public/og/<공연id>.jpg, 없음 → public/og/<공연id>.png (커밋해서 배포).
 * D-day는 날마다 바뀌므로 넣지 않고 날짜만 넣는다. 공연 정보가 바뀌면 그 공연만 다시 만든다.
 *
 * 사용:  npm run og:cards                  예정 공연 전부
 *        npm run og:cards -- <id> [<id>]   지정한 공연만
 * 글꼴은 맥이면 Apple SD Gothic Neo, 윈도면 기본 한글 글꼴인 맑은 고딕을 쓴다(글자 모양만 조금 다르다).
 * 서버(Vercel)에는 한글 글꼴이 없어서 빌드 때 만들지 않고, 작업하는 컴퓨터에서 만들어 커밋하는 방식이다.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const events = JSON.parse(readFileSync(join(root, 'src/data/events.json'), 'utf8'));
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
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
const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600_000);
const md = (d) => `${d.getUTCMonth() + 1}.${d.getUTCDate()}(${dow[d.getUTCDay()]})`;
const hm = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
// 티켓 상태 한 줄. 다음에 열리는 단계가 있으면 그 시각, 다 지났으면 '예매 중', 정보가 없으면 '발표 전'.
function status(e) {
  if (/추후|미정|미발표/.test(e.venue)) return { text: '공연장·티켓 일정 발표 전', on: false };
  const stages = e.ticketOpens?.length ? e.ticketOpens : e.ticketOpenAt ? [{ label: '', at: e.ticketOpenAt }] : [];
  const next = stages.filter((s) => new Date(s.at).getTime() > Date.now()).sort((a, b) => a.at.localeCompare(b.at))[0];
  if (next) {
    const d = kst(next.at);
    return { text: `티켓오픈 ${md(d)} ${hm(d)}${stages.length > 1 && next.label ? ` ${next.label}` : ''}`, on: true };
  }
  if (e.ticketLinks?.length || e.ticketUrl || stages.length) return { text: '예매 중', on: false };
  if (!e.ticketingAnnounced) return { text: '티켓 일정 발표 전', on: false };
  return null;
}

function svg(e, withPoster) {
  // 괄호 안 표기(한글 이름 등)는 빼서 공연명을 짧게 한다. 위에서 아래로: 사이트 이름 → 장르 → 공연명 → 날짜·공연장·티켓.
  const name = e.artist.replace(/\s*\([^)]*\)/g, '').trim();
  const per = withPoster ? 11 : 15;
  let nameLines = wrap(name, per, 3);
  // 세 줄에도 안 들어가는 긴 공연명은 글자를 줄여 네 줄까지 쓴다
  const tight = nameLines.at(-1).endsWith('…');
  if (tight) nameLines = wrap(name, per + 4, 4);
  const longest = Math.max(...nameLines.map((l) => l.length));
  const size = tight ? 48 : nameLines.length >= 3 ? 62 : longest > per - 3 ? 78 : 100;
  const nameBottom = 385;
  const nameSvg = nameLines.map((l, i) => `<text x="80" y="${nameBottom - (nameLines.length - 1 - i) * (size + 12)}" font-size="${size}" font-weight="800" fill="${C.fg}">${esc(l)}</text>`).join('');
  const st = status(e);
  const venue = wrap(`${e.venue}${e.city && e.city !== '한국' ? ` · ${e.city}` : ''}`, withPoster ? 20 : 30, 1)[0];
  const isNew = isRecent(e);
  // 장르 줄: 신규면 연두노랑(--eye) 칩 + 장르. 영어 대문자 라벨은 쓰지 않는다
  const label = isNew
    ? `<rect x="80" y="104" width="84" height="44" rx="6" fill="${C.eye}"/><text x="122" y="135" font-size="26" font-weight="800" fill="${C.ink}" text-anchor="middle">신규</text><text x="184" y="135" font-size="28" font-weight="600" fill="${C['fg-2']}">${esc(e.genre)}</text>`
    : `<text x="80" y="135" font-size="28" font-weight="600" fill="${C['fg-2']}">${esc(e.genre)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="${FONT}">
  <rect width="1200" height="630" fill="${C.bg}"/>
  <text x="80" y="76" font-size="28" fill="${C.muted}"><tspan font-weight="800" fill="${C.fg}">직관냥</tspan>  jikgwannyang.com</text>
  ${label}
  ${nameSvg}
  <text x="80" y="462" font-size="44" font-weight="700" fill="${C.cheese}">${esc(dateLabel(e))}</text>
  <text x="80" y="520" font-size="34" font-weight="500" fill="${C['fg-2']}">${esc(venue)}</text>
  ${st ? `<text x="80" y="576" font-size="32" font-weight="700" fill="${st.on ? C.eye : C.muted}">${esc(st.text)}</text>` : ''}
</svg>`;
}

const args = process.argv.slice(2);
const isRecent = (e) => e.addedAt && (new Date(today) - new Date(e.addedAt)) / 86400000 <= 7;
const targets = args.length
  ? events.filter((e) => args.includes(e.id))
  : events.filter((e) => e.endDate >= today && e.status !== 'cancelled');
mkdirSync(join(root, 'public/og'), { recursive: true });
// 포스터 칸: 오른쪽 위아래 60px 여백, 높이 510px. 포스터 비율을 지키고 자르지 않는다.
const PH = 510, PW = 380, PX = 1200 - 70, PY = 60;
for (const e of targets) {
  const posterFile = e.posterUrl?.startsWith('/posters/') ? join(root, 'public', e.posterUrl) : null;
  const withPoster = !!posterFile && existsSync(posterFile);
  let img = sharp(Buffer.from(svg(e, withPoster)));
  if (withPoster) {
    const poster = await sharp(posterFile).resize({ width: PW, height: PH, fit: 'inside' }).toBuffer({ resolveWithObject: true });
    const { width, height } = poster.info;
    img = sharp(await img.png().toBuffer()).composite([{ input: poster.data, left: PX - width, top: PY + Math.round((PH - height) / 2) }]);
  }
  const ext = withPoster ? 'jpg' : 'png';
  const buf = withPoster ? await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer() : await img.png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(root, 'public/og', `${e.id}.${ext}`), buf);
  const other = join(root, 'public/og', `${e.id}.${withPoster ? 'png' : 'jpg'}`);
  if (existsSync(other)) unlinkSync(other); // 포스터가 새로 생기거나 없어졌으면 옛 카드를 지운다
  console.log(`og/${e.id}.${ext}  ${(buf.length / 1024).toFixed(0)}KB`);
}
if (targets.length === 0) console.log('만들 공연이 없어요.');
