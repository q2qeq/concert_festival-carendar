// 직관냥 캐릭터 그림. 실제 고양이 두 마리가 모델이다.
//   고등어: 고등어 무늬 + 흰색. 코 밑 콧수염 무늬, 반쯤 감은 눈.
//   치즈: 치즈 무늬 + 흰색. 큰 귀, 동그란 노란 눈, 분홍 코.
// SVG 문자열을 돌려준다. Mascot.astro와 scripts/make-icons.mjs가 같이 쓴다.

const INK = '#1b1714';
const WHITE = '#f6f1e7';
const COAT = {
  godeung: { base: '#8d7a66', stripe: '#4b3e33', ear: '#c79a8c', iris: '#c5c95a', nose: '#b9806f' },
  cheese: { base: '#e9953f', stripe: '#c46f25', ear: '#f3b9a4', iris: '#e3c544', nose: '#f29a9a' },
};

// 머리 외곽선. 귀까지 한 번에 그린다. 치즈는 귀가 더 크고 얼굴이 조금 갸름하다.
export const HEAD = {
  godeung:
    'M40 26 C52 30 66 41 77 52 C91 46 110 46 124 52 C135 41 149 30 161 25 C167 45 169 63 165 81 C180 101 181 128 165 147 C148 165 123 171 100 171 C77 171 52 165 35 147 C19 128 20 101 35 81 C31 63 33 45 40 26 Z',
  cheese:
    'M30 8 C46 16 64 34 77 52 C91 47 109 47 123 52 C136 34 154 16 171 8 C176 34 175 58 166 80 C178 100 178 127 163 146 C147 164 122 170 100 170 C78 170 53 164 37 146 C22 127 22 100 34 80 C25 58 24 34 30 8 Z',
};

