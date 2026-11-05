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

export function postDateLabel(d: Date): string {
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}
