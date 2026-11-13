// 티켓오픈 푸시 알림 - 브라우저 쪽 공용 코드.
// 어떤 공연 알림을 켰는지는 이 브라우저(localStorage)에도 적어 둬서 버튼 상태를 바로 그린다.
// 서버(/api/push)에는 브라우저가 발급한 구독 정보와 공연 id만 간다.

const KEY = 'krconcerts:push-events';

export type PushSupport =
  | 'ok' // 바로 켤 수 있음
  | 'ios-install' // 아이폰·아이패드: 홈 화면에 추가한 뒤에만 가능
  | 'inapp-android' // 네이버·카카오톡 등 앱 안 브라우저(안드로이드): 크롬으로 열면 가능
  | 'inapp-ios' // 앱 안 브라우저(아이폰): 사파리로 연 뒤 홈 화면에 추가해야 가능
  | 'denied' // 사용자가 브라우저에서 알림을 차단해 둠
  | 'unsupported'; // 인앱 브라우저 등 푸시를 못 쓰는 환경

// 네이버 앱·카카오톡·인스타그램 등 앱 안에서 열리는 브라우저. 이런 곳은 푸시를 지원하지 않는다.
export const isInAppBrowser = (ua: string) =>
  /NAVER\(inapp|KAKAOTALK|KAKAOSTORY|DaumApps|Instagram|FBAN|FBAV|FB_IAB|Line\/|everytimeApp|BAND\/|Twitter|; wv\)/i.test(ua);

// 지금 보고 있는 페이지를 안드로이드 크롬으로 여는 주소(앱 안 브라우저 탈출용).
export function chromeIntentUrl(): string {
  const { host, pathname, search } = window.location;
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
}

// 지금 보고 있는 페이지를 아이폰 사파리로 여는 주소(iOS 17 이상에서 동작). 아이폰은 크롬으로 열어도
// 홈 화면에 설치해야만 푸시가 되고 크롬이 없는 기기도 많아서, 항상 깔려 있는 사파리로 보낸다.
export function safariUrl(): string {
  const { host, pathname, search } = window.location;
  return `x-safari-https://${host}${pathname}${search}`;
}

export function pushSupport(): PushSupport {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!has) {
    if (isInAppBrowser(ua)) return isIOS ? 'inapp-ios' : /Android/i.test(ua) ? 'inapp-android' : 'unsupported';
    return isIOS && !standalone ? 'ios-install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

export function alertEvents(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveAlertEvents(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* 저장소를 못 쓰면 버튼 상태만 유지되지 않는다 */ }
  window.dispatchEvent(new CustomEvent('push-alerts:changed'));
}

// 서버에 알림 기능이 켜져 있는지(VAPID 키가 있는지). 꺼져 있으면 버튼을 숨긴다.
let keyPromise: Promise<string | null> | null = null;
export function serverKey(): Promise<string | null> {
  keyPromise ??= fetch('/api/push')
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { key?: string } | null) => d?.key ?? null)
    .catch(() => null);
  return keyPromise;
}

function keyBytes(base64url: string): Uint8Array {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function post(subscription: PushSubscription, event: string, action: 'add' | 'remove'): Promise<string[] | null> {
  const r = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON(), event, action }),
  });
  if (!r.ok) return null;
  const d = (await r.json()) as { events?: string[] };
  return d.events ?? [];
}

export type ToggleResult = 'on' | 'off' | 'denied' | 'error';

// 반드시 클릭 같은 사용자 동작 안에서 호출한다(권한 요청 창이 그래야 뜬다).
export async function enableAlert(eventId: string): Promise<ToggleResult> {
  try {
    const key = await serverKey();
    if (!key) return 'error';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const events = await post(sub, eventId, 'add');
    if (!events) return 'error';
    saveAlertEvents(events);
    return 'on';
  } catch {
    return 'error';
  }
}

export async function disableAlert(eventId: string): Promise<ToggleResult> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const events = await post(sub, eventId, 'remove');
      if (!events) return 'error';
      saveAlertEvents(events);
      // 켜 둔 공연이 없으면 브라우저 구독도 해지한다
      if (events.length === 0) await sub.unsubscribe().catch(() => {});
    } else {
      saveAlertEvents(alertEvents().filter((x) => x !== eventId));
    }
    return 'off';
  } catch {
    return 'error';
  }
}
