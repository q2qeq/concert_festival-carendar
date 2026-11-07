// 블로그(이슈) 글 ↔ 공연 페이지 상호 링크용 헬퍼 (2026-11-05).
// 구글 색인 현황: 블로그 글 다수가 "발견됨 - 현재 색인 안 됨"(크롤링 이력 없음)이었다.
// 홈·공연 상세·글 하단에서 글로 가는 내부 링크를 늘려 크롤링 우선순위를 높이기 위함.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function allPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function latestPosts(limit = 3, excludeId?: string): Promise<Post[]> {
  return (await allPosts()).filter((p) => p.id !== excludeId).slice(0, limit);
}

// 본문에 `/events/<id>/` 링크가 실제로 들어 있는 글만 - 억지 연결을 만들지 않는다.
export async function postsMentioningEvent(eventId: string, limit = 3): Promise<Post[]> {
  const needle = `/events/${eventId}/`;
  return (await allPosts()).filter((p) => (p.body ?? '').includes(needle)).slice(0, limit);
}

// 본문에 `/venues/<slug>/` 링크가 들어 있는 글 - 공연장 가이드 글을 공연장·공연 페이지에서 찾게 한다.
export async function postsMentioningVenue(venueSlugValue: string, limit = 3): Promise<Post[]> {
  const needle = `/venues/${venueSlugValue}/`;
  return (await allPosts()).filter((p) => (p.body ?? '').includes(needle)).slice(0, limit);
}

export function postDateLabel(d: Date): string {
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

// 글 하단 "다른 이슈" 추천. 항상 최신 글만 보여주면 오래된 글은 안쪽 링크를 거의 못 받아
// 색인이 늦어진다(2026-11 구글: 블로그 11개가 "발견됨 - 색인 안 됨"). 그래서
// 1) 태그가 겹치는 글을 먼저, 2) 나머지는 날짜순으로 이어지는(더 오래된) 글을 순환하며 채운다.
// 그러면 모든 글이 서로 다른 글 4개씩에서 링크를 받는다.
export async function relatedPosts(post: Post, limit = 4): Promise<Post[]> {
  const all = await allPosts(); // 최신순
  const i = all.findIndex((p) => p.id === post.id);
  const tags = new Set(post.data.tags ?? []);
  const shared = (p: Post) => (p.data.tags ?? []).filter((t) => tags.has(t)).length;
  const picked: Post[] = all
    .filter((p) => p.id !== post.id && shared(p) > 0)
    .sort((a, b) => shared(b) - shared(a) || b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .slice(0, Math.ceil(limit / 2));
  for (let k = 1; k < all.length && picked.length < limit; k++) {
    const p = all[(i + k) % all.length];
    if (p.id !== post.id && !picked.some((x) => x.id === p.id)) picked.push(p);
  }
  return picked;
}
