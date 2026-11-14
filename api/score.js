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
const MAX_SCORE = 20000;
const TOTAL_SEATS = 15; // 좌석 3라운드 합계 최대 (대기 순번이 앞이면 4+5+6)
const BTN_MAX = 4000; // 예매 버튼 3회 합계 최대 점수
const HOURLY_LIMIT = 60; // 단계 연습은 한 판이 짧아 더 자주 제출된다

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


// ── 초기 추정용 기준 분포 ─────────────────────────────────────────────────
// 참가자가 아직 적을 때 "상위 몇 %"가 한두 명 때문에 널뛰지 않도록, 일반적인 반응속도 기준의
// 정규분포(평균 6200점, 표준편차 3000점)를 가상의 150명 분량으로 함께 반영해서 추정한다.
// 이건 실제 참가자가 아니라 "샘플 분포"이고, 실제 참가자가 PRIOR_UNTIL명 이상이 되면 쓰지 않는다.
// 응답의 estimated=true일 때 화면은 반드시 "추정치"라고 표시한다 (참가자 수로 보여주지 않음).
const PRIOR_MEAN = 6200, PRIOR_SD = 3000, PRIOR_WEIGHT = 150, PRIOR_UNTIL = 300;
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function priorHist(mean = PRIOR_MEAN, sd = PRIOR_SD, bucket = BUCKET, max = MAX_SCORE) {
  const cdf = (x) => 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
  const out = {};
  const lo0 = cdf(0), hi0 = cdf(max);
  for (let b = 0; b * bucket < max; b++) {
    out[b] = (PRIOR_WEIGHT * (cdf((b + 1) * bucket) - cdf(b * bucket))) / (hi0 - lo0);
  }
  return out;
}

// lowerIsBetter: 반응시간(ms)처럼 작을수록 잘한 기록이면 true
function topPercent(hist, bucket, lowerIsBetter = false) {
  let total = 0, better = 0, same = 0;
  for (const [k, v] of Object.entries(hist)) {
    const n = Number(v), b = Number(k);
    total += n;
    if (lowerIsBetter ? b < bucket : b > bucket) better += n;
    else if (b === bucket) same += n;
  }
  if (total === 0) return { total: 0, top: 50 };
  const top = Math.min(99, Math.max(1, Math.round(((better + same / 2) / total) * 100)));
  return { total, top };
}

// ── 단계별 연습 순위 (2026-11-14) ─────────────────────────────────────────
// 전체 도전과 섞이지 않도록 단계마다 따로 센다. 기록 하나(value)만 받는다.
//   btn : 예매 버튼 3회 평균 반응(ms). 놓친 시도는 1500ms, 일찍 누른 횟수마다 +150ms. 작을수록 좋다.
//   zone: 구역 2라운드 평균 반응(ms) + 오클릭 1회당 500ms. 작을수록 좋다.
//   seat: 빈 좌석 3라운드 점수(중간 순번 기준, 최대 12석). 클수록 좋다.
const STAGES = {
  btn: { bucket: 20, max: 6000, min: 40, lower: true, mean: 380, sd: 180 },
  zone: { bucket: 50, max: 20000, min: 200, lower: true, mean: 1400, sd: 500 },
  seat: { bucket: 200, max: 12000, min: 0, lower: false, mean: 6000, sd: 2500 },
};
const STAGE_SEATS = 12;

