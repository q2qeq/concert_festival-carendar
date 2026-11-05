// "이번 주 공연" 계산/렌더 - 서버(빌드)와 브라우저가 같은 코드를 쓰도록 JSON 의존 없이 순수 함수로 둔다.
export interface WeekEvent { id: string; a: string; s: string; e: string; v: string; c: string; g: string; p: string; t: string; k: string }
export interface OpenItem { id: string; a: string; at: string }

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const todayKST = (now = Date.now()) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);

export function weekGroups(list: WeekEvent[], today: string) {
  const end = addDays(today, 6);
  const inWin = list.filter((x) => x.e >= today && x.s <= end).sort((a, b) => a.s.localeCompare(b.s));
  const now = inWin.filter((x) => x.s <= today && x.e >= today);
  const rest = inWin.filter((x) => !now.includes(x));
  const weekendDays: string[] = [];
  for (let i = 0; i < 7; i++) { const d = addDays(today, i); if ([5, 6, 0].includes(dow(d))) weekendDays.push(d); }
  const weekend = rest.filter((x) => weekendDays.some((d) => x.s <= d && x.e >= d));
  const others = rest.filter((x) => !weekend.includes(x));
  return { today: now, weekend, others, end, total: inWin.length };
}

export function rowHtml(x: WeekEvent): string {
  const md = `${x.s.slice(5, 7)}.${x.s.slice(8, 10)}`;
  const range = x.e !== x.s ? `–${x.e.slice(8, 10)}` : '';
  const th = x.p ? `<img class="th" src="${esc(x.p)}" alt="" loading="lazy" width="56" height="76">` : '<span class="th ph" aria-hidden="true"></span>';
  return `<li><a class="row" href="/events/${esc(x.id)}/"><span class="d mono">${md}${range}<small>${WD[dow(x.s)]}</small></span>${th}<span class="b"><strong>${esc(x.a)}</strong><em>${esc(x.v)} · ${esc(x.c)} · ${esc(x.g)}</em></span><span class="st st-${x.k}">${esc(x.t)}</span></a></li>`;
}

export function openHtml(o: OpenItem): string {
  const k = new Date(new Date(o.at).getTime() + 9 * 3600_000);
  const md = `${String(k.getUTCMonth() + 1).padStart(2, '0')}.${String(k.getUTCDate()).padStart(2, '0')}`;
  const hm = `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
  return `<li><a href="/events/${esc(o.id)}/"><span class="mono">${md} ${hm}</span> ${esc(o.a)}</a></li>`;
}

export function opensIn(list: OpenItem[], nowMs: number, days = 7) {
  return list.filter((o) => { const t = new Date(o.at).getTime(); return t >= nowMs - 3600_000 && t <= nowMs + days * 86400_000; })
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
