// 공연 추가 요청 API (Vercel Serverless Function). "찾는 공연이 없나요?" 상자가 부른다.
//   POST /api/request { name, action: 'add' | 'remove', subscription?, skip? }  -> { ok, requests? }
//     name          방문자가 적은 아티스트 이름(60자까지)
//     subscription  있으면 그 공연이 올라올 때 이 브라우저로 푸시를 보낸다(/api/push-send가 5분마다 확인)
//     skip          요청할 때 "이미 있어요"로 보여 줬는데 방문자가 다른 공연이라고 한 공연 id들 - 이걸로는 알리지 않는다
//   GET  /api/request?top=50   헤더 Authorization: Bearer <CLICK_REPORT_TOKEN>  -> 많이 요청된 이름(운영용)
// 저장하는 것: 이름을 비교용으로 다듬은 키별 요청 수와 처음 들어온 표기, 알림을 원한 브라우저 푸시 구독.
// 이름·이메일 같은 개인 정보는 받지 않는다. IP는 시간당 횟수 제한에만 쓰고 1시간 뒤 지운다.
//   req:count            해시  키 -> 요청 수(알림을 보낸 뒤에도 남겨 수요 집계로 쓴다)
//   req:name             해시  키 -> 처음 들어온 표기
//   req:pending          집합  아직 공연이 안 올라온 요청 키
//   req:wait:<키>        집합  이 요청의 알림을 기다리는 구독 h
//   req:subq:<h>         집합  이 구독이 기다리는 요청 키
//   req:skip:<키>        집합  알리지 않을 공연 id
//   req:done             해시  키 -> 알림을 보낸 공연 id
import { timingSafeEqual } from 'node:crypto';
import { redis, redisAvailable } from './_redis.js';
import { validSubscription, subHash } from './push.js';
import { norm } from './_match.js';

const HOURLY_LIMIT = 20;
const MAX_KEYS = 3000;
const MAX_PER_SUB = 20;
const TTL = 60 * 60 * 24 * 400;
const EVENT = /^[a-z0-9][a-z0-9_-]{0,99}$/i;
const REPORT_TOKEN = process.env.CLICK_REPORT_TOKEN || '';

function tokenOk(given) {
  const a = Buffer.from(String(given)), b = Buffer.from(REPORT_TOKEN);
  return REPORT_TOKEN.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

const pairs = (flat) => {
  const out = [];
  for (let i = 0; i < (flat?.length ?? 0); i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!redisAvailable()) return res.status(503).json({ error: 'unavailable' });

  try {
    if (req.method === 'GET') {
      if (!tokenOk(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))) return res.status(401).json({ error: 'unauthorized' });
      const n = Math.min(Math.max(Number(req.query?.top) || 50, 1), 500);
      const [counts, names, pending, done] = await redis([['HGETALL', 'req:count'], ['HGETALL', 'req:name'], ['SMEMBERS', 'req:pending'], ['HGETALL', 'req:done']]);
      const nameOf = Object.fromEntries(pairs(names));
      const doneOf = Object.fromEntries(pairs(done));
      const pend = new Set(pending ?? []);
      const keys = pairs(counts).map(([k, c]) => [k, Number(c)]).sort((a, b) => b[1] - a[1]).slice(0, n);
      const waits = keys.length ? await redis(keys.map(([k]) => ['SCARD', `req:wait:${k}`])) : [];
      const rows = keys.map(([k, c], i) => ({ key: k, name: nameOf[k] ?? k, count: c, waiting: Number(waits[i]) || 0, pending: pend.has(k), event: doneOf[k] ?? null }));
      return res.status(200).json({ rows });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    let b;
    try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch { return res.status(400).json({ error: 'bad_body' }); }
    const name = String(b.name ?? '').replace(/\s+/g, ' ').trim();
    const action = String(b.action ?? 'add');
    const key = norm(name);
    if (name.length > 60 || key.length < 2 || key.length > 40 || /https?:|www\./i.test(name) || (action !== 'add' && action !== 'remove')) {
      return res.status(400).json({ error: 'invalid' });
    }
    const hasSub = b.subscription !== undefined && b.subscription !== null;
    if (hasSub && !validSubscription(b.subscription)) return res.status(400).json({ error: 'invalid' });
    if (action === 'remove' && !hasSub) return res.status(400).json({ error: 'invalid' });

    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const rlKey = `req:rl:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const [hits] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 3600]]);
    if (hits > HOURLY_LIMIT) return res.status(429).json({ error: 'rate_limited' });

    const sub = hasSub ? { endpoint: b.subscription.endpoint, keys: { p256dh: b.subscription.keys.p256dh, auth: b.subscription.keys.auth } } : null;
    const h = sub ? subHash(sub.endpoint) : null;

    if (action === 'remove') {
      const [, , left, evs] = await redis([
        ['SREM', `req:subq:${h}`, key],
        ['SREM', `req:wait:${key}`, h],
        ['SCARD', `req:subq:${h}`],
        ['SCARD', `push:subev:${h}`],
      ]);
      // 기다리는 요청도, 켜 둔 티켓오픈 알림도 없으면 구독 정보를 지운다
      if (!Number(left) && !Number(evs)) await redis([['DEL', `push:sub:${h}`, `req:subq:${h}`]]);
      const [requests] = await redis([['SMEMBERS', `req:subq:${h}`]]);
      return res.status(200).json({ ok: true, requests: requests ?? [] });
    }

    const [exists, len] = await redis([['HEXISTS', 'req:count', key], ['HLEN', 'req:count']]);
    if (!Number(exists) && Number(len) >= MAX_KEYS) return res.status(429).json({ error: 'full' });

    let fresh = true;
    if (sub) {
      const [n, member] = await redis([['SCARD', `req:subq:${h}`], ['SISMEMBER', `req:subq:${h}`, key]]);
      if (!Number(member) && Number(n) >= MAX_PER_SUB) return res.status(429).json({ error: 'full' });
      fresh = !Number(member);
      await redis([
        ['SET', `push:sub:${h}`, JSON.stringify(sub), 'EX', TTL],
        ['SADD', `req:subq:${h}`, key],
        ['EXPIRE', `req:subq:${h}`, TTL],
        ['SADD', `req:wait:${key}`, h],
        ['EXPIRE', `req:wait:${key}`, TTL],
        ['SADD', 'req:pending', key],
        ['HDEL', 'req:done', key],
      ]);
    }
    const skip = (Array.isArray(b.skip) ? b.skip : []).map(String).filter((x) => EVENT.test(x)).slice(0, 10);
    const cmds = [['HSETNX', 'req:name', key, name]];
    if (fresh) cmds.push(['HINCRBY', 'req:count', key, 1]);
    if (skip.length) cmds.push(['SADD', `req:skip:${key}`, ...skip], ['EXPIRE', `req:skip:${key}`, TTL]);
    await redis(cmds);

    if (!sub) return res.status(200).json({ ok: true });
    const [requests] = await redis([['SMEMBERS', `req:subq:${h}`]]);
    return res.status(200).json({ ok: true, requests: requests ?? [] });
  } catch {
    return res.status(502).json({ error: 'redis_error' });
  }
}
