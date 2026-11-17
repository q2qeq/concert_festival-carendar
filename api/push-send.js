// 티켓오픈 푸시 발송 (Vercel Serverless Function). GitHub Actions가 5분마다 호출한다.
//   POST /api/push-send   헤더 Authorization: Bearer <PUSH_SEND_TOKEN>
//   ?dry=1 이면 보낼 대상만 세고 실제로 보내지 않는다(발송 기록도 남기지 않는다).
// 사이트가 빌드 때 만든 /ticket-opens.json(공식 공지로 확인된 오픈 시각만 담김)을 읽어서
// 오픈까지 남은 시간이 아래 구간에 들어온 단계마다 한 번씩 보낸다.
//   하루 전(24시간 이내) · 30분 전 · 10분 전
// 호출이 몇 분 늦어도 문구가 틀리지 않도록 "N분 전" 대신 실제 오픈 시각과 남은 시간을 적는다.
// 같은 단계·같은 구간은 Redis 키(push:sent:...)로 한 번만 나가게 막는다.
// 같은 호출에서 공연 요청(api/request.js)도 확인한다: /request-index.json에 요청한 이름과 맞는 공연이
// 올라왔으면 기다리던 구독에 한 번 알리고 그 요청을 닫는다.
import webpush from 'web-push';
import { redis, redisAvailable } from './_redis.js';
import { matches } from './_match.js';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const TOKEN = process.env.PUSH_SEND_TOKEN;
const SITE = process.env.PUSH_SITE_URL || 'https://jikgwannyang.com';
const MIN = 60_000;

// 남은 시간(ms)으로 어느 구간인지 고른다. 이미 열렸으면 null.
export function windowOf(msLeft) {
  if (msLeft <= 0) return null;
  if (msLeft <= 12 * MIN) return '10m';
  if (msLeft <= 35 * MIN) return '30m';
  if (msLeft <= 24 * 60 * MIN) return 'day';
  return null;
}

const pad = (n) => String(n).padStart(2, '0');
export function message(stage, nowMs) {
  const at = new Date(stage.at).getTime();
  const left = at - nowMs;
  const k = new Date(at + 9 * 3600_000);
  const hm = `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
  const day = (ms) => Math.floor((ms + 9 * 3600_000) / 86400_000);
  const d = day(at) - day(nowMs);
  const dayWord = d === 0 ? '오늘' : d === 1 ? '내일' : `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
  const what = stage.multi ? stage.label : '티켓 오픈';
  const w = windowOf(left);
  const mins = Math.max(1, Math.round(left / MIN));
  const body = w === 'day'
    ? `${dayWord} ${hm}에 열려요. 로그인과 결제수단을 미리 확인해 두세요.`
    : `${dayWord} ${hm} 오픈, 약 ${mins}분 남았어요. 예매 창을 띄워 두세요.`;
  return {
    title: `${stage.artist} ${what}`,
    body,
    url: `/events/${stage.id}/`,
    tag: `open-${stage.id}`,
  };
}

export function requestMessage(e) {
  const [, m, d] = e.d.split('-').map(Number);
  return {
    title: `찾던 공연이 올라왔어요: ${e.a.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()}`,
    body: `${m}월 ${d}일 · ${e.v}. 들어가서 티켓오픈 알림을 켜 두세요.`,
    url: `/events/${e.id}/`,
    tag: `req-${e.id}`,
  };
}

