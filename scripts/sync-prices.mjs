#!/usr/bin/env node
// 예스24·멜론티켓 상품 페이지에서 등급별 정가를 읽어 events.json의 prices를 채운다.
//   npm run prices:sync              가격이 없는 예정 공연만 채움
//   npm run prices:sync -- --all     이미 있는 가격도 다시 확인(달라지면 바꾸고 무엇이 바뀌었는지 출력)
//   npm run prices:sync -- --dry     파일은 고치지 않고 결과만 출력
//   npm run prices:sync -- <id> ...  지정한 공연만
//
// 지키는 것:
// - 예매 페이지의 공연 기간에 우리 공연 시작일이 들어 있고 공연장 이름이 맞을 때만 넣는다. 안 맞으면 건너뛰고 이유를 출력한다.
// - 한 공연에 예매처가 둘 이상이고 가격이 서로 다르면 넣지 않는다(CLAUDE.md "출처끼리 숫자가 다르면 쓰지 않는다").
// - NOL(nol.yanolja.com)·티켓링크·29CM은 여기서 열지 않는다. NOL은 브라우저가 아닌 요청을 막고,
//   티켓링크·29CM은 화면이 스크립트로 그려져 HTML에 가격이 없다. 이 예매처만 있는 공연은
//   npm run events:gaps 목록에 남으니 브라우저(Claude in Chrome)로 열어 손으로 넣는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'src/data/events.json');
const raw = readFileSync(file, 'utf8');
const events = JSON.parse(raw);
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const only = args.filter((a) => !a.startsWith('--'));
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const UA = 'Mozilla/5.0 (compatible; jikgwannyang-prices; +https://jikgwannyang.com/about/)';

const strip = (h) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#40;/g, '(').replace(/&#41;/g, ')').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// "R석 176,000 원" → {label:'R석', price:176000}
function parseItems(list) {
  const m = new Map();
  for (const t of list) {
    const x = t.match(/^(.*?)\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
    if (x && x[1].trim()) m.set(x[1].trim(), Number(x[2].replace(/,/g, '')));
  }
  return [...m].map(([label, price]) => ({ label, price }));
}
// 공연장 이름 비교: 띄어쓰기·괄호·영문 표기 차이를 넘기 위해 앞 글자 몇 개만 본다. 영문/한글 표기가 다른 곳은 별칭으로.
const ALIAS = [['yes24livehall', '예스24라이브홀'], ['yes24원더로크홀', '예스24원더로크홀'], ['kbs아레나', 'kbs스포츠월드'], ['킨텍스', 'kintex'], ['인스파이어', 'inspire'], ['무신사개러지', 'musinsagarage']];
const norm = (s) => (s ?? '').toLowerCase().replace(/바로가기|\s|[()[\],·.&內]/g, '');
function sameVenue(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x.includes(y.slice(0, 4)) || y.includes(x.slice(0, 4))) return true;
  return ALIAS.some(([p, q]) => (x.includes(p) || x.includes(q)) && (y.includes(p) || y.includes(q)));
}

async function readPage(url) {
  const html = await (await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) })).text();
  if (/yes24\.com/.test(url)) {
    const ld = (html.match(/application\/ld\+json">(\{[^<]*"@type":"Event"[^<]*)</) || [])[1];
    const j = ld ? JSON.parse(ld) : {};
    const box = (html.match(/id="divPrice"[\s\S]*?<\/ul>/) || [''])[0];
    return { vendor: '예스24 티켓', title: j.name, place: j.location?.name, from: j.startDate, to: j.endDate, prices: parseItems([...box.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => strip(m[1]))) };
  }
  const box = (html.match(/class="box_bace_price"[\s\S]*?<\/ul>/) || [''])[0];
  const period = strip((html.match(/id="periodInfo"[^>]*>([\s\S]*?)<\//) || [])[1] || '');
  const [from, to] = period.split(' - ').map((d) => d.trim().replace(/\./g, '-'));
  return { vendor: '멜론티켓', title: strip((html.match(/class="tit"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || ''), place: strip((html.match(/class="place"[^>]*>([\s\S]*?)<\/a>/) || [])[1] || ''), from, to: to ?? from, prices: parseItems([...box.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => strip(m[1]))) };
}

// 가격 비교는 '서로 다른 금액의 집합'으로 한다. 요일별 1일권처럼 금액이 같은 줄은 손으로 한 줄로 합쳐 둔 경우가 있다.
const key = (p) => [...new Set(p.map((x) => x.price))].sort((a, b) => b - a).join(',');
let changed = 0;
for (const e of events) {
  if (e.endDate < today || e.status === 'cancelled') continue;
  if (only.length ? !only.includes(e.id) : (e.prices?.length && !flags.has('--all'))) continue;
  const urls = [e.ticketUrl, ...(e.ticketLinks ?? []).map((l) => l.url)].filter((u) => u && /ticket\.yes24\.com\/(Perf|Special)\/\d+|ticket\.melon\.com\/performance\/index\.htm\?prodId=\d+/.test(u));
  if (urls.length === 0) continue;
  const found = [];
  for (const url of [...new Set(urls)]) {
    try {
      const p = await readPage(url);
      if (!p.prices.length) { console.log(`건너뜀 ${e.id}: 가격표를 못 읽음 (${url})`); continue; }
      if (!(p.from && p.from <= e.startDate && e.startDate <= (p.to || p.from))) { console.log(`건너뜀 ${e.id}: 공연 기간 불일치 - 우리 ${e.startDate}, 예매처 ${p.from}~${p.to} (${url})`); continue; }
      if (!sameVenue(p.place, e.venue)) { console.log(`건너뜀 ${e.id}: 공연장 불일치 - 우리 "${e.venue}", 예매처 "${p.place}" (${url})`); continue; }
      found.push({ url, ...p });
    } catch (err) { console.log(`건너뜀 ${e.id}: 페이지를 못 엶 (${String(err.message ?? err).slice(0, 60)})`); }
  }
  if (found.length === 0) continue;
  if (!found.every((f) => key(f.prices) === key(found[0].prices))) { console.log(`건너뜀 ${e.id}: 예매처끼리 가격이 다름 - ${found.map((f) => `${f.vendor} ${key(f.prices)}`).join(' / ')}`); continue; }
  const pick = found[0];
  const before = e.prices?.length ? key(e.prices) : '';
  if (before && before !== key(pick.prices)) console.log(`가격 변경 ${e.id}: ${before} → ${key(pick.prices)}`);
  if (before === key(pick.prices) && e.pricesCheckedAt === today) continue;
  if (before !== key(pick.prices)) e.prices = pick.prices; // 같은 가격이면 손으로 다듬은 등급 이름을 유지한다
  e.pricesCheckedAt = today;
  e.pricesSource = { label: `${pick.vendor} 예매 페이지`, url: pick.url };
  changed++;
  console.log(`${before ? '확인' : '채움'} ${e.id}: ${e.prices.map((x) => `${x.label} ${x.price.toLocaleString('ko-KR')}원`).join(', ')}`);
}
if (changed && !flags.has('--dry')) writeFileSync(file, JSON.stringify(events, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
console.log(`\n${changed}건 ${flags.has('--dry') ? '(파일은 고치지 않음)' : '반영'}`);