function eye(cx, cy, r, kind, iris, lookX = 0) {
  if (kind === 'closed') return `<path d="M${cx - r} ${cy} Q${cx} ${cy + r * 0.75} ${cx + r} ${cy}" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`;
  if (kind === 'happy') return `<path d="M${cx - r} ${cy + 3} Q${cx} ${cy - r * 0.85} ${cx + r} ${cy + 3}" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`;
  if (kind === 'half') {
    // 눈꺼풀이 반쯤 내려온 눈. 안쪽이 살짝 처져 시큰둥해 보인다.
    const tilt = cx < 100 ? 2.5 : -2.5;
    const x0 = cx - r, x1 = cx + r, y0 = cy - 1 - tilt, y1 = cy - 1 + tilt;
    const p = r * 0.34;
    return `<path d="M${x0} ${y0} L${x1} ${y1} A${r} ${r * 0.95} 0 0 1 ${x0} ${y0} Z" fill="${iris}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M${cx - p + lookX} ${cy - 1} L${cx + p + lookX} ${cy - 1} A${p} ${r * 0.62} 0 0 1 ${cx - p + lookX} ${cy - 1} Z" fill="${INK}"/>` +
      `<path d="M${x0 - 2} ${y0} L${x1 + 2} ${y1}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  }
  const R = kind === 'wide' ? r * 1.16 : r;
  const pr = kind === 'wide' ? R * 0.3 : R * 0.42;
  const ph = kind === 'wide' ? R * 0.36 : R * 0.72;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R * 0.94}" fill="${iris}" stroke="${INK}" stroke-width="3"/>` +
    `<ellipse cx="${cx + lookX}" cy="${cy + 0.5}" rx="${pr}" ry="${ph}" fill="${INK}"/>` +
    `<circle cx="${cx + lookX - pr * 0.5}" cy="${cy - ph * 0.45}" r="${R * 0.17}" fill="${WHITE}"/>`;
}

function mouth(kind) {
  if (kind === 'open') return `<ellipse cx="100" cy="134" rx="6.5" ry="8.5" fill="${INK}"/>`;
  if (kind === 'smile') return `<path d="M88 127 Q94 136 100 128 Q106 136 112 127" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<path d="M91 129 Q96 133 100 128 Q104 133 109 129" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
}

let uid = 0;
let pre = '';

// 머리 하나. 200x175 상자 안에 그린다.
function head(who, { eyes, mouth: m = 'neutral', look = 0 } = {}) {
  const c = COAT[who];
  const id = `${pre}mh${uid++}`;
  const g = who === 'godeung';
  const eyeKind = eyes ?? (g ? 'half' : 'open');
  // 무늬: 이마에서 눈 둘레까지 내려오는 색 털과 가운데 흰 줄
  const cap = g
    ? 'M0 0 H200 V112 C178 124 150 124 133 109 C121 97 111 78 101 60 C90 78 80 97 67 109 C50 124 22 124 0 112 Z'
    : 'M0 0 H200 V118 C182 132 158 130 142 114 C128 100 116 84 108 62 C106 50 104 40 100 30 C96 40 94 50 92 62 C84 84 72 100 58 114 C42 130 18 132 0 118 Z';
  const stripes = g
    ? '<path d="M62 60 Q66 70 64 80 M76 56 Q79 66 78 76 M138 60 Q134 70 136 80 M124 56 Q121 66 122 76 M24 104 Q34 104 42 110 M176 104 Q166 104 158 110"/>'
    : '<path d="M60 58 Q64 68 62 78 M75 54 Q78 63 77 72 M140 58 Q136 68 138 78 M125 54 Q122 63 123 72 M26 108 Q36 106 44 112 M174 108 Q164 106 156 112 M30 124 Q38 122 44 126 M170 124 Q162 122 156 126"/>';
  const ears = g
    ? `<path d="M47 42 C54 46 62 53 68 60 L52 72 C47 62 46 52 47 42 Z M154 41 C147 45 139 52 133 59 L149 71 C154 61 155 51 154 41 Z" fill="${c.ear}"/>`
    : `<path d="M39 26 C50 34 61 46 69 58 L50 72 C42 58 38 42 39 26 Z M162 26 C151 34 140 46 132 58 L151 72 C159 58 163 42 162 26 Z" fill="${c.ear}"/>`;
  // 고등어의 콧수염 무늬. 일부러 한쪽으로 살짝 치우쳐 있다.
  const stache = g
    ? `<path d="M82 124 C88 117 111 116 120 122 C127 127 125 139 114 141 C107 142 103 136 100 136 C96 136 92 141 86 140 C77 138 76 129 82 124 Z" fill="#7b5f47"/><path d="M111 119 C120 121 125 128 122 136 C118 141 112 140 108 136 Z" fill="${c.stripe}" opacity=".55"/>`
    : '';
  const er = g ? 11 : 13.5;
  const ey = g ? 98 : 100;
  const whisk = `<path d="M40 126 Q22 124 8 118 M41 134 Q24 136 10 140 M160 126 Q178 124 192 118 M159 134 Q176 136 190 140" fill="none" stroke="${WHITE}" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>`;
  return `<defs><clipPath id="${id}"><path d="${HEAD[who]}"/></clipPath></defs>` +
    whisk +
    `<path d="${HEAD[who]}" fill="${WHITE}"/>` +
    `<g clip-path="url(#${id})"><path d="${cap}" fill="${c.base}"/><g fill="none" stroke="${c.stripe}" stroke-width="4.5" stroke-linecap="round">${stripes}</g>${ears}</g>` +
    stache +
    eye(66, ey, er, eyeKind, c.iris, look) + eye(134, ey, er, eyeKind, c.iris, look) +
    `<path d="M93 113 Q100 110 107 113 Q104 121 100 122 Q96 121 93 113 Z" fill="${c.nose}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M100 122 V128" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
    mouth(m);
}

// 앉은 몸. 머리 아래에 깔린다(200x240 상자).
function body(who, { paw = 'down' } = {}) {
  const c = COAT[who];
  const id = `${pre}mb${uid++}`;
  const shape = 'M56 150 C42 176 36 212 50 228 C68 238 132 238 150 228 C164 212 158 176 144 150 Z';
  const patch = who === 'godeung'
    ? 'M150 150 C172 170 172 214 150 240 H200 V150 Z M30 190 C44 196 52 214 48 240 H20 Z'
    : 'M50 150 C28 172 28 216 52 240 H0 V150 Z M170 196 C158 202 150 216 152 240 H180 Z';
  const tail = who === 'godeung'
    ? 'M150 222 C176 226 190 208 182 188'
    : 'M50 222 C24 226 10 208 18 188';
  const paws = `<path d="M76 236 C70 226 74 218 84 218 C94 218 97 227 92 236 Z M108 236 C103 227 106 218 116 218 C126 218 130 226 124 236 Z" fill="${WHITE}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
  return `<defs><clipPath id="${id}"><path d="${shape}"/></clipPath></defs>` +
    `<path d="${tail}" fill="none" stroke="${c.base}" stroke-width="15" stroke-linecap="round"/>` +
    `<path d="${shape}" fill="${WHITE}"/>` +
    `<g clip-path="url(#${id})"><path d="${patch}" fill="${c.base}"/></g>` +
    paws;
}

// 든 앞발. 머리보다 앞에 보여야 해서 따로 그린다.
function arm(who) {
  const c = COAT[who];
  const d = who === 'cheese' ? 'M150 180 C176 174 192 152 190 126' : 'M50 180 C24 174 8 152 10 126';
  const x = who === 'cheese' ? 190 : 10;
  return `<path d="${d}" fill="none" stroke="${c.base}" stroke-width="19" stroke-linecap="round"/>` +
    `<ellipse cx="${x}" cy="118" rx="13" ry="12.5" fill="${WHITE}" stroke="${INK}" stroke-width="2.4"/>` +
    `<path d="M${x - 4} 108 v6 M${x + 4} 108 v6" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
}

// 식빵 자세로 엎드린 몸(자는 모습). 머리는 앞쪽에 낮게 붙는다.
function loaf(who) {
  const c = COAT[who];
  const id = `${pre}ml${uid++}`;
  const shape = 'M20 150 C20 108 70 92 120 96 C170 100 196 122 194 152 C192 168 170 174 110 174 C50 174 20 170 20 150 Z';
  return `<defs><clipPath id="${id}"><path d="${shape}"/></clipPath></defs>` +
    `<path d="${shape}" fill="${WHITE}"/>` +
    `<g clip-path="url(#${id})"><path d="M90 80 C130 84 150 110 150 180 H210 V80 Z" fill="${c.base}"/>` +
    `<path d="M150 104 Q160 120 158 140 M168 110 Q178 126 176 146" fill="none" stroke="${c.stripe}" stroke-width="5" stroke-linecap="round"/></g>`;
}

const cat = (who, o = {}) => body(who, o) + head(who, o) + (o.paw === 'up' ? arm(who) : '');
const at = (x, y, s, inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
const heart = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 8 C-14 -6 -30 2 -24 18 C-20 30 -8 38 0 46 C8 38 20 30 24 18 C30 2 14 -6 0 8 Z" fill="#ff5fa2"/>`;
const ticket = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-30 -17 H30 V-6 A6 6 0 0 0 30 6 V17 H-30 V6 A6 6 0 0 0 -30 -6 Z" fill="#d3d65c"/><path d="M12 -13 V13" stroke="${INK}" stroke-width="2" stroke-dasharray="3 4"/></g>`;

export const POSES = ['watch', 'wave', 'cheer', 'sleep', 'search', 'heart', 'shock', 'ticket', 'face'];

/** pose와 who(duo·godeung·cheese)에 맞는 그림을 { viewBox, w, h, body }로 돌려준다. */
export function mascot(pose = 'watch', who = 'duo') {
  uid = 0;
  pre = `m-${pose}-${who}-`; // 같은 그림은 같은 id를 쓰게 해서 한 페이지에 여러 번 나와도 안전하다
  const box = (w, h, inner) => ({ viewBox: `0 0 ${w} ${h}`, w, h, body: inner });
  if (pose === 'face') {
    const one = who === 'duo' ? 'godeung' : who;
    return box(200, 180, head(one));
  }
  if (pose === 'sleep') {
    const one = who === 'cheese' ? 'cheese' : 'godeung';
    return box(220, 180, at(8, 0, 1, loaf(one)) + at(-6, 46, 0.72, head(one, { eyes: 'closed' })));
  }
  const g = (o) => cat('godeung', o);
  const c = (o) => cat('cheese', o);
  if (who !== 'duo') {
    const o = { watch: {}, wave: { paw: 'up', mouth: 'smile' }, cheer: { eyes: 'happy', mouth: 'smile', paw: 'up' }, search: { look: who === 'cheese' ? 4 : 3 }, heart: { eyes: 'happy', mouth: 'smile' }, shock: { eyes: 'wide', mouth: 'open' }, ticket: {} }[pose] ?? {};
    return box(230, 244, at(15, 0, 1, cat(who, o)));
  }
  // 둘이 붙어 앉은 모습. 치즈가 조금 뒤, 고등어가 앞.
  const duo = (go, co, extra = '') => box(372, 250, at(164, 0, 0.98, c(co)) + at(16, 8, 1, g(go)) + extra);
  switch (pose) {
    case 'wave': return duo({}, { paw: 'up', mouth: 'smile' });
    case 'cheer': return duo({ paw: 'up' }, { eyes: 'happy', mouth: 'smile', paw: 'up' });
    case 'search': return duo({ look: 3 }, { look: 5 });
    case 'heart': return duo({ eyes: 'closed' }, { eyes: 'happy', mouth: 'smile' }, heart(188, 6, 0.8));
    case 'shock': return duo({}, { eyes: 'wide', mouth: 'open' });
    case 'ticket': return duo({}, { mouth: 'smile' }, ticket(186, 214, -8));
    default: return duo({}, {});
  }
}

export function mascotSvg(pose, who, size) {
  const m = mascot(pose, who);
  const h = Math.round((size * m.h) / m.w);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.viewBox}" width="${size}" height="${h}">${m.body}</svg>`;
}
