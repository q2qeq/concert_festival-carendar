// PWA 아이콘 생성 (한 번 돌려 public/icons/ 에 PNG를 만든다). 파비콘과 같은 캘린더 마크.
//   node scripts/make-icons.mjs
// maskable 아이콘은 OS가 원·둥근 사각형으로 잘라 쓰므로 배경을 꽉 채우고 마크를 안쪽 60%에 둔다.
import sharp from 'sharp';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'public/icons');
const mark = `
  <rect x="14" y="18" width="36" height="30" rx="4" fill="none" stroke="#ff5fa2" stroke-width="4"/>
  <line x1="14" y1="28" x2="50" y2="28" stroke="#ff5fa2" stroke-width="4"/>
  <line x1="22" y1="12" x2="22" y2="22" stroke="#ff5fa2" stroke-width="4" stroke-linecap="round"/>
  <line x1="42" y1="12" x2="42" y2="22" stroke="#ff5fa2" stroke-width="4" stroke-linecap="round"/>
  <circle cx="24" cy="37" r="3" fill="#ededea"/>`;
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0e0e10"/>${mark}</svg>`;
const full = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0e0e10"/><g transform="translate(32 32) scale(${scale}) translate(-32 -30)">${mark}</g></svg>`;
// 알림 배지(안드로이드 상태 표시줄): 단색 실루엣만 쓰인다
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="translate(32 32) scale(1.3) translate(-32 -30)">${mark.replaceAll('#ff5fa2', '#fff').replaceAll('#ededea', '#fff')}</g></svg>`;

const jobs = [
  ['icon-192.png', rounded, 192],
  ['icon-512.png', rounded, 512],
  ['icon-maskable-512.png', full(0.78), 512],
  ['apple-touch-icon.png', full(0.9), 180],
  ['badge-96.png', badge, 96],
];
for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(path.join(OUT, name));
  console.log(name);
}
