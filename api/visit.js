// 재방문 집계 API (Vercel Serverless Function). Vercel Analytics는 재방문을 보여 주지 않아서 직접 센다.
//   POST /api/visit { f }   브라우저가 하루 한 번(한국 날짜 기준) 보낸다. src/lib/visitTrack.ts
//   GET  /api/visit?days=30  헤더 Authorization: Bearer <CLICK_REPORT_TOKEN>  -> 날짜별 [필드, 수] (npm run visits:report)
// 저장하는 것: 날짜별 카운터 visits:YYYY-MM-DD 뿐. 필드는 아래 묶음 값을 '|'로 이은 것이다.
//   ev(day|install) · kind(new|return|legacy) · gap(마지막 방문 뒤 지난 날 구간) · cohort(첫 방문 주의 월요일)
//   · wk(이번 주 첫 방문이면 1) · app(홈 화면 앱으로 열었으면 1) · push(알림 권한 허용 1) · bm(찜 개수 구간)
//   · src(들어온 곳 종류) · page(들어온 페이지 종류)
// 브라우저를 구별하는 id·IP·기기 정보는 저장하지 않는다. IP는 시간당 횟수 제한 키로만 쓰고 1시간 뒤 지운다.
import { timingSafeEqual } from 'node:crypto';
import { redis, redisAvailable } from './_redis.js';

const HOURLY_LIMIT = 30;
const MAX_FIELDS_PER_DAY = 5000;
const KEEP_SECONDS = 400 * 24 * 3600;

const PARTS = [
  /^(day|install)$/,
  /^(new|return|legacy)$/,
  /^(-|1|2-7|8-30|31\+|\?)$/,
  /^(\d{4}-\d{2}-\d{2}|old)$/,
  /^[01]$/,
  /^[01]$/,
  /^[01]$/,
  /^(0|1|5)$/,
  /^(naver|google|daum|bing|social|direct|internal|other)$/,
  /^(home|event|practice|clock|venue|blog|schedule|tool|alerts|other)$/,
];

export function validField(f) {
  if (typeof f !== 'string' || f.length > 120) return false;
  const p = f.split('|');
  return p.length === PARTS.length && p.every((v, i) => PARTS[i].test(v));
}

const TOKEN = process.env.CLICK_REPORT_TOKEN || '';
function tokenOk(header) {
  const a = Buffer.from(String(header || '').replace(/^Bearer\s+/i, '')), b = Buffer.from(TOKEN);
  return TOKEN.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

const kstDay = (offset = 0) => new Date(Date.now() + 9 * 3600000 - offset * 86400000).toISOString().slice(0, 10);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!redisAvailable()) return res.status(req.method === 'POST' ? 204 : 404).end();

  if (req.method === 'GET') {
    if (!tokenOk(req.headers.authorization)) return res.status(401).json({ error: 'unauthorized' });
    const days = Math.min(Math.max(Number(req.query?.days) || 30, 1), 120);
    try {
      const keys = Array.from({ length: days }, (_, i) => kstDay(i));
      const all = await redis(keys.map((d) => ['HGETALL', `visits:${d}`]));
      const rows = [];
      all.forEach((h, i) => {
        // TCP 클라이언트는 [필드, 값, 필드, 값...] 배열, REST는 같은 배열을 돌려준다.
        const flat = Array.isArray(h) ? h : Object.entries(h || {}).flat();
        for (let j = 0; j + 1 < flat.length; j += 2) rows.push([keys[i], String(flat[j]), Number(flat[j + 1])]);
      });
      return res.status(200).json({ days, rows });
    } catch {
      return res.status(502).json({ error: 'redis_error' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch { return res.status(400).json({ error: 'bad_body' }); }
  if (!validField(b.f)) return res.status(400).json({ error: 'invalid' });

  try {
    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const rlKey = `visits:rl:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const [count] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 3600]]);
    if (Number(count) > HOURLY_LIMIT) return res.status(429).json({ error: 'rate_limited' });

    const key = `visits:${kstDay()}`;
    const [exists, len] = await redis([['HEXISTS', key, b.f], ['HLEN', key]]);
    if (!Number(exists) && Number(len) >= MAX_FIELDS_PER_DAY) return res.status(204).end();
    await redis([['HINCRBY', key, b.f, 1], ['EXPIRE', key, KEEP_SECONDS]]);
    return res.status(204).end();
  } catch {
    return res.status(204).end();
  }
}
