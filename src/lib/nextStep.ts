// 공연 페이지 "지금 할 일" 한 문장(NextSteps.astro)이 무엇을 보여 줄지 고른다.
// 빌드(서버)와 브라우저 양쪽에서 쓴다. 날짜는 모두 KST 기준이다.
//
// 연습 안내 규칙(2026-11-18): 예정 공연 페이지에는 연습 안내가 늘 하나 있다.
//   티켓 오픈이 아직 안 왔으면 티켓팅 연습(/practice/), 왔으면 취켓팅 연습(/practice/?stage=cancel).
//   "왔다"는 오픈 단계가 모두 지났거나 예매처 상품 링크가 걸려 있다는 뜻이다.
import { openPhase, type StageLite } from './openPhase';

export interface NextStepInput {
  start: string; // YYYY-MM-DD
  end: string;
  stages: StageLite[];
  onSale: boolean; // 예매처 상품 링크가 있는지
}

// none: 그리지 않음(끝난 공연, 또는 상단 카운트다운이 안내하는 오픈 전·오픈 중)
// soon: 오픈 일정 발표 전 → 티켓팅 연습
// sale: 오픈이 지남 → 취켓팅 연습
// week: 공연 7일 전부터 → 막차 계산이 주 동작, 연습은 보조 링크(practice)
export type NextStep = {
  kind: 'none' | 'soon' | 'sale' | 'week';
  days: number;
  practice: 'ticketing' | 'cancel';
};

// 공연 시작 이 날수 전부터는 예매보다 가는 길·막차가 급하다.
const WEEK_DAYS = 7;

const kstDay = (ms: number) => Math.floor((ms + 9 * 3600_000) / 86400_000);
const isoDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400_000);

export function nextStepKind(e: NextStepInput, nowMs: number): NextStep {
  const today = kstDay(nowMs);
  const days = Math.max(0, isoDay(e.start) - today);
  const phase = e.stages.length > 0 ? openPhase(e.stages, nowMs).kind : null;
  const opened = e.onSale || phase === 'after';
  const practice = opened ? 'cancel' : 'ticketing';
  if (!e.start || !e.end || isoDay(e.end) < today) return { kind: 'none', days, practice };
  // 오픈 전·오픈 중에는 상단 카운트다운이 시계와 티켓팅 연습을 안내한다.
  if (phase === 'before' || phase === 'live') return { kind: 'none', days, practice };
  if (isoDay(e.start) - today <= WEEK_DAYS) return { kind: 'week', days, practice };
  return { kind: opened ? 'sale' : 'soon', days, practice };
}
