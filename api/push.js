// 티켓오픈 푸시 알림 구독 API (Vercel Serverless Function).
//   GET  /api/push                 -> { key }  브라우저가 구독할 때 쓰는 VAPID 공개키
//   POST /api/push { subscription, event, action: 'add' | 'remove' }  -> { ok, events }
//   GET  /api/push?report  헤더 Authorization: Bearer <CLICK_REPORT_TOKEN>  -> 구독 기기 수·공연별 신청 수(운영용, npm run push:report)
// 저장하는 것: 브라우저가 발급한 푸시 구독 정보(주소·암호화 키)와 그 구독이 알림을 켠 공연 id뿐.
// 이름·이메일·IP 같은 건 저장하지 않는다. IP는 시간당 횟수 제한에만 쓰고 1시간 뒤 지운다.
//   push:sub:<h>    구독 정보(JSON)        h = 구독 주소의 sha256 앞 32자
//   push:subev:<h>  이 구독이 켠 공연 id 집합
//   push:ev:<id>    이 공연 알림을 켠 구독 h 집합
// VAPID 키나 저장소가 없으면 503을 돌려주고, 화면은 알림 버튼을 숨긴다.
import { createHash, timingSafeEqual } from 'node:crypto';
import { redis, redisAvailable } from './_redis.js';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const HOURLY_LIMIT = 40;
const MAX_EVENTS_PER_SUB = 60;
const TTL = 60 * 60 * 24 * 400; // 구독 정보는 400일 뒤 자동 삭제(공연이 다 지난 구독이 쌓이지 않게)
const EVENT = /^[a-z0-9][a-z0-9_-]{0,99}$/i;
// 실제 브라우저 푸시 서비스 주소만 받는다. 아무 주소나 받으면 발송 때 우리 서버가 그 주소를 호출하게 된다.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function validSubscription(s) {
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1000) return false;
  if (typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') return false;
  if (s.keys.p256dh.length > 200 || s.keys.auth.length > 100) return false;
  try {
    const u = new URL(s.endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}
const REPORT_TOKEN = process.env.CLICK_REPORT_TOKEN || '';
function reportTokenOk(header) {
  const a = Buffer.from(String(header || '').replace(/^Bearer\s+/i, '')), b = Buffer.from(REPORT_TOKEN);
  return REPORT_TOKEN.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function scanKeys(pattern) {
  const keys = [];
  let cursor = '0';
  do {
    const [[next, batch]] = await redis([['SCAN', cursor, 'MATCH', pattern, 'COUNT', 500]]);
    cursor = String(next);
    keys.push(...batch);
  } while (cursor !== '0' && keys.length < 100_000);
  return keys;
}

const platformOf = (host) =>
  /push\.apple\.com$/.test(host) ? 'apple' : host === 'fcm.googleapis.com' ? 'chrome' : /mozilla/.test(host) ? 'firefox' : /windows/.test(host) ? 'edge' : 'other';

// 구독 정보에는 기기·사람을 알 수 있는 값이 없다. 푸시 서비스 주소의 호스트로 브라우저 종류만 센다.
async function report() {
  const subKeys = await scanKeys('push:sub:*');
  const platforms = {};
  let withEvents = 0;
  for (let i = 0; i < subKeys.length; i += 200) {
    const chunk = subKeys.slice(i, i + 200);
    const hashes = chunk.map((k) => k.slice('push:sub:'.length));
    const replies = await redis([['MGET', ...chunk], ...hashes.map((h) => ['SCARD', `push:subev:${h}`])]);
    replies[0].forEach((raw) => {
      let host = 'other';
      try { host = new URL(JSON.parse(raw).endpoint).hostname; } catch { /* 깨진 값은 other */ }
      const p = platformOf(host);
      platforms[p] = (platforms[p] || 0) + 1;
    });
    withEvents += replies.slice(1).filter((n) => Number(n) > 0).length;
  }
  const evKeys = await scanKeys('push:ev:*');
  const counts = evKeys.length ? await redis(evKeys.map((k) => ['SCARD', k])) : [];
  const events = evKeys
    .map((k, i) => ({ id: k.slice('push:ev:'.length), subs: Number(counts[i]) }))
    .filter((e) => e.subs > 0)
    .sort((a, b) => b.subs - a.subs);
  return { devices: subKeys.length, withEvents, platforms, events };
}

export const subHash = (endpoint) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!PUBLIC_KEY || !redisAvailable()) return res.status(503).json({ error: 'unavailable' });

  if (req.method === 'GET' && req.query?.report !== undefined) {
    if (!reportTokenOk(req.headers.authorization)) return res.status(401).json({ error: 'unauthorized' });
    try { return res.status(200).json(await report()); } catch { return res.status(502).json({ error: 'redis_error' }); }
  }
  if (req.method === 'GET') return res.status(200).json({ key: PUBLIC_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch { return res.status(400).json({ error: 'bad_body' }); }
  const event = String(b.event ?? ''), action = String(b.action ?? '');
  if (!EVENT.test(event) || (action !== 'add' && action !== 'remove') || !validSubscription(b.subscription)) {
    return res.status(400).json({ error: 'invalid' });
  }
  const sub = { endpoint: b.subscription.endpoint, keys: { p256dh: b.subscription.keys.p256dh, auth: b.subscription.keys.auth } };
  const h = subHash(sub.endpoint);

  try {
    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const rlKey = `push:rl:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const [hits] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 3600]]);
    if (hits > HOURLY_LIMIT) return res.status(429).json({ error: 'rate_limited' });

    if (action === 'add') {
      const [n, member] = await redis([['SCARD', `push:subev:${h}`], ['SISMEMBER', `push:subev:${h}`, event]]);
      if (!Number(member) && Number(n) >= MAX_EVENTS_PER_SUB) return res.status(429).json({ error: 'full' });
      await redis([
        ['SET', `push:sub:${h}`, JSON.stringify(sub), 'EX', TTL],
        ['SADD', `push:subev:${h}`, event],
        ['EXPIRE', `push:subev:${h}`, TTL],
        ['SADD', `push:ev:${event}`, h],
        ['EXPIRE', `push:ev:${event}`, TTL],
      ]);
    } else {
      const [, , left, reqs] = await redis([
        ['SREM', `push:subev:${h}`, event],
        ['SREM', `push:ev:${event}`, h],
        ['SCARD', `push:subev:${h}`],
        ['SCARD', `req:subq:${h}`],
      ]);
      // 켜 둔 공연도, 기다리는 공연 요청(api/request.js)도 없으면 구독 정보 자체를 지운다
      if (!Number(left) && !Number(reqs)) await redis([['DEL', `push:sub:${h}`, `push:subev:${h}`]]);
    }
    const [events] = await redis([['SMEMBERS', `push:subev:${h}`]]);
    return res.status(200).json({ ok: true, events: events ?? [] });
  } catch {
    return res.status(502).json({ error: 'redis_error' });
  }
}
