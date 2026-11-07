// 외부 링크 클릭을 우리 쪽 Redis에 센다(/api/click). Vercel Analytics 커스텀 이벤트는 Pro 요금제가 필요해서 직접 집계한다.
// 어떤 공연·예매처·링크 종류가 클릭을 만드는지 알아야 제휴/광고 판단이 가능하다.
// 개인정보는 보내지 않는다: 링크 종류, 목적지 호스트, 공연 id만(날짜별 카운터로만 저장됨).
import { vendorOfUrl } from './vendors';

function kindOf(a: HTMLAnchorElement, url: URL): string {
  const vendor = vendorOfUrl(url.href);
  if (vendor) return `ticket:${vendor}`;
  const ctx = a.closest('[data-track-kind]')?.getAttribute('data-track-kind');
  if (ctx) return ctx;
  if (/(^|\.)(x|twitter)\.com$/.test(url.hostname)) return 'sns';
  if (/(^|\.)(instagram|youtube|youtu)\.(com|be)$/.test(url.hostname)) return 'sns';
  if (a.closest('.ad-slot, ins.adsbygoogle')) return 'ad';
  return 'other';
}

function send(payload: Record<string, string>) {
  const body = JSON.stringify(payload);
  try {
    // 페이지를 떠나는 클릭이라 sendBeacon(이탈 중에도 전송됨)을 쓰고, 안 되면 keepalive fetch로 대신한다.
    if (navigator.sendBeacon?.('/api/click', new Blob([body], { type: 'text/plain' }))) return;
    void fetch('/api/click', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } });
  } catch {
    // 집계 실패는 조용히 무시
  }
}

function onClick(ev: MouseEvent) {
  const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  let url: URL;
  try { url = new URL(a.href, location.href); } catch { return; }
  if (!/^https?:$/.test(url.protocol) || url.hostname === location.hostname) return;
  const eventId = location.pathname.match(/^\/events\/([^/]+)\/?$/)?.[1] ?? '';
  send({ kind: kindOf(a, url), event: eventId, host: url.hostname });
}

document.addEventListener('click', onClick, true);
document.addEventListener('auxclick', onClick, true); // 휠클릭(새 탭)
