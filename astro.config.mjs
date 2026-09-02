import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export const SITE_URL = 'https://jikgwannyang.com';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap(), mdx()],
});
