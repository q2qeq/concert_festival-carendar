#!/usr/bin/env node
/**
 * Generates a branded 1200x675 (16:9) card image per event, for use as both the
 * schema.org Event `image` and the page's Open Graph / social-share image.
 *
 * Deliberately NOT using real artist photos/official posters here: those are
 * someone else's copyrighted promotional material, and reusing them on a monetized
 * site without a license is a real rights risk. Generating our own branded card
 * (artist name + date + venue, no photo) sidesteps that entirely and is a common
 * pattern for listings/aggregator sites that don't hold image rights.
 *
 * Pure JS rendering (pureimage + opentype.js under the hood, no native binary) —
 * chosen after a native-binding install failure elsewhere in this project, so this
 * stays portable across machines without a compiler toolchain.
 *
 * Re-run this whenever events.json changes: `npm run gen:images`.
 */
import * as PImage from 'pureimage';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const EVENTS_PATH = path.join(ROOT, 'src', 'data', 'events.json');
const OUT_DIR = path.join(ROOT, 'public', 'og');

const W = 1200;
const H = 675;

const COLORS = {
  bgTop: [16, 16, 24],
  bgBottom: [24, 20, 34],
  accent: [255, 95, 162],
  accent2: [110, 231, 255],
  text: [245, 243, 255],
  muted: [169, 164, 201],
};

function rgb([r, g, b], a = 255) {
  return { r, g, b, a };
}

async function loadFonts() {
  const dir = path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'public', 'static', 'alternative');
  const bold = PImage.registerFont(path.join(dir, 'Pretendard-Bold.ttf'), 'Pretendard-Bold', 700);
  const semibold = PImage.registerFont(path.join(dir, 'Pretendard-SemiBold.ttf'), 'Pretendard-Semi', 600);
  const regular = PImage.registerFont(path.join(dir, 'Pretendard-Regular.ttf'), 'Pretendard-Reg', 400);
  await Promise.all([bold.loadPromise(), semibold.loadPromise(), regular.loadPromise()]);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitTitle(ctx, text, maxWidth, maxLines) {
  const sizes = [64, 56, 48, 42, 36];
  for (const size of sizes) {
    ctx.font = `${size}pt Pretendard-Bold`;
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }
  // last resort: smallest size, truncate to maxLines
  ctx.font = `${sizes[sizes.length - 1]}pt Pretendard-Bold`;
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  return { size: sizes[sizes.length - 1], lines };
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

async function renderEvent(event) {
  const img = PImage.make(W, H);
  const ctx = img.getContext('2d');

  // Vertical gradient background
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(COLORS.bgTop[0] + (COLORS.bgBottom[0] - COLORS.bgTop[0]) * t);
    const g = Math.round(COLORS.bgTop[1] + (COLORS.bgBottom[1] - COLORS.bgTop[1]) * t);
    const b = Math.round(COLORS.bgTop[2] + (COLORS.bgBottom[2] - COLORS.bgTop[2]) * t);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, Math.floor((H / steps) * i), W, Math.ceil(H / steps) + 1);
  }

  // Accent bar
  ctx.fillStyle = `rgb(${COLORS.accent.join(',')})`;
  ctx.fillRect(0, 0, W, 10);

  const padX = 80;

  // Brand watermark
  ctx.font = '28pt Pretendard-Bold';
  ctx.fillStyle = `rgb(${COLORS.accent.join(',')})`;
  ctx.fillText('D-콘서트', padX, 100);

  // Genre badge
  ctx.font = '22pt Pretendard-Semi';
  const genreText = event.genre;
  const genreWidth = ctx.measureText(genreText).width;
  const badgeX = W - padX - genreWidth - 48;
  const badgeY = 55;
  ctx.fillStyle = 'rgb(40,32,52)';
  roundRect(ctx, badgeX, badgeY, genreWidth + 48, 56, 28);
  ctx.fillStyle = `rgb(${COLORS.accent.join(',')})`;
  ctx.fillText(genreText, badgeX + 24, badgeY + 39);

  // Title
  const { size: titleSize, lines: titleLines } = fitTitle(ctx, event.artist, W - padX * 2, 3);
  ctx.font = `${titleSize}pt Pretendard-Bold`;
  ctx.fillStyle = `rgb(${COLORS.text.join(',')})`;
  let ty = 290;
  const lineHeight = titleSize * 1.45;
  for (const line of titleLines) {
    ctx.fillText(line, padX, ty);
    ty += lineHeight;
  }

  // Date + venue
  const dateLabel =
    event.startDate === event.endDate
      ? fmtDate(event.startDate)
      : `${fmtDate(event.startDate)} - ${fmtDate(event.endDate)}`;
  const metaLine = `${dateLabel}  ·  ${event.venue} (${event.city})`;
  ctx.font = '30pt Pretendard-Reg';
  ctx.fillStyle = `rgb(${COLORS.muted.join(',')})`;
  ctx.fillText(metaLine, padX, H - 70);

  return img;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y - r + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

async function renderDefault() {
  const img = PImage.make(W, H);
  const ctx = img.getContext('2d');
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(COLORS.bgTop[0] + (COLORS.bgBottom[0] - COLORS.bgTop[0]) * t);
    const g = Math.round(COLORS.bgTop[1] + (COLORS.bgBottom[1] - COLORS.bgTop[1]) * t);
    const b = Math.round(COLORS.bgTop[2] + (COLORS.bgBottom[2] - COLORS.bgTop[2]) * t);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, Math.floor((H / steps) * i), W, Math.ceil(H / steps) + 1);
  }
  ctx.fillStyle = `rgb(${COLORS.accent.join(',')})`;
  ctx.fillRect(0, 0, W, 10);
  ctx.font = '80pt Pretendard-Bold';
  ctx.fillStyle = `rgb(${COLORS.text.join(',')})`;
  ctx.fillText('D-콘서트', 80, 320);
  ctx.font = '32pt Pretendard-Reg';
  ctx.fillStyle = `rgb(${COLORS.muted.join(',')})`;
  ctx.fillText('내한 공연·페스티벌 일정을 한눈에', 80, 400);
  return img;
}

async function main() {
  await loadFonts();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  for (const event of events) {
    const img = await renderEvent(event);
    const outPath = path.join(OUT_DIR, `${event.id}.png`);
    await PImage.encodePNGToStream(img, fs.createWriteStream(outPath));
    console.log('wrote', path.relative(ROOT, outPath));
  }

  const defaultImg = await renderDefault();
  await PImage.encodePNGToStream(defaultImg, fs.createWriteStream(path.join(OUT_DIR, 'default.png')));
  console.log('wrote public/og/default.png');

  console.log(`Done. ${events.length} event images + 1 default.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
