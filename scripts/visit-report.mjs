// 재방문 리포트 - api/visit.js가 쌓은 날짜별 카운터를 읽는다(브라우저가 하루 한 번 보낸 값).
//   npm run visits:report            # 최근 30일
//   npm run visits:report -- 60      # 최근 60일
// 토큰: 환경변수 또는 .env.local 의 CLICK_REPORT_TOKEN. 주소 바꾸려면 CLICK_REPORT_URL.
//
// 읽는 법
// - 단위는 "브라우저-일"이다. 한 브라우저가 하루에 몇 페이지를 봐도 1, 사흘 오면 3.
// - new = 처음 온 브라우저, return = 전에 온 기록이 있는 브라우저,
//   legacy = 측정을 넣기(2026-11-21) 전부터 찜·연습 기록 등이 있던 브라우저의 첫 집계(그 뒤로는 return, 코호트 old).
// - 사파리 저장 기간 제한·인앱 브라우저·기기 변경으로 기록이 지워지면 재방문이 new로 잡힌다. 재방문은 실제보다 낮게 나온다.
// - 주간 코호트: 그 주에 처음 온 브라우저 중 N주 뒤에 한 번이라도 다시 온 비율.
import { readFileSync, existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const days = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 30;
const token = process.env.CLICK_REPORT_TOKEN;
const base = process.env.CLICK_REPORT_URL || 'https://jikgwannyang.com';
if (!token) {
  console.error('CLICK_REPORT_TOKEN이 없습니다. .env.local 에 CLICK_REPORT_TOKEN=... 을 넣으세요.');
  process.exit(1);
}

const res = await fetch(`${base}/api/visit?days=${Math.max(days, 15)}`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`조회 실패: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const NAMES = ['ev', 'kind', 'gap', 'cohort', 'wk', 'app', 'push', 'bm', 'src', 'page'];
const all = (await res.json()).rows.map(([day, f, n]) => {
  const o = { day, n };
  f.split('|').forEach((v, i) => (o[NAMES[i]] = v));
  return o;
});
const kstDay = (offset) => new Date(Date.now() + 9 * 3600000 - offset * 86400000).toISOString().slice(0, 10);
const mondayOf = (day) => {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const sum = (list) => list.reduce((a, r) => a + r.n, 0);
const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '-');
const visits = all.filter((r) => r.ev === 'day');
const isBack = (r) => r.kind === 'return' || r.kind === 'legacy';

if (visits.length === 0) {
  console.log('아직 쌓인 방문 기록이 없어요. 배포 뒤 하루 이상 지나야 나와요.');
  process.exit(0);
}

// 1. 성과 요약: 어제까지 7일 vs 그 전 7일
const range = (from, to) => visits.filter((r) => r.day >= kstDay(from) && r.day <= kstDay(to));
const summary = (list) => {
  const total = sum(list), back = sum(list.filter(isBack));
  return { total, back, share: pct(back, total), app: sum(list.filter((r) => r.app === '1')) };
};
const a = summary(range(7, 1)), b = summary(range(14, 8));
console.log('[재방문 요약: 브라우저-일 기준, 오늘 제외]');
console.log(`  ${kstDay(7)} ~ ${kstDay(1)}  방문 ${a.total} · 재방문 ${a.back} (${a.share}) · 홈 화면 앱 ${a.app}`);
console.log(`  ${kstDay(14)} ~ ${kstDay(8)}  방문 ${b.total} · 재방문 ${b.back} (${b.share}) · 홈 화면 앱 ${b.app}`);
console.log('  측정 시작 직후에는 legacy(전부터 오던 브라우저)가 섞여 재방문이 높게 보일 수 있어요. 2주 뒤부터 비교하세요.\n');

// 2. 날짜별
const recent = visits.filter((r) => r.day > kstDay(days));
const byDay = new Map();
for (const r of recent) {
  const x = byDay.get(r.day) ?? { new: 0, return: 0, legacy: 0, app: 0 };
  x[r.kind] += r.n;
  if (r.app === '1') x.app += r.n;
  byDay.set(r.day, x);
}
console.log('[날짜별]  날짜        전체   새로   재방문  예전부터  앱   재방문 비율');
for (const [day, x] of [...byDay.entries()].sort((p, q) => q[0].localeCompare(p[0]))) {
  const total = x.new + x.return + x.legacy;
  console.log(`  ${day}  ${String(total).padStart(5)}  ${String(x.new).padStart(5)}  ${String(x.return).padStart(6)}  ${String(x.legacy).padStart(8)}  ${String(x.app).padStart(3)}   ${pct(x.return + x.legacy, total)}`);
}
console.log();

// 3. 재방문 브라우저는 어떻게 들어오나(최근 7일, 오늘 제외)
const week = range(7, 1);
const group = (list, key) => {
  const m = new Map();
  for (const r of list) m.set(r[key], (m.get(r[key]) ?? 0) + r.n);
  return [...m.entries()].sort((p, q) => q[1] - p[1]);
};
const show = (title, list, key) => {
  const total = sum(list);
  console.log(`[${title}] (합계 ${total})`);
  group(list, key).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${pct(n, total).padStart(6)}  ${k}`));
  console.log();
};
const backWeek = week.filter((r) => r.kind === 'return');
show('재방문 간격: 마지막 방문 뒤 며칠 만에 왔나', backWeek, 'gap');
show('재방문이 들어온 곳(direct = 주소 입력·즐겨찾기·앱·알림)', backWeek, 'src');
show('새 방문이 들어온 곳', week.filter((r) => r.kind === 'new'), 'src');
show('재방문이 들어온 페이지', backWeek, 'page');

