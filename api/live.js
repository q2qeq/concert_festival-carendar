// 티켓 오픈 실황판 API (Vercel Serverless Function). 오픈 당일 방문자가 익명으로 누른 제보를 센다.
//   GET  /api/live?event=<공연id>&stage=<단계번호>  -> { q: {구간: 수}, r: {결과: 수} }
//   POST /api/live  { event, stage, kind: 'q'|'r', value, prev? }  -> 같은 모양
//     kind q = 대기번호 구간, r = 결과. prev가 있으면 이전 선택을 하나 빼고 새 선택을 더한다(답 바꾸기).
// 저장하는 것: 해시 live:<공연id>:<단계> 의 "q:구간"/"r:결과" 정수뿐. 누가 눌렀는지(IP/기기)는 저장하지 않는다.
// 브라우저는 localStorage로 한 번만 누르게 하고, 서버는 IP별 시간당 횟수만 제한한다(키는 1시간 뒤 삭제).
// 오픈 시각 검사는 화면(OpenLiveBoard)이 한다. 서버는 엉뚱한 id로 키가 무한히 늘지 않게 공연 수만 묶는다.
// 지난 오픈 기록으로 다시 쓸 수 있게 400일 보관한다.
import { redis, redisAvailable } from './_redis.js';

const Q = ['none', '1k', '10k', '50k', '100k', 'over'];
const R = ['got', 'trying', 'fail'];
const EVENT = /^[a-z0-9][a-z0-9_-]{0,99}$/i;
const HOURLY_LIMIT = 120; // 통신사 망은 여러 사람이 IP 하나를 같이 쓰기도 해서 넉넉히
const MAX_BOARDS = 3000;
const KEEP_SECONDS = 400 * 24 * 3600;
const INDEX = 'live:index';

function shape(flat) {
  const out = { q: {}, r: {} };
  for (let i = 0; i < (flat?.length ?? 0); i += 2) {
    const [kind, value] = String(flat[i]).split(':');
    const n = Math.max(Number(flat[i + 1]) || 0, 0);
    if (kind === 'q' && Q.includes(value)) out.q[value] = n;
    if (kind === 'r' && R.includes(value)) out.r[value] = n;
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!redisAvailable()) return res.status(503).json({ error: 'unavailable' });

  try {
    if (req.method === 'GET') {
      const event = String(req.query?.event ?? '');
      const stage = Number(req.query?.stage ?? 0);
      if (!EVENT.test(event) || !Number.isInteger(stage) || stage < 0 || stage > 9) return res.status(400).json({ error: 'invalid' });
      const [flat] = await redis([['HGETALL', `live:${event}:${stage}`]]);
      return res.status(200).json(shape(flat));
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    let b;
    try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch { return res.status(400).json({ error: 'bad_body' }); }
    const event = String(b.event ?? '');
    const stage = Number(b.stage ?? 0);
    const kind = String(b.kind ?? '');
    const value = String(b.value ?? '');
    const prev = b.prev == null ? '' : String(b.prev);
    const allowed = kind === 'q' ? Q : kind === 'r' ? R : null;
    if (!EVENT.test(event) || !Number.isInteger(stage) || stage < 0 || stage > 9 || !allowed || !allowed.includes(value) || (prev && !allowed.includes(prev))) {
      return res.status(400).json({ error: 'invalid' });
    }

    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const hour = Math.floor(Date.now() / 3600000);
    const rlKey = `live:rl:${ip}:${hour}`;
    const [hits] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 3600]]);
    if (hits > HOURLY_LIMIT) return res.status(429).json({ error: 'rate_limited' });

    const key = `live:${event}:${stage}`;
    const [known, boards] = await redis([['SISMEMBER', INDEX, key], ['SCARD', INDEX]]);
    if (!Number(known)) {
      if (Number(boards) >= MAX_BOARDS) return res.status(429).json({ error: 'full' });
      await redis([['SADD', INDEX, key]]);
    }

    const cmds = [];
    if (prev && prev !== value) cmds.push(['HINCRBY', key, `${kind}:${prev}`, -1]);
    if (prev !== value) cmds.push(['HINCRBY', key, `${kind}:${value}`, 1]);
    cmds.push(['EXPIRE', key, KEEP_SECONDS], ['HGETALL', key]);
    const out = await redis(cmds);
    const counts = shape(out[out.length - 1]);
    // 이전 선택을 빼다 음수가 되면 0으로 맞춘다(다른 기기에서 지운 경우 등)
    if (prev && Number(out[0]) < 0) { await redis([['HSET', key, `${kind}:${prev}`, 0]]); counts[kind][prev] = 0; }
    return res.status(200).json(counts);
  } catch {
    return res.status(502).json({ error: 'redis_error' });
  }
}
