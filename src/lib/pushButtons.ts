// 목록형 '알림 받기' 버튼 묶음(티켓오픈 일정, 연습 페이지). 버튼 = [data-push-id], 안내 문구 = [data-push-msg].
// 지금 기기에서 바로 켤 수 없으면(아이폰 사파리, 앱 안 브라우저 등) 알림 받는 법(/alerts/)의 맞는 단계로 보낸다.
// 버튼에 data-push-source를 달면 그 이름으로, 없으면 wirePushButtons의 source로 켠 화면을 센다.
import { pushSupport, serverKey, alertEvents, enableAlert, disableAlert } from './pushClient';

const GUIDE_HASH: Record<string, string> = { 'ios-install': '#ios-1', 'inapp-ios': '#ios-0', 'inapp-android': '#android', denied: '#trouble', unsupported: '' };

export function wirePushButtons(source: string, root: ParentNode = document) {
  const btns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-push-id]'));
  if (btns.length === 0) return;
  const msgs = Array.from(root.querySelectorAll<HTMLElement>('[data-push-msg]'));
  // 버튼과 같은 덩어리 안의 안내 칸에 쓴다(한 페이지에 목록이 둘일 때 엉뚱한 곳에 뜨지 않게).
  const say = (b: HTMLElement, html: string) => {
    const box = msgs.find((m) => m.parentElement?.contains(b)) ?? msgs[0];
    if (!box) return;
    box.innerHTML = html;
    box.hidden = !html;
  };
  const paint = () => {
    const on = new Set(alertEvents());
    btns.forEach((b) => {
      const x = on.has(b.dataset.pushId ?? '');
      b.classList.toggle('is-on', x);
      b.setAttribute('aria-pressed', String(x));
      b.textContent = x ? '알림 켜짐 ✓' : '알림 받기';
    });
  };
  serverKey().then((key) => {
    if (!key) return; // 서버에 알림 기능이 없으면 버튼을 숨긴 채 둔다
    btns.forEach((b) => { b.hidden = false; });
    paint();
  });
  window.addEventListener('push-alerts:changed', paint);
  btns.forEach((b) => b.addEventListener('click', async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const support = pushSupport();
    if (support !== 'ok') { location.href = `/alerts/${GUIDE_HASH[support] ?? ''}`; return; }
    const id = b.dataset.pushId ?? '';
    const on = alertEvents().includes(id);
    b.disabled = true;
    const r = on ? await disableAlert(id) : await enableAlert(id, b.dataset.pushSource || source);
    b.disabled = false;
    paint();
    if (r === 'on') say(b, '알림을 켰어요. 오픈 하루 전, 30분 전, 10분 전에 이 기기로 알려드려요.');
    else if (r === 'off') say(b, '이 공연 알림을 껐어요.');
    else if (r === 'denied') say(b, '알림 권한이 허용되지 않았어요. <a href="/alerts/#trouble">다시 허용하는 방법</a>');
    else say(b, '알림을 설정하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }));
}
