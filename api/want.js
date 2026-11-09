// '가고 싶어요' 집계 API (Vercel Serverless Function). 공연별 숫자 하나만 센다.
//   GET  /api/want?event=<공연id>  -> { count }
//   GET  /api/want?top=20          -> { top: [[공연id, 수], ...] }  (공개 정보와 같은 수준이라 토큰 없이 연다)
//   POST /api/want  { event, action: 'add' | 'remove' }  -> { count }
// 저장하는 것: 해시 want:counts 의 공연id별 정수뿐. 누가 눌렀는지(닉네임/IP/기기)는 저장하지 않는다.
// 브라우저는 localStorage로 한 번만 누르게 하고, 서버는 IP별 시간당 횟수만 제한한다(키는 1시간 뒤 삭제).
// 저장소(Redis) 환경변수가 없으면 503을 돌려주고, 화면은 이 기능을 조용히 숨긴다.
import { createClient } from 'redis';

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const REDIS_URL = process.env.REDIS_URL;

const HOURLY_LIMIT = 60;
const MAX_FIELDS = 3000; // 서로 다른 공연id 상한 (엉뚱한 id로 키가 무한히 늘지 않게)
const HASH = 'want:counts';
const EVENT = /^[a-z0-9][a-z0-9_-]{0,99}$/i;

async function redis(commands) {
  if (REDIS_URL) {
    const client = createClient({ url: REDIS_URL, socket: { connectTimeout: 4000, reconnectStrategy: false } });
    client.on('error', () => {});
    await client.connect();
    try {
      const out = [];
      for (const c of commands) out.push(await client.sendCommand(c.map(String)));
      return out;
    } finally {
      client.disconnect().catch(() => {});
    }
  }
  const res = await fetch(`${REST_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return (await res.json()).map((r) => r.result);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL && !(REST_URL && REST_TOKEN)) return res.status(503).json({ error: 'unavailable' });

  try {
    if (req.method === 'GET') {
      if (req.query?.top !== undefined) {
        const n = Math.min(Math.max(Number(req.query.top) || 20, 1), 50);
        const [all] = await redis([['HGETALL', HASH]]);
        const pairs = [];
        for (let i = 0; i < (all?.length ?? 0); i += 2) pairs.push([all[i], Number(all[i + 1])]);
        pairs.sort((a, b) => b[1] - a[1]);
        return res.status(200).json({ top: pairs.filter((p) => p[1] > 0).slice(0, n) });
      }
      const event = String(req.query?.event ?? '');
      if (!EVENT.test(event)) return res.status(400).json({ error: 'invalid' });
      const [v] = await redis([['HGET', HASH, event]]);
      return res.status(200).json({ count: Math.max(Number(v) || 0, 0) });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    let b;
    try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch { return res.status(400).json({ error: 'bad_body' }); }
    const event = String(b.event ?? ''), action = String(b.action ?? '');
    if (!EVENT.test(event) || (action !== 'add' && action !== 'remove')) return res.status(400).json({ error: 'invalid' });

    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const hour = Math.floor(Date.now() / 3600000);
    const rlKey = `want:rl:${ip}:${hour}`;
    const [hits] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 3600]]);
    if (hits > HOURLY_LIMIT) return res.status(429).json({ error: 'rate_limited' });

    const [exists, len] = await redis([['HEXISTS', HASH, event], ['HLEN', HASH]]);
    if (!Number(exists)) {
      if (action === 'remove') return res.status(200).json({ count: 0 });
      if (Number(len) >= MAX_FIELDS) return res.status(429).json({ error: 'full' });
    }
    const [next] = await redis([['HINCRBY', HASH, event, action === 'add' ? 1 : -1]]);
    let count = Number(next);
    if (count < 0) { await redis([['HSET', HASH, event, 0]]); count = 0; } // 음수가 되지 않게 보정
    return res.status(200).json({ count });
  } catch {
    return res.status(502).json({ error: 'redis_error' });
  }
}
