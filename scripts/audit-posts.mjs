// 블로그 글 규칙 점검 (docs/blog-post-rules.md).
// 1) 사진: 본문에 사이트 안 이미지(![..](/..))가 하나 이상 있고, 그 파일이 public/에 실제로 있어야 한다.
// 2) 도구 링크: 티켓팅·공연장 도구 페이지 링크가 하나 이상 있어야 한다.
// 규칙이 생긴 날(RULE_SINCE) 이후 글은 어기면 ERROR(종료 코드 1), 그 전 글은 INFO로만 알려준다.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const POSTS = path.join(ROOT, 'src/content/posts');
const RULE_SINCE = '2026-11-12';
// 파일 이름 규칙: 2026-11-13부터 새 글은 postN 대신 'YYYY-MM-DD-영문-슬러그.mdx' (자동 작업끼리 번호가 겹쳐 덮어써지는 사고 방지).
const NAME_RULE_SINCE = '2026-11-13';
const NAME_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*\.mdx?$/;
const TOOL_LINKS = ['/ticketing-clock/', '/ticketing-check/', '/practice/', '/ticket-open/', '/return-trip/', '/trip-cost/', '/internet-speed/', '/tools/', '/venues/'];

const out = { ERROR: [], INFO: [] };
const files = fs.readdirSync(POSTS).filter((f) => /\.mdx?$/.test(f));

for (const f of files) {
  const src = fs.readFileSync(path.join(POSTS, f), 'utf8');
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  if (fm && /^draft:\s*true/m.test(fm[1])) continue;
  const pubDate = (fm?.[1].match(/^pubDate:\s*"?(\d{4}-\d{2}-\d{2})/m) || [])[1] ?? '';
  const level = pubDate >= RULE_SINCE ? 'ERROR' : 'INFO';
  const problems = [];
  if (pubDate >= NAME_RULE_SINCE && !NAME_RE.test(f)) problems.push(`파일 이름 규칙 위반(YYYY-MM-DD-영문-슬러그.mdx 이어야 함)`);

  const images = [...src.matchAll(/!\[[^\]]*\]\((\/[^)\s]+)\)/g)].map((m) => m[1]);
  if (images.length === 0) problems.push('사진 없음');
  for (const img of images) {
    if (!fs.existsSync(path.join(ROOT, 'public', decodeURI(img)))) problems.push(`이미지 파일 없음: ${img}`);
  }
  if (!TOOL_LINKS.some((l) => src.includes(`](${l}`))) problems.push('티켓팅·공연장 도구 링크 없음');

  if (problems.length) out[level].push(`${f} (${pubDate}): ${problems.join(', ')}`);
}

for (const level of ['ERROR', 'INFO']) {
  if (out[level].length === 0) continue;
  console.log(`\n[${level}] ${out[level].length}건${level === 'INFO' ? ` (${RULE_SINCE} 이전 글, 참고용)` : ''}`);
  out[level].forEach((m) => console.log(' - ' + m));
}
console.log(`\n글 ${files.length}편 검사 · ERROR ${out.ERROR.length} · INFO ${out.INFO.length}`);
process.exit(out.ERROR.length > 0 ? 1 : 0);
