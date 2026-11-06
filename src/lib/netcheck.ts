// 인터넷 상태 측정 공용 로직 - /internet-speed/ 와 /ticketing-check/ 가 같이 쓴다.
// 모든 측정은 방문자 브라우저 안에서만 일어나고 서버에 저장하지 않는다.
// 판정 기준은 일반적인 경험치(참고용)라서 한곳(THRESH)에 모아 두고, 페이지 설명표도 같은 값을 읽는다.

export type Verdict = { s: 'ok' | 'warn' | 'bad' | 'na'; msg: string };

export const THRESH = {
  ping: { okMs: 150, okJitter: 150, warnMs: 350 },
  speed: { okMbps: 5, warnMbps: 1.5 },
  vendor: { okMs: 250, warnMs: 600 },
} as const;

export const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

// ── 이 사이트까지의 지연 ─────────────────────────────────────────
export type PingResult = { ms: number; jitter: number };

export async function measurePing(n = 5): Promise<PingResult | null> {
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    try {
      const t0 = performance.now();
      await fetch(`/favicon.svg?p=${Date.now()}${i}`, { cache: 'no-store' });
      t.push(performance.now() - t0);
    } catch { /* 실패한 시도는 건너뜀 */ }
  }
  if (t.length < 3) return null;
  return { ms: median(t), jitter: Math.max(...t) - Math.min(...t) };
}

export function judgePing(r: PingResult | null): Verdict {
  if (!r) return { s: 'na', msg: '요청에 실패했어요. 연결 상태를 확인해 보세요.' };
  const base = `응답 ${Math.round(r.ms)}ms (편차 ${Math.round(r.jitter)}ms).`;
  if (r.ms <= THRESH.ping.okMs && r.jitter <= THRESH.ping.okJitter) return { s: 'ok', msg: base + ' 안정적이에요.' };
  if (r.ms <= THRESH.ping.warnMs) return { s: 'warn', msg: base + ' 조금 느리거나 들쭉날쭉해요. Wi-Fi 위치를 바꾸거나 다른 기기를 잠시 꺼 보세요.' };
  return { s: 'bad', msg: base + ' 많이 느려요. 유선·다른 네트워크로 바꾸는 걸 권해요.' };
}

// ── 다운로드 속도(어림) ──────────────────────────────────────────
export async function measureSpeed(probes: { url: string }[]): Promise<number | null> {
  let bytes = 0;
  const t0 = performance.now();
  try {
    for (const p of probes) {
      const r = await fetch(`${p.url}?s=${Date.now()}`, { cache: 'no-store' });
      bytes += (await r.arrayBuffer()).byteLength;
    }
  } catch { return null; }
  const sec = (performance.now() - t0) / 1000;
  return (bytes * 8) / sec / 1e6;
}

export function judgeSpeed(mbps: number | null): Verdict {
  if (mbps === null) return { s: 'na', msg: '측정에 실패했어요.' };
  const base = `대략 ${mbps.toFixed(1)}Mbps.`;
  if (mbps >= THRESH.speed.okMbps) return { s: 'ok', msg: base + ' 예매에는 충분해요.' };
  if (mbps >= THRESH.speed.warnMbps) return { s: 'warn', msg: base + ' 다소 느려요. 오픈 직전에는 다른 다운로드를 멈춰 두세요.' };
  return { s: 'bad', msg: base + ' 느려요. 다른 네트워크를 쓰는 게 좋아요.' };
}

// ── 예매처까지의 응답 시간 ───────────────────────────────────────
// 예매처 응답은 읽을 수 없으니(CORS) no-cors 요청이 "응답 헤더가 도착할 때까지" 걸린 시간만 잰다.
// 첫 요청은 DNS·TLS 연결 비용이 섞이므로 버리고, 이어지는 요청의 중앙값을 쓴다.
export async function fetchOnce(url: string, timeoutMs = 6000): Promise<number | null> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: c.signal });
    const dt = performance.now() - t0;
    c.abort(); // 본문은 필요 없으니 헤더만 받고 끊는다
    return dt;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function measureVendor(url: string, rounds = 4): Promise<number | null> {
  const first = await fetchOnce(url);
  if (first === null) return null;
  const t: number[] = [];
  for (let i = 1; i < rounds; i++) {
    const v = await fetchOnce(url);
    if (v !== null) t.push(v);
  }
  return t.length ? median(t) : first;
}

export function judgeVendor(ms: number | null): Verdict {
  if (ms === null) return { s: 'na', msg: '응답을 못 받았어요. 광고 차단·VPN·보안 프로그램이 막고 있을 수 있어요.' };
  const base = `응답 ${Math.round(ms)}ms.`;
  if (ms <= THRESH.vendor.okMs) return { s: 'ok', msg: base + ' 빠르게 닿아요.' };
  if (ms <= THRESH.vendor.warnMs) return { s: 'warn', msg: base + ' 다소 느려요. 예매처가 붐비는 중이거나 내 연결이 불안정할 수 있어요.' };
  return { s: 'bad', msg: base + ' 많이 느려요. 다른 네트워크로 한 번 더 재보세요.' };
}
