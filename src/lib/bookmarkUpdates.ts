// 찜한 공연에 마지막 방문 이후 새 업데이트가 있는지 확인한다. 전부 이 브라우저 안에서만 계산한다.
// 'krconcerts:seen' = { 공연id: 마지막으로 확인한 업데이트 날짜(ISO) }
// 처음 찜한 공연은 오늘을 기준선으로 잡아, 과거 업데이트가 한꺼번에 "새 소식"으로 뜨지 않게 한다.
const BOOKMARK_KEY = 'krconcerts:bookmarks';
const SEEN_KEY = 'krconcerts:seen';

export interface NewsItem { id: string; date: string; text: string }

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function bookmarkedIds(): string[] {
  const v = readJson<unknown>(BOOKMARK_KEY, []);
  return Array.isArray(v) ? (v as string[]) : [];
}

export async function findNews(): Promise<NewsItem[]> {
  const ids = bookmarkedIds();
  if (ids.length === 0) return [];
  let data: Record<string, { d: string; t: string }>;
  try {
    const res = await fetch('/updates.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }
  const today = new Date().toISOString().slice(0, 10);
  const seen = readJson<Record<string, string>>(SEEN_KEY, {});
  let changed = false;
  const news: NewsItem[] = [];
  for (const id of ids) {
    if (!seen[id]) { seen[id] = today; changed = true; }
    const u = data[id];
    if (u && u.d > seen[id]) news.push({ id, date: u.d, text: u.t });
  }
  if (changed) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch {}
  }
  return news;
}

export function markSeen(items: NewsItem[]): void {
  if (items.length === 0) return;
  const seen = readJson<Record<string, string>>(SEEN_KEY, {});
  for (const n of items) seen[n.id] = n.date;
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch {}
}
