// 포도알 챌린지 순위 API (Vercel Serverless Function).
// 저장소: Redis. 연결 방식 두 가지를 모두 지원한다.
//   1) REDIS_URL (redis://...) - Vercel Marketplace의 Redis 연동이 넣어주는 값 (node-redis로 접속)
//   2) UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (또는 KV_REST_API_URL / KV_REST_API_TOKEN) - REST 방식
// 환경변수가 하나도 없으면 503을 돌려주고, 게임 화면은 순위 부분만 조용히 숨긴다.
//
// 저장하는 것: 점수 구간별 인원수(히스토그램)와 전체 참가자 수뿐. 닉네임/IP/기기 정보는 저장하지 않는다.
// (IP는 남용 방지용 카운터 키로만 쓰고 1시간 뒤 자동 삭제된다.)
import { createClient } from 'redis';

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const REDIS_URL = process.env.REDIS_URL;

const BUCKET = 200; // 점수 200점 단위로 묶어서 센다
const MAX_SCORE = 13000;
const TOTAL_SEATS = 12; // 3라운드 합계 (3+4+5)
const HOURLY_LIMIT = 30;

// commands: [['INCR','k'], ['HGETALL','h'], ...] -> 각 명령의 결과 배열
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

function topPercent(hist, bucket) {
  let total = 0, lower = 0, same = 0;
  for (const [k, v] of Object.entries(hist)) {
    const n = Number(v), b = Number(k);
    total += n;
    if (b < bucket) lower += n;
    else if (b === bucket) same += n;
  }
  if (total === 0) return { total: 0, top: 50 };
  const top = Math.max(1, Math.round(((total - lower - same / 2) / total) * 100));
  return { total, top };
}

function toHist(flat) {
  if (flat && !Array.isArray(flat)) return flat; // 객체로 오는 클라이언트도 지원
  const out = {};
  for (let i = 0; i < (flat || []).length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL && !(REST_URL && REST_TOKEN)) return res.status(503).json({ error: 'ranking_unavailable' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const score = Number(b.score), got = Number(b.got), avg = Number(b.avg);
  const valid =
    Number.isInteger(score) && score >= 0 && score <= MAX_SCORE &&
    Number.isInteger(got) && got >= 0 && got <= TOTAL_SEATS &&
    // 점수는 잡은 개수에 비례(1개당 최대 1000점)하고, 사람 반응속도(평균 60ms 미만)는 비현실적이다.
    score <= got * 1000 &&
    (got === 0 || (Number.isFinite(avg) && avg >= 60 && avg <= 3000));
  if (!valid) return res.status(400).json({ error: 'invalid_score' });

  try {
    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const hour = Math.floor(Date.now() / 3600000);
    const rlKey = `grape:rl:${ip}:${hour}`;
    const [count] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 3600]]);
    if (count > HOURLY_LIMIT) return res.status(429).json({ error: 'rate_limited' });

    const bucket = Math.floor(score / BUCKET);
    const [, , flat] = await redis([
      ['HINCRBY', 'grape:hist', String(bucket), 1],
      ['INCR', 'grape:total'],
      ['HGETALL', 'grape:hist'],
    ]);
    const { total, top } = topPercent(toHist(flat), bucket);
    return res.status(200).json({ total, top });
  } catch {
    return res.status(502).json({ error: 'ranking_error' });
  }
}
