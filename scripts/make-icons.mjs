// PWA 아이콘과 파비콘 생성. 캐릭터 고등어의 얼굴을 치즈색 바탕에 올린다.
//   node scripts/make-icons.mjs
// maskable 아이콘은 OS가 원·둥근 사각형으로 잘라 쓰므로 배경을 꽉 채우고 얼굴을 안쪽에 둔다.
import sharp from 'sharp';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { mascot, HEAD } from '../src/lib/mascot.mjs';

const OUT = path.join(process.cwd(), 'public/icons');
const BG = '#ef8a3a';
const face = mascot('face', 'godeung').body; // 200x180 상자
// 얼굴을 64x64 캔버스 가운데에 scale 비율로 놓는다
const place = (scale, inner) => `<g transform="translate(32 33) scale(${(64 * scale) / 200}) translate(-100 -98)">${inner}</g>`;
const svg = (bg, scale, inner = face) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg}${place(scale, inner)}</svg>`;
const rounded = svg(`<rect width="64" height="64" rx="14" fill="${BG}"/>`, 0.86);
const full = (scale) => svg(`<rect width="64" height="64" fill="${BG}"/>`, scale);
// 알림 배지(안드로이드 상태 표시줄): 단색 실루엣만 쓰인다
const badge = svg('', 1, `<path d="${HEAD.godeung}" fill="#fff"/>`);

writeFileSync(path.join(process.cwd(), 'public/favicon.svg'), rounded + '\n');
console.log('favicon.svg');
const jobs = [
  ['icon-192.png', rounded, 192],
  ['icon-512.png', rounded, 512],
  ['icon-maskable-512.png', full(0.62), 512],
  ['apple-touch-icon.png', full(0.8), 180],
  ['badge-96.png', badge, 96],
];
for (const [name, s, size] of jobs) {
  await sharp(Buffer.from(s), { density: 600 }).resize(size, size).png().toFile(path.join(OUT, name));
  console.log(name);
}
