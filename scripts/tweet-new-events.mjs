#!/usr/bin/env node
/**
 * Posts a tweet to X for every event in src/data/events.json that hasn't
 * been tweeted yet, tracked in src/data/tweeted-events.json (a flat array of
 * event ids). Written 2026-09-01 right after the X developer app was set up.
 *
 * AUTH: hand-rolled OAuth 1.0a User Context signing (HMAC-SHA1) using Node's
 * built-in `crypto` - no twitter-api-v2/oauth-1.0a npm dependency, matching
 * how fetch-kopis.mjs avoids extra deps. Needs 4 secrets as env vars:
 *   X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 * (the app permission level must be "Read and Write" - see README.md).
 *
 * ENDPOINT: POST https://api.x.com/2/tweets (X API v2; the old
 * api.twitter.com host still works for most endpoints but api.x.com is the
 * current documented base URL as of 2026).
 *
 * SAFETY: src/data/tweeted-events.json was pre-seeded (in the same commit
 * that added this script) with every event id that existed before this
 * pipeline was turned on - specifically so enabling this doesn't suddenly
 * blast out a backlog of tweets. Only genuinely new events (added after
 * go-live, by KOPIS auto-fetch or a hand edit) get tweeted. MAX_PER_RUN
 * caps a single run as an extra safety net (e.g. if a big manual batch of
 * events is added at once) - anything past the cap just waits for the next
 * run instead of getting skipped.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';

const EVENTS_PATH = 'src/data/events.json';
const TWEETED_PATH = 'src/data/tweeted-events.json';
// TODO: confirm this matches the domain actually live on Vercel once DNS is verified.
const SITE_URL = 'https://jikgwannyang.com';
const MAX_PER_RUN = 5;

const { X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
if (!X_API_KEY || !X_API_KEY_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
  console.error(
    'Missing one or more required env vars: X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET'
  );
  process.exit(1);
}

// RFC 3986 percent-encoding - encodeURIComponent doesn't escape !*'() but
// OAuth 1.0a's signing spec requires it to.
function pct(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// OAuth 1.0a User Context signing for a JSON POST body. Per the OAuth 1.0a
// spec, only oauth_* params (plus any query-string params) go into the
// signature base string - a JSON request body is NOT included (unlike an
// x-www-form-urlencoded body, which would be).
function oauthHeader(method, url) {
  const oauthParams = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${pct(k)}=${pct(oauthParams[k])}`)
    .join('&');
  const baseString = `${method.toUpperCase()}&${pct(url)}&${pct(paramString)}`;
  const signingKey = `${pct(X_API_KEY_SECRET)}&${pct(X_ACCESS_TOKEN_SECRET)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return (
    'OAuth ' +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${pct(k)}="${pct(headerParams[k])}"`)
      .join(', ')
  );
}

function fmtShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

// 직관냥 목소리 유지 - Hero/CharacterNote 등 다른 카피와 톤을 맞췄다. 문구를
// 바꾸고 싶으면 이 함수만 고치면 된다.
function tweetTextFor(event) {
  const dateLabel =
    event.startDate === event.endDate
      ? fmtShort(event.startDate)
      : `${fmtShort(event.startDate)}-${fmtShort(event.endDate)}`;
  const link = `${SITE_URL}/events/${event.id}/`;
  return `냥! ${event.artist} ${event.city} 공연이 떴다냥 🐾\n${dateLabel} · ${event.venue}\n${link}\n#직관냥 #내한공연`;
}

async function postTweet(text) {
  const url = 'https://api.x.com/2/tweets';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: oauthHeader('POST', url),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const events = JSON.parse(readFileSync(EVENTS_PATH, 'utf8'));
  const tweeted = existsSync(TWEETED_PATH) ? JSON.parse(readFileSync(TWEETED_PATH, 'utf8')) : [];
  const tweetedSet = new Set(tweeted);

  const newEvents = events.filter((e) => !tweetedSet.has(e.id));
  const toPost = newEvents.slice(0, MAX_PER_RUN);

  if (toPost.length === 0) {
    console.log('No new events to tweet.');
    return;
  }

  let posted = 0;
  for (const event of toPost) {
    const text = tweetTextFor(event);
    try {
      await postTweet(text);
      console.log(`Tweeted: ${event.id}`);
      tweeted.push(event.id);
      posted += 1;
    } catch (err) {
      console.error(`Failed to tweet ${event.id}:`, err.message);
      // Leave it out of `tweeted` so the next run retries it instead of
      // silently losing it.
    }
  }

  writeFileSync(TWEETED_PATH, JSON.stringify(tweeted, null, 2) + '\n');
  console.log(`Done. ${posted}/${toPost.length} posted, ${newEvents.length - toPost.length} still queued for next run.`);

  // Any successes are already saved above, so failing loudly here doesn't
  // lose progress - it just makes sure a real posting failure shows up as a
  // red X in Actions instead of a misleading green checkmark (this is what
  // hid the client-not-enrolled / credits-depleted errors during setup).
  if (posted < toPost.length) {
    throw new Error(`${toPost.length - posted} of ${toPost.length} tweet(s) failed - see "Failed to tweet" lines above.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
