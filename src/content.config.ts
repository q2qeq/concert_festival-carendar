import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    // 본문 내용을 고친 날(취켓팅 전환, 사실 바로잡기 등). 링크 형식만 바꾼 날은 적지 않는다.
    // 사이트맵 lastmod와 글 상단 '수정' 날짜에 쓰인다.
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { posts };
