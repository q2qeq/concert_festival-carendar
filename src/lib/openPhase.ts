// 티켓오픈 카운트다운 공용 계산 - 빌드(서버)와 브라우저 양쪽에서 쓴다.
// 정적 사이트라 빌드 시점 상태로 먼저 그리고, 브라우저가 지금 시각으로 다시 계산한다.

export interface StageLite {
  label: string;
  at: string; // ISO
  until?: string;
}

// 오픈 직후 이 시간 동안은 "지금 오픈" 상태로 본다 (끝 시각이 공지된 선예매는 그 시각까지).
const LIVE_WINDOW_MS = 2 * 3600_000;

export type OpenPhase =
  | { kind: 'before'; stage: StageLite; index: number; msLeft: number }
  | { kind: 'live'; stage: StageLite; index: number }
  | { kind: 'after' };

export function openPhase(stages: StageLite[], nowMs: number): OpenPhase {
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    const at = new Date(s.at).getTime();
    const end = s.until ? new Date(s.until).getTime() : at + LIVE_WINDOW_MS;
    if (nowMs < at) return { kind: 'before', stage: s, index: i, msLeft: at - nowMs };
    if (nowMs < end) return { kind: 'live', stage: s, index: i };
  }
  return { kind: 'after' };
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');

// KST 기준 "11월 12일(목) 12:00"
export function kstLabel(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일(${WEEK[k.getUTCDay()]}) ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

// KST 기준 "11.12 12:00" (카드 배지용 짧은 표기)
export function kstShort(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${k.getUTCMonth() + 1}.${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

// 오늘 기준 D-day (KST 날짜 차이). 오픈 당일이면 0.
export function kstDayDiff(iso: string, nowMs: number): number {
  const day = (ms: number) => Math.floor((ms + 9 * 3600_000) / 86400_000);
  return day(new Date(iso).getTime()) - day(nowMs);
}

// 남은 시간 "02:13:05" (24시간 미만일 때 큰 시계용)
export function hms(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

// 카드 배지 문구: "티켓오픈 D-3 · 11.12 12:00" / "오늘 20:00 오픈" / "오픈 12분 전" / "지금 오픈"
export function badgeText(stages: StageLite[], nowMs: number): { text: string; hot: boolean } | null {
  const p = openPhase(stages, nowMs);
  if (p.kind === 'after') return null;
  const multi = stages.length > 1;
  // 카드 배지는 좁아서 "아티스트 코드 선예매" 같은 긴 이름은 "선예매"로 줄인다
  const name = !multi ? '티켓오픈' : p.stage.label.includes('선예매') ? '선예매' : p.stage.label.includes('일반') ? '일반예매' : p.stage.label;
  if (p.kind === 'live') return { text: `${name} 진행 중`, hot: true };
  const d = kstDayDiff(p.stage.at, nowMs);
  const hm = kstShort(p.stage.at).split(' ')[1];
  if (p.msLeft < 3600_000) return { text: `${name} ${Math.max(1, Math.ceil(p.msLeft / 60_000))}분 전`, hot: true };
  if (d === 0) return { text: `${name} 오늘 ${hm}`, hot: true };
  if (d === 1) return { text: `${name} 내일 ${hm}`, hot: true };
  return { text: `${name} D-${d} · ${kstShort(p.stage.at)}`, hot: d <= 7 };
}