async function stageRank(res, stage, b) {
  const cfg = STAGES[stage];
  const value = Number(b.value);
  let valid = Number.isInteger(value) && value >= cfg.min && value <= cfg.max;
  if (stage === 'seat') {
    const got = Number(b.got), avg = Number(b.avg);
    valid = valid && Number.isInteger(got) && got >= 0 && got <= STAGE_SEATS && value <= got * 1000 &&
      (got === 0 || (Number.isFinite(avg) && avg >= 60 && avg <= 3000));
  }
  if (!valid) return res.status(400).json({ error: 'invalid_score' });
  const bucket = Math.floor(value / cfg.bucket);
  const [, flat] = await redis([
    ['HINCRBY', `practice2:stage:${stage}:hist`, String(bucket), 1],
    ['HGETALL', `practice2:stage:${stage}:hist`],
  ]);
  const real = toHist(flat);
  const realTotal = Object.values(real).reduce((a, v) => a + Number(v), 0);
  const estimated = realTotal < PRIOR_UNTIL;
  let hist = real;
  if (estimated) {
    hist = { ...priorHist(cfg.mean, cfg.sd, cfg.bucket, cfg.max) };
    for (const [k, v] of Object.entries(real)) hist[k] = (hist[k] || 0) + Number(v);
  }
  const { top } = topPercent(hist, bucket, cfg.lower);
  return res.status(200).json({ total: realTotal, top, estimated });
}

function toHist(flat) {
  if (flat && !Array.isArray(flat)) return flat; // 객체로 오는 클라이언트도 지원
  const out = {};
  for (let i = 0; i < (flat || []).length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}

// 남용 방지: IP별 시간당 제출 횟수(전체·단계 합산). IP는 1시간 뒤 사라지는 카운터 키로만 쓴다.
async function overLimit(req) {
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const hour = Math.floor(Date.now() / 3600000);
  const rlKey = `practice2:rl:${ip}:${hour}`;
  const [count] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 3600]]);
  return count > HOURLY_LIMIT;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL && !(REST_URL && REST_TOKEN)) return res.status(503).json({ error: 'ranking_unavailable' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const stage = typeof b.stage === 'string' && b.stage !== 'full' ? b.stage : null;
  if (stage) {
    if (!STAGES[stage]) return res.status(400).json({ error: 'invalid_stage' });
    try {
      if (await overLimit(req)) return res.status(429).json({ error: 'rate_limited' });
      return await stageRank(res, stage, b);
    } catch {
      return res.status(502).json({ error: 'ranking_error' });
    }
  }
  const score = Number(b.score), got = Number(b.got), avg = Number(b.avg);
  const valid =
    Number.isInteger(score) && score >= 0 && score <= MAX_SCORE &&
    Number.isInteger(got) && got >= 0 && got <= TOTAL_SEATS &&
    // 점수는 잡은 개수에 비례(1개당 최대 1000점)하고, 사람 반응속도(평균 60ms 미만)는 비현실적이다.
    score <= got * 1000 + BTN_MAX &&
    (got === 0 || (Number.isFinite(avg) && avg >= 60 && avg <= 3000)) &&
    // 예매 버튼 평균 반응시간(ms): 전부 놓침은 -1, 그 외에는 사람이 가능한 범위(40ms 이상)만 받는다.
    (b.btn === undefined || b.btn === -1 || (Number.isFinite(Number(b.btn)) && Number(b.btn) >= 40 && Number(b.btn) <= 5000));
  if (!valid) return res.status(400).json({ error: 'invalid_score' });

  try {
    if (await overLimit(req)) return res.status(429).json({ error: 'rate_limited' });

    const bucket = Math.floor(score / BUCKET);
    const [, , flat] = await redis([
      ['HINCRBY', 'practice2:hist', String(bucket), 1],
      ['INCR', 'practice2:total'],
      ['HGETALL', 'practice2:hist'],
    ]);
    const real = toHist(flat);
    const realTotal = Object.values(real).reduce((a, v) => a + Number(v), 0);
    const estimated = realTotal < PRIOR_UNTIL;
    let hist = real;
    if (estimated) {
      hist = { ...priorHist() };
      for (const [k, v] of Object.entries(real)) hist[k] = (hist[k] || 0) + Number(v);
    }
    const { top } = topPercent(hist, bucket);
    return res.status(200).json({ total: realTotal, top, estimated });
  } catch {
    return res.status(502).json({ error: 'ranking_error' });
  }
}
