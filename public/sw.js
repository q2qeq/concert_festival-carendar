// 직관냥 서비스워커 - 티켓오픈 푸시 알림만 담당한다.
// 페이지를 캐시하지 않는다: 일정이 매일 바뀌는 사이트라 낡은 화면을 보여주는 쪽이 더 해롭다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* 본문이 JSON이 아니면 기본 문구로 */ }
  const title = data.title || '직관냥';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // 알림에 실린 주소는 우리 사이트 안쪽 경로만 연다
  let target = '/';
  try {
    const u = new URL(event.notification.data?.url || '/', self.location.origin);
    if (u.origin === self.location.origin) target = u.href;
  } catch { /* 기본값 사용 */ }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url === target && 'focus' in w) return w.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
