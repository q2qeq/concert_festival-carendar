// One-off / periodic maintenance script: downloads every remote posterUrl in
// src/data/events.json, converts it to a resized webp, and saves it under
// public/posters/<event-id>.webp. Rewrites posterUrl to the local path and
// records the original remote URL in posterSourceUrl so provenance isn't
// lost (mirrors the imageUrl/imageSourceUrl pattern already used in
// venues.json for venue photos).
//
// Why: posters were being hotlinked directly from ticket-vendor/news CDNs
// (interpark, yes24, topstarnews, etc). Those can rate-limit, add hotlink
// protection, or delete the source image at any time, silently breaking
// poster display on the live site. Self-hosting a cached copy removes that
// dependency and lets us serve a smaller, optimized webp instead of the
// original (often large) jpg/gif.
//
// Safe to re-run: any event whose posterUrl is already a local /posters/...
// path is skipped. Failures (404, timeout, hotlink block) leave that
// event's posterUrl untouched so nothing regresses - just re-run later to
// retry those.
import fs from 'node:fs';
import fs_promises from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DATA_PATH = new URL('../src/data/events.json', import.meta.url);
const OUT_DIR = new URL('../public/posters/', import.meta.url);
const OUT_DIR_PATH = path.resolve(new URL('.', import.meta.url).pathname, '..', 'public', 'posters');
const MAX_WIDTH = 640;
const CONCURRENCY = 6;
const TIMEOUT_MS = 15000;

const events = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
await fs_promises.mkdir(OUT_DIR, { recursive: true });

const targets = events.filter((e) => e.posterUrl && /^https?:\/\//.test(e.posterUrl));
console.log(`${targets.length} event(s) with a remote posterUrl to cache (of ${events.length} total).`);

let ok = 0;
const failed = [];

async function cacheOne(e) {
  const outFile = path.join(OUT_DIR_PATH, `${e.id}.webp`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(e.posterUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Referer: new URL(e.posterUrl).origin + '/',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const img = sharp(buf, { animated: false });
    const meta = await img.metadata();
    const pipeline = meta.width && meta.width > MAX_WIDTH ? img.resize({ width: MAX_WIDTH }) : img;
    await pipeline.webp({ quality: 82 }).toFile(outFile);
    e.posterSourceUrl = e.posterUrl;
    e.posterUrl = `/posters/${e.id}.webp`;
    ok++;
    console.log('OK  ', e.id);
  } catch (err) {
    failed.push({ id: e.id, url: e.posterUrl, error: String(err.message || err) });
    console.log('FAIL', e.id, String(err.message || err));
  } finally {
    clearTimeout(timer);
  }
}

// simple concurrency-limited pool
let idx = 0;
async function worker() {
  while (idx < targets.length) {
    const e = targets[idx++];
    await cacheOne(e);
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

fs.writeFileSync(DATA_PATH, JSON.stringify(events, null, 2) + '\n');
console.log(`\nDone. cached=${ok} failed=${failed.length}`);
if (failed.length) {
  console.log(JSON.stringify(failed, null, 2));
}
