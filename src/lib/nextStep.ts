// 공연 페이지 "지금 할 일" 한 문장(NextSteps.astro)이 무엇을 보여 줄지 고른다.
// 빌드(서버)와 브라우저 양쪽에서 쓴다. 날짜는 모두 KST 기준이다.
import { openPhase, type StageLite } from './openPhase';

export interface NextStepInput {
  start: string; // YYYY-MM-DD
  end: string;
  stages: StageLite[];
  onSale: boolean; // 예매처 상품 링크가 있는지
}

export type NextStep = { kind: 'none' | 'sale' | 'week'; days: number };

// 공연 시작 이 날수 전부터는 예매보다 가는 길·막차가 급하다.
const WEEK_DAYS = 7;

const kstDay = (ms: number) => Math.floor((ms + 9 * 3600_000) / 86400_000);
const isoDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400_000);

export function nextStepKind(e: NextStepInput, nowMs: number): NextStep {
  const today = kstDay(nowMs);
  const days = Math.max(0, isoDay(e.start) - today);
  if (!e.start || !e.end || isoDay(e.end) < today) return { kind: 'none', days };
  // 오픈 전·오픈 중에는 상단 카운트다운이 할 일을 안내한다.
  if (e.stages.length > 0 && openPhase(e.stages, nowMs).kind !== 'after') return { kind: 'none', days };
  if (isoDay(e.start) - today <= WEEK_DAYS) return { kind: 'week', days };
  return e.onSale ? { kind: 'sale', days } : { kind: 'none', days };
}
