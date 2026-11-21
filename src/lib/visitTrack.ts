// 재방문 측정: 이 브라우저가 언제 처음 왔고 마지막으로 언제 왔는지만 localStorage에 적고,
// 한국 날짜로 하루에 한 번 묶음 값 하나를 /api/visit에 보낸다. 브라우저 id는 만들지 않는다.
// 서버는 날짜별 카운터만 쌓는다(api/visit.js). 리포트는 npm run visits:report.
//
// 한계: 사파리의 저장 기간 제한·인앱 브라우저·기기 변경으로 기록이 지워지면 재방문이 새 방문으로 잡힌다.
// 그래서 재방문 비율은 실제보다 낮게 나오는 쪽으로 틀린다.
const KEY = 'krconcerts:visit';

type Visit = { first: string; last: string; week: string; legacy?: boolean };

const kstDay = (t = Date.now()) => new Date(t + 9 * 3600000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
function mondayOf(day: string) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function gapBucket(n: number) {
  if (n <= 1) return '1';
  if (n <= 7) return '2-7';
  if (n <= 30) return '8-30';
  return '31+';
}

function srcOf() {
  let host = '';
  try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* 무시 */ }
  if (!host) return 'direct';
  if (host === location.hostname) return 'internal';
  if (/naver\.com$/.test(host)) return 'naver';
  if (/(^|\.)google\./.test(host)) return 'google';
  if (/(daum\.net|kakao\.com)$/.test(host)) return 'daum';
  if (/bing\.com$/.test(host)) return 'bing';
  if (/(x|twitter|instagram|threads|facebook|youtube)\.(com|net)$|t\.co$/.test(host)) return 'social';
  return 'other';
}

function pageOf() {
  const p = location.pathname;
  if (p === '/') return 'home';
  if (p.startsWith('/events/') && p.length > 8) return 'event';
  if (p.startsWith('/practice')) return 'practice';
  if (p.startsWith('/ticketing-clock')) return 'clock';
  if (p.startsWith('/venues/')) return 'venue';
  if (p.startsWith('/blog/')) return 'blog';
  if (p.startsWith('/schedule') || p.startsWith('/events') || p.startsWith('/ticket-open')) return 'schedule';
  if (p.startsWith('/alerts')) return 'alerts';
  if (/^\/(trip-cost|return-trip|internet-speed|ticketing-check|tools)/.test(p)) return 'tool';
  return 'other';
}

function isApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function bookmarkBucket() {
  try {
    const n = (JSON.parse(localStorage.getItem('krconcerts:bookmarks') || '[]') as unknown[]).length;
    return n >= 5 ? '5' : n >= 1 ? '1' : '0';
  } catch {
    return '0';
  }
}

const pushOn = () => (typeof Notification !== 'undefined' && Notification.permission === 'granted' ? '1' : '0');

function send(f: string) {
  const body = JSON.stringify({ f });
  try {
    if (navigator.sendBeacon?.('/api/visit', new Blob([body], { type: 'text/plain' }))) return;
    void fetch('/api/visit', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } });
  } catch { /* 집계 실패는 무시 */ }
}

function read(): Visit | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && typeof v.first === 'string' && typeof v.last === 'string' ? v : null;
  } catch {
    return null;
  }
}

// 측정을 넣기 전부터 오던 브라우저: 기록은 없지만 찜·연습 기록 같은 다른 흔적이 있다.
function hasOldTraces() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (k.startsWith('krconcerts:') && k !== KEY) return true;
    }
  } catch { /* 무시 */ }
  return false;
}

function track() {
  if (navigator.webdriver) return;
  const today = kstDay();
  const week = mondayOf(today);
  const prev = read();
  if (prev?.last === today) return; // 오늘은 이미 보냈다

  let kind: string, gap: string, cohort: string, wk: string;
  let next: Visit;
  if (prev) {
    kind = 'return';
    gap = gapBucket(daysBetween(prev.last, today));
    cohort = prev.legacy ? 'old' : mondayOf(prev.first);
    wk = prev.week === week ? '0' : '1';
    next = { ...prev, last: today, week };
  } else if (hasOldTraces()) {
    kind = 'legacy';
    gap = '?';
    cohort = 'old';
    wk = '1';
    next = { first: today, last: today, week, legacy: true };
  } else {
    kind = 'new';
    gap = '-';
    cohort = week;
    wk = '1';
    next = { first: today, last: today, week };
  }
  // 저장이 안 되는 브라우저(사생활 보호 모드 등)는 매일 '새 방문'으로 부풀지 않게 아예 보내지 않는다.
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    if (localStorage.getItem(KEY) === null) return;
  } catch {
    return;
  }
  send(['day', kind, gap, cohort, wk, isApp() ? '1' : '0', pushOn(), bookmarkBucket(), srcOf(), pageOf()].join('|'));
}

function trackInstall() {
  const v = read();
  const cohort = !v ? mondayOf(kstDay()) : v.legacy ? 'old' : mondayOf(v.first);
  send(['install', v ? 'return' : 'new', '-', cohort, '0', '1', pushOn(), bookmarkBucket(), 'internal', pageOf()].join('|'));
}

window.addEventListener('appinstalled', trackInstall);
if (document.readyState === 'complete') setTimeout(track, 0);
else window.addEventListener('load', () => setTimeout(track, 0), { once: true });
