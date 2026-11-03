// 예매처 구분 - 링크/출처 URL의 도메인으로 판별한다 (이름 표기가 제각각이라 도메인이 가장 안정적).
export type VendorId = 'yes24' | 'melon' | 'nol' | 'ticketlink';

export const VENDORS: Record<VendorId, { name: string; short: string; home: string; domains: string[] }> = {
  yes24: { name: 'YES24 티켓', short: '예스24', home: 'https://ticket.yes24.com', domains: ['ticket.yes24.com', 'm.ticket.yes24.com'] },
  melon: { name: '멜론티켓', short: '멜론티켓', home: 'https://ticket.melon.com', domains: ['ticket.melon.com', 'm.ticket.melon.com'] },
  nol: { name: 'NOL 티켓(인터파크)', short: 'NOL 티켓', home: 'https://nol.interpark.com/ticket', domains: ['interpark.com', 'nol.yanolja.com', 'world.nol.com', 'nol.interpark.com'] },
  ticketlink: { name: '티켓링크', short: '티켓링크', home: 'https://www.ticketlink.co.kr', domains: ['ticketlink.co.kr'] },
};

export const VENDOR_IDS = Object.keys(VENDORS) as VendorId[];

export function vendorOfUrl(url: string): VendorId | null {
  let host = '';
  try { host = new URL(url).hostname; } catch { return null; }
  for (const id of VENDOR_IDS) {
    if (VENDORS[id].domains.some((d) => host === d || host.endsWith('.' + d))) return id;
  }
  return null;
}
