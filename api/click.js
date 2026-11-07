// 외부 링크 클릭 집계 API (Vercel Serverless Function).
// Vercel Analytics 커스텀 이벤트는 Pro 요금제에서만 보여서, 이미 연결된 Redis에 직접 센다.
//
// 저장하는 것: 날짜별 카운터뿐. 필드 = "링크종류|공연id|목적지호스트", 값 = 클릭 수.
// 닉네임/IP/기기 정보는 저장하지 않는다. (IP는 남용 방지용 시간당 카운터 키로만 쓰고 1시간 뒤 자동 삭제)
// 집계 확인: `npm run clicks:report` (scripts/click-report.mjs)
import { createClient } from 'redis';

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const REDIS_URL = process.env.REDIS_URL;

const HOURLY_LIMIT = 200; // IP당 시간당 허용 횟수 (사람이 눌러서 넘기 어려운 수준)
const MAX_FIELDS_PER_DAY = 5000; // 날짜별 서로 다른 조합 상한 (악의적 입력으로 키가 무한히 늘지 않게)
const KEEP_SECONDS = 400 * 24 * 3600;

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

const KIND = /^[a-z0-9:_-]{1,40}$/;
const EVENT = /^[a-z0-9_-]{0,100}$/i;
const HOST = /^[a-z0-9.-]{1,100}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch { return res.status(400).json({ error: 'bad_body' }); }
  const kind = String(b.kind ?? ''), event = String(b.event ?? ''), host = String(b.host ?? '').toLowerCase();
  if (!KIND.test(kind) || !EVENT.test(event) || !HOST.test(host)) return res.status(400).json({ error: 'invalid' });
  if (!REDIS_URL && !(REST_URL && REST_TOKEN)) return res.status(204).end(); // 저장소가 없으면 조용히 무시

  try {
    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const hour = Math.floor(Date.now() / 3600000);
    const rlKey = `clicks:rl:${ip}:${hour}`;
    const [count] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 3600]]);
    if (count > HOURLY_LIMIT) return res.status(429).json({ error: 'rate_limited' });

    const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); // 한국 날짜 기준
    const key = `clicks:${day}`;
    const field = `${kind}|${event}|${host}`;
    const [exists, len] = await redis([['HEXISTS', key, field], ['HLEN', key]]);
    if (!Number(exists) && Number(len) >= MAX_FIELDS_PER_DAY) return res.status(204).end();
    await redis([['HINCRBY', key, field, 1], ['EXPIRE', key, KEEP_SECONDS]]);
    return res.status(204).end();
  } catch {
    return res.status(204).end(); // 집계 실패가 사용자 이동을 막으면 안 된다
  }
}
