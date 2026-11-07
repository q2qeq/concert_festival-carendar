// 외부 링크 클릭을 Vercel Analytics 커스텀 이벤트로 남긴다("outbound").
// 어떤 공연·예매처·링크 종류가 클릭을 만드는지 알아야 제휴/광고 판단이 가능하다.
// 개인정보는 보내지 않는다: 목적지 호스트, 링크 종류, 공연 id, 출발 경로만.
// (커스텀 이벤트는 Vercel 요금제에 따라 대시보드에서 안 보일 수 있다 - 그때도 사이트 동작엔 영향 없음)
import { track } from '@vercel/analytics';
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

function onClick(ev: MouseEvent) {
  const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  let url: URL;
  try { url = new URL(a.href, location.href); } catch { return; }
  if (!/^https?:$/.test(url.protocol) || url.hostname === location.hostname) return;
  const eventId = location.pathname.match(/^\/events\/([^/]+)\/?$/)?.[1] ?? '';
  try {
    track('outbound', {
      kind: kindOf(a, url),
      host: url.hostname,
      event: eventId,
      from: location.pathname.slice(0, 60),
    });
  } catch {
    // 분석 실패는 조용히 무시
  }
}

document.addEventListener('click', onClick, true);
document.addEventListener('auxclick', onClick, true); // 휠클릭(새 탭)
