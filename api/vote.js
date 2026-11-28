// '올해의 공연' 투표 API (Vercel Serverless Function). 연말 정산 페이지(/2026/)에서 쓴다.
//   GET  /api/vote?year=2026            -> { total, top: [[공연id, 표], ...] }  (상위 30개)
//   POST /api/vote { year, event, prev? } -> 같은 모양. prev가 있으면 그 표를 빼고 새로 더한다(답 바꾸기).
// 저장하는 것: 해시 vote:<연도> 의 공연id별 정수뿐. 누가 골랐는지(IP/기기)는 저장하지 않는다.
// 브라우저는 localStorage로 한 표만 쥐게 하고, 서버는 IP별 시간당 횟수만 제한한다(키는 1시간 뒤 삭제).
// 서버는 공연 목록을 모르므로, 엉뚱한 id는 화면이 자기 목록에 있는 것만 보여주는 식으로 걸러낸다.
import { redis, redisAvailable } from './_redis.js';

const EVENT = /^[a-z0-9][a-z0-9_-]{0,99}$/i;
const YEARS = new Set(['2026']);
const HOURLY_LIMIT = 30;
const MAX_FIELDS = 1000;

function top(flat) {
  const pairs = [];
  for (let i = 0; i < (flat?.length ?? 0); i += 2) {
    const n = Number(flat[i + 1]) || 0;
    if (n > 0) pairs.push([String(flat[i]), n]);
  }
  pairs.sort((a, b) => b[1] - a[1]);
  return { total: pairs.reduce((s, p) => s + p[1], 0), top: pairs.slice(0, 30) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!redisAvailable()) return res.status(503).json({ error: 'unavailable' });

  try {
    if (req.method === 'GET') {
      const year = String(req.query?.year ?? '');
      if (!YEARS.has(year)) return res.status(400).json({ error: 'invalid' });
      const [flat] = await redis([['HGETALL', `vote:${year}`]]);
      return res.status(200).json(top(flat));
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    let b;
    try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch { return res.status(400).json({ error: 'bad_body' }); }
    const year = String(b.year ?? '');
    const event = String(b.event ?? '');
    const prev = b.prev == null ? '' : String(b.prev);
    if (!YEARS.has(year) || !EVENT.test(event) || (prev && !EVENT.test(prev))) return res.status(400).json({ error: 'invalid' });

    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const rlKey = `vote:rl:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const [hits] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 3600]]);
    if (hits > HOURLY_LIMIT) return res.status(429).json({ error: 'rate_limited' });

    const key = `vote:${year}`;
    if (prev !== event) {
      const [exists, len] = await redis([['HEXISTS', key, event], ['HLEN', key]]);
      if (!Number(exists) && Number(len) >= MAX_FIELDS) return res.status(429).json({ error: 'full' });
      const cmds = [['HINCRBY', key, event, 1]];
      if (prev) cmds.push(['HINCRBY', key, prev, -1]);
      const out = await redis(cmds);
      if (prev && Number(out[1]) < 0) await redis([['HSET', key, prev, 0]]);
    }
    const [flat] = await redis([['HGETALL', key]]);
    return res.status(200).json(top(flat));
  } catch {
    return res.status(502).json({ error: 'redis_error' });
  }
}
