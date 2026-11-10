// 공연 카드의 티켓오픈 배지를 브라우저의 지금 시각 기준으로 갱신한다.
// 빌드 때 찍힌 문구("D-3")가 며칠 지나도 그대로 남지 않게, 30초마다 다시 계산한다.
import { badgeText, type StageLite } from './openPhase';

function refresh() {
  const now = Date.now();
  document.querySelectorAll<HTMLElement>('[data-open-badge]').forEach((el) => {
    let stages: StageLite[] = [];
    try { stages = JSON.parse(el.dataset.stages || '[]'); } catch { return; }
    const b = badgeText(stages, now);
    if (b) {
      el.textContent = b.text;
      el.classList.toggle('is-hot', b.hot);
      el.hidden = false;
    } else if (el.dataset.onsale === '1') {
      // 오픈이 다 지나면 원래의 "예매 오픈중" 표시로 돌아간다
      el.textContent = '예매 오픈중';
      el.classList.remove('is-hot');
    } else {
      el.hidden = true;
    }
  });
}

refresh();
window.setInterval(refresh, 30_000);