// 요청한 공연이 올라왔는지 보고 알린다. 맞는 공연이 여럿이면 가장 가까운 날짜 하나만 알린다.
async function sendRequests(dry, out) {
  const [pending] = await redis([['SMEMBERS', 'req:pending']]);
  if (!pending || pending.length === 0) return;
  const r = await fetch(`${SITE}/request-index.json`, { cache: 'no-store' });
  if (!r.ok) return;
  const index = (await r.json()).sort((a, b) => a.d.localeCompare(b.d));
  const skips = await redis(pending.map((k) => ['SMEMBERS', `req:skip:${k}`]));

  for (const [i, key] of pending.entries()) {
    const skip = new Set(skips[i] ?? []);
    const ev = index.find((e) => !skip.has(e.id) && matches(key, e.k));
    if (!ev) continue;
    const [hashes] = await redis([['SMEMBERS', `req:wait:${key}`]]);
    if (dry) { out.requests += 1; out.sent += hashes?.length ?? 0; continue; }
    const [locked] = await redis([['SET', `req:sent:${key}:${ev.id}`, '1', 'NX', 'EX', 7 * 86400]]);
    if (!locked) continue;
    out.requests += 1;

    const dead = [];
    if (hashes && hashes.length > 0) {
      const [subs] = await redis([['MGET', ...hashes.map((h) => `push:sub:${h}`)]]);
      const payload = JSON.stringify(requestMessage(ev));
      await Promise.all(hashes.map(async (h, j) => {
        if (!subs[j]) { dead.push(h); return; }
        try {
          await webpush.sendNotification(JSON.parse(subs[j]), payload, { TTL: 3 * 86400, urgency: 'normal' });
          out.sent += 1;
        } catch (e) {
          if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(h);
          else out.failed += 1;
        }
      }));
    }
    // 요청을 닫는다. 요청 수(req:count)는 수요 집계로 남긴다.
    await redis([
      ['SREM', 'req:pending', key],
      ['DEL', `req:wait:${key}`, `req:skip:${key}`],
      ['HSET', 'req:done', key, ev.id],
    ]);
    const live = (hashes ?? []).filter((h) => !dead.includes(h));
    if (live.length > 0) {
      const left = await redis(live.flatMap((h) => [['SREM', `req:subq:${h}`, key], ['SCARD', `req:subq:${h}`], ['SCARD', `push:subev:${h}`]]));
      const empty = live.filter((_, j) => !Number(left[j * 3 + 1]) && !Number(left[j * 3 + 2]));
      if (empty.length > 0) await redis([['DEL', ...empty.flatMap((h) => [`push:sub:${h}`, `req:subq:${h}`])]]);
    }
    if (dead.length > 0) {
      out.removed += dead.length;
      await redis([['DEL', ...dead.flatMap((h) => [`push:sub:${h}`, `push:subev:${h}`, `req:subq:${h}`])]]);
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!PUBLIC_KEY || !PRIVATE_KEY || !TOKEN || !redisAvailable()) return res.status(503).json({ error: 'unavailable' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return res.status(401).json({ error: 'unauthorized' });
  const dry = req.query?.dry !== undefined;

  try {
    const r = await fetch(`${SITE}/ticket-opens.json`, { cache: 'no-store' });
    if (!r.ok) return res.status(502).json({ error: 'schedule_unavailable' });
    const stages = await r.json();
    const now = Date.now();
    webpush.setVapidDetails('https://jikgwannyang.com/contact/', PUBLIC_KEY, PRIVATE_KEY);

    const out = { due: 0, requests: 0, sent: 0, failed: 0, removed: 0, dry };
    for (const s of stages) {
      const at = new Date(s.at).getTime();
      const w = windowOf(at - now);
      if (!w) continue;
      const sentKey = `push:sent:${s.id}:${s.at}:${w}`;
      if (dry) {
        const [seen, n] = await redis([['EXISTS', sentKey], ['SCARD', `push:ev:${s.id}`]]);
        if (!Number(seen)) { out.due += 1; out.sent += Number(n); }
        continue;
      }
      // 먼저 기록을 잡고(NX) 보낸다 - 겹쳐 호출돼도 두 번 나가지 않게
      const [locked] = await redis([['SET', sentKey, '1', 'NX', 'EX', 2 * 86400]]);
      if (!locked) continue;
      out.due += 1;

      const [hashes] = await redis([['SMEMBERS', `push:ev:${s.id}`]]);
      if (!hashes || hashes.length === 0) continue;
      const [subs] = await redis([['MGET', ...hashes.map((h) => `push:sub:${h}`)]]);
      const payload = JSON.stringify(message(s, now));
      // 오픈 시각이 지나면 의미가 없으니 그때까지만 푸시 서비스가 보관하게 한다
      const ttl = Math.max(60, Math.floor((at - now) / 1000));
      const dead = [];
      await Promise.all(hashes.map(async (h, i) => {
        if (!subs[i]) { dead.push(h); return; }
        try {
          await webpush.sendNotification(JSON.parse(subs[i]), payload, { TTL: ttl, urgency: w === 'day' ? 'normal' : 'high' });
          out.sent += 1;
        } catch (e) {
          // 404·410은 사용자가 알림을 껐거나 구독이 만료된 것 - 정리한다
          if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(h);
          else out.failed += 1;
        }
      }));
      if (dead.length > 0) {
        out.removed += dead.length;
        await redis([
          ['SREM', `push:ev:${s.id}`, ...dead],
          ['DEL', ...dead.flatMap((h) => [`push:sub:${h}`, `push:subev:${h}`])],
        ]);
      }
    }
    // 요청 확인이 실패해도 티켓오픈 발송 결과는 그대로 돌려준다
    await sendRequests(dry, out).catch(() => { out.failed += 1; });
    return res.status(200).json(out);
  } catch {
    return res.status(502).json({ error: 'send_error' });
  }
}