// 4. 붙잡는 장치를 쓰는 비율(최근 7일)
const backAll = week.filter(isBack), newAll = week.filter((r) => r.kind === 'new');
console.log('[붙잡는 장치: 새 방문 / 재방문]');
for (const [label, test] of [['알림 권한 허용', (r) => r.push === '1'], ['찜 1개 이상', (r) => r.bm !== '0'], ['홈 화면 앱으로 실행', (r) => r.app === '1']]) {
  console.log(`  ${label.padEnd(12)}  ${pct(sum(newAll.filter(test)), sum(newAll)).padStart(6)} / ${pct(sum(backAll.filter(test)), sum(backAll)).padStart(6)}`);
}
const installs = all.filter((r) => r.ev === 'install' && r.day > kstDay(days));
console.log(`  홈 화면 설치(안드로이드 크롬 등 설치 이벤트가 있는 브라우저만): 최근 ${days}일 ${sum(installs)}회\n`);

// 5. 주간 코호트
const cohorts = new Map();
for (const r of visits) {
  if (r.cohort === 'old' || r.wk !== '1') continue;
  const k = Math.round((Date.parse(mondayOf(r.day)) - Date.parse(r.cohort)) / (7 * 86400000));
  if (k < 0) continue;
  const c = cohorts.get(r.cohort) ?? [];
  c[k] = (c[k] ?? 0) + r.n;
  cohorts.set(r.cohort, c);
}
console.log('[주간 코호트: 첫 방문 주 → N주 뒤 다시 온 비율]');
console.log('  첫 방문 주    처음 온 수   1주 뒤   2주 뒤   3주 뒤   4주 뒤');
for (const [c, w] of [...cohorts.entries()].sort((p, q) => q[0].localeCompare(p[0]))) {
  const size = w[0] ?? 0;
  if (size === 0) continue; // 측정 시작 전 주라 첫 방문이 안 잡힌 코호트
  const cells = [1, 2, 3, 4].map((k) => (w[k] !== undefined ? pct(w[k], size) : '   ').padStart(7));
  console.log(`  ${c}  ${String(size).padStart(10)}  ${cells.join('  ')}`);
}
const old = group(visits.filter((r) => r.cohort === 'old' && r.wk === '1').map((r) => ({ ...r, week: mondayOf(r.day) })), 'week');
if (old.length) console.log(`  측정 전부터 오던 브라우저(주별 방문): ${old.sort((p, q) => q[0].localeCompare(p[0])).map(([w, n]) => `${w} ${n}`).join(' · ')}`);
