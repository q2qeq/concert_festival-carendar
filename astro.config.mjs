import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export const SITE_URL = 'https://jikgwannyang.com';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap(), mdx()],
  // 예전 주소(/game)로 공유된 링크가 깨지지 않도록
  redirects: {
    '/game': '/practice/',
    // KOPIS 자동 수집본과 직접 정리한 페이지가 중복돼 하나로 합침 (2026-11-06)
    '/events/kopis-PF304185': '/events/kenshi-yonezu-ghost-incheon-2027-01/',
  },
});
