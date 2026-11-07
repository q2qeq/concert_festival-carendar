// 외부 링크 클릭 집계 조회 API (토큰 필요). 집계는 api/click.js가 Redis에 쌓는다.
//   GET /api/click-report?days=14   헤더 Authorization: Bearer <CLICK_REPORT_TOKEN>
// CLICK_REPORT_TOKEN 환경변수가 없으면 조회를 아예 막는다(404). 결과는 날짜별 [종류, 공연, 호스트, 클릭수] 목록.
import { createClient } from 'redis';
import { timingSafeEqual } from 'node:crypto';

const REDIS_URL = process.env.REDIS_URL;
const TOKEN = process.env.CLICK_REPORT_TOKEN || '';

function tokenOk(given) {
  const a = Buffer.from(String(given)), b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!TOKEN || !REDIS_URL) return res.status(404).json({ error: 'not_found' });
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tokenOk(auth)) return res.status(401).json({ error: 'unauthorized' });

  const days = Math.min(Math.max(Number(req.query?.days) || 14, 1), 90);
  const client = createClient({ url: REDIS_URL, socket: { connectTimeout: 4000, reconnectStrategy: false } });
  client.on('error', () => {});
  try {
    await client.connect();
    const rows = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(Date.now() + 9 * 3600000 - i * 86400000).toISOString().slice(0, 10);
      const h = await client.hGetAll(`clicks:${day}`);
      for (const [field, n] of Object.entries(h)) {
        const [kind, event, host] = field.split('|');
        rows.push([day, kind, event, host, Number(n)]);
      }
    }
    return res.status(200).json({ days, rows });
  } catch {
    return res.status(502).json({ error: 'redis_error' });
  } finally {
    client.disconnect().catch(() => {});
  }
}
