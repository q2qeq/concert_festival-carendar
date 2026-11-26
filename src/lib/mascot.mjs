// 직관냥 캐릭터 그림. 실제 고양이 두 마리가 모델이다.
//   새벽이(godeung): 고등어 무늬 + 흰색. 입 둘레 갈색 주둥이 무늬, 반쯤 감은 눈.
//   노을이(cheese): 치즈 무늬 + 흰색. 큰 귀, 동그란 노란 눈, 분홍 코, 입 둘레 연한 주황 주둥이 무늬.
//   몸: 등·엉덩이는 무늬색(끝이 뾰족한 줄무늬), 흰 가슴털과 긴 앞다리, 줄무늬 꼬리, 양옆의 뒷발. 실제 사진을 따라 그렸다.
// SVG 문자열을 돌려준다. Mascot.astro와 scripts/make-icons.mjs가 같이 쓴다.

const INK = '#1b1714';
const WHITE = '#f6f1e7';
const COAT = {
  godeung: { base: '#8d7a66', stripe: '#4b3e33', ear: '#c79a8c', iris: '#c5c95a', nose: '#d2968a', muzzle: '#8f735a', halo: '#b59c84', shade: '#6e5d4c' },
  cheese: { base: '#e9953f', stripe: '#c46f25', ear: '#f3b9a4', iris: '#e3c544', nose: '#f29a9a', muzzle: '#eaa056', halo: '#f5c892', shade: '#cf7a2c' },
};
const FUR = '#ddd3bf'; // 흰 털 위에 겹쳐 그리는 옅은 결
const EDGE = '#c3b59c'; // 흰 다리·발의 부드러운 외곽선

// 끝이 뾰족해지는 줄무늬. a(굵은 쪽)에서 b(뾰족한 끝)로, k는 휘는 점, w는 굵기.
function taper([ax, ay], [kx, ky], [bx, by], w) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / len) * (w / 2), ny = ((bx - ax) / len) * (w / 2);
  const f = (v) => Math.round(v * 10) / 10;
  return `M${f(ax + nx)} ${f(ay + ny)} Q${f(kx + nx)} ${f(ky + ny)} ${bx} ${by} Q${f(kx - nx)} ${f(ky - ny)} ${f(ax - nx)} ${f(ay - ny)} Z`;
}
// 목록의 각 항목은 [a, k, b, 굵기]
const tapers = (list, fill) => `<path fill="${fill}" d="${list.map(([a, k, b, w]) => taper(a, k, b, w)).join(' ')}"/>`;
const mirror = (list) => list.map(([a, k, b, w]) => [[200 - a[0], a[1]], [200 - k[0], k[1]], [200 - b[0], b[1]], w]);

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
  // 주둥이 무늬는 실제 사진을 따른다. 옅은 테두리 위에 진한 속을 얹어 털처럼 번지게 한다.
  // 새벽이: 좌우가 다른 얼룩(화면 오른쪽이 더 크고 콧등까지 올라간다). 노을이: 양쪽 수염 자리의 둥근 주황.
  const muzzle = (g
    ? `<path d="M90 111 C95 104 108 105 113 111 C122 110 130 119 129 126 C132 134 124 142 115 140 C109 143 103 139 100 135 C96 141 85 142 81 136 C76 130 80 120 89 119 C90 116 89 113 90 111 Z" fill="${c.halo}" opacity=".5"/>` +
      `<path d="M104 112 C112 110 119 114 122 120 C128 124 127 133 120 136 C114 139 107 138 103 133 C100 128 100 118 104 112 Z M97 122 C92 119 85 122 84 128 C83 134 89 138 94 136 C98 134 100 128 97 122 Z M93 112 C96 108 103 107 107 112 L100 117 Z" fill="${c.muzzle}"/>`
    : `<path d="M100 121 C95 114 80 117 78 127 C76 138 90 145 100 137 C110 145 124 138 122 127 C120 117 105 114 100 121 Z" fill="${c.halo}" opacity=".65"/>` +
      `<path d="M98 123 C93 118 83 121 83 128 C83 136 92 139 97 135 C99 132 99 127 98 123 Z M102 123 C107 118 117 121 117 128 C117 136 108 139 103 135 C101 132 101 127 102 123 Z" fill="${c.muzzle}"/>`) +
    // 수염 자리 점
    `<g fill="${g ? '#5c4a3b' : '#b86a28'}"><circle cx="88" cy="125.5" r="1.2"/><circle cx="85.5" cy="130.5" r="1.2"/><circle cx="112" cy="125.5" r="1.2"/><circle cx="114.5" cy="130.5" r="1.2"/></g>`;
  const er = g ? 11 : 13.5;
  const ey = g ? 98 : 100;
  const whisk = `<path d="M40 126 Q22 124 8 118 M41 134 Q24 136 10 140 M160 126 Q178 124 192 118 M159 134 Q176 136 190 140" fill="none" stroke="${WHITE}" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>`;
  return `<defs><clipPath id="${id}"><path d="${HEAD[who]}"/></clipPath></defs>` +
    whisk +
    `<path d="${HEAD[who]}" fill="${WHITE}"/>` +
    `<g clip-path="url(#${id})"><path d="${cap}" fill="${c.base}"/><g fill="none" stroke="${c.stripe}" stroke-width="4.5" stroke-linecap="round">${stripes}</g>${ears}</g>` +
    muzzle +
    eye(66, ey, er, eyeKind, c.iris, look) + eye(134, ey, er, eyeKind, c.iris, look) +
    `<path d="M93 113 Q100 110 107 113 Q104 121 100 122 Q96 121 93 113 Z" fill="${c.nose}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<ellipse cx="97" cy="113.6" rx="2.6" ry="1.2" fill="${WHITE}" opacity=".6"/>` +
    `<path d="M100 122 V128" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
    mouth(m);
}

// 흰 앞다리 하나(화면 왼쪽 기준). 사진처럼 가늘고 길게 내려와 발끝에서 살짝 모인다.
const LEG_FILL = 'M77 184 C75 212 78 238 77 254 C72 260 70 271 77 275 C83 279 95 279 99 273 C101 266 99 258 98 250 C99 228 100 206 99 184 Z';
const LEG_LINE = 'M77 196 C76 218 78 240 77 254 C72 260 70 271 77 275 C83 279 95 279 99 273 C101 266 99 258 98 250 C99 236 99.5 222 99.5 210';
const TOES = 'M83 268 Q81.5 272 82.5 276.5 M92 268 Q93.5 272 92.5 276.5';
const FLIP = 'translate(200 0) scale(-1 1)';
const both = (inner) => inner + `<g transform="${FLIP}">${inner}</g>`;

// 앉은 몸. 머리 아래에 깔린다(200x282 상자).
function body(who) {
  const c = COAT[who];
  const g = who === 'godeung';
  const id = `${pre}mb${uid++}`;
  const torso = 'M60 146 C46 164 38 186 37 208 C25 224 23 253 40 267 C49 275 64 274 76 272 H124 C136 274 151 275 160 267 C177 253 175 224 163 208 C162 186 154 164 140 146 Z';
  // 가슴털: 아래 끝이 복슬복슬하다. 노을이가 더 크고 풍성하다.
  const bib = g
    ? 'M72 146 C67 166 68 184 73 197 Q76 204 80 201 Q81 211 88 209 Q91 219 97 214 Q100 222 103 214 Q109 219 112 209 Q119 211 120 201 Q124 204 127 197 C132 184 133 166 128 146 Z'
    : 'M64 146 C57 168 59 190 66 203 Q69 211 74 208 Q74 220 83 218 Q85 230 94 224 Q100 235 106 224 Q115 230 117 218 Q126 220 126 208 Q131 211 134 203 C141 190 143 168 136 146 Z';
  // 옆구리·엉덩이 줄무늬. 고등어는 촘촘히, 치즈는 굵고 듬성하게.
  const left = g
    ? [[[34, 175], [50, 176], [64, 189], 6], [[30, 193], [48, 193], [63, 207], 7], [[20, 224], [42, 218], [62, 230], 8], [[20, 241], [42, 235], [60, 247], 8], [[27, 257], [44, 252], [58, 262], 7]]
    : [[[30, 188], [48, 188], [64, 204], 9], [[20, 228], [42, 222], [63, 234], 11], [[24, 250], [44, 244], [60, 255], 10]];
  const haunch = 'M45 205 C68 209 81 232 79 256 C77 268 68 272 56 273';
  // 꼬리: 몸 옆으로 돌아 올라온다. 고등어는 오른쪽, 치즈는 왼쪽.
  const tailShape = 'M150 266 C182 276 208 253 204 222 C202 201 191 188 181 191 C172 194 173 203 180 210 C189 221 188 237 176 245 C169 250 158 248 150 244 Z';
  const rings = [[[210, 207], [194, 202], [172, 202], 8], [[213, 226], [198, 220], [180, 225], 9], [[208, 247], [193, 237], [175, 241], 9], [[190, 276], [181, 260], [166, 244], 9]];
  const tail = `<g${g ? '' : ` transform="${FLIP}"`}><defs><clipPath id="${id}t"><path d="${tailShape}"/></clipPath></defs>` +
    `<path d="${tailShape}" fill="${c.base}"/><g clip-path="url(#${id}t)">${tapers(rings, c.stripe)}<ellipse cx="183" cy="194" rx="13" ry="9" fill="${c.stripe}"/></g></g>`;
  const hindPaw = `<path d="M35 270 C32 261 43 256 54 258 C64 259 69 266 66 273 C59 279 41 279 35 270 Z" fill="${WHITE}" stroke="${EDGE}" stroke-width="2"/>` +
    `<path d="M46 269 Q45 273 46 277 M55 269 Q56 273 55 277" fill="none" stroke="${EDGE}" stroke-width="1.7" stroke-linecap="round"/>`;
  const leg = `<path d="${LEG_FILL}" fill="${WHITE}"/><path d="${LEG_LINE}" fill="none" stroke="${EDGE}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="${TOES}" fill="none" stroke="${EDGE}" stroke-width="1.8" stroke-linecap="round"/>`;
  return tail +
    `<defs><clipPath id="${id}"><path d="${torso}"/></clipPath></defs>` +
    `<path d="${torso}" fill="${c.base}"/>` +
    `<g clip-path="url(#${id})">${tapers([...left, ...mirror(left)], c.stripe)}` +
    // 허벅지 둥근 선과 다리 사이 그늘
    both(`<path d="${haunch}" fill="none" stroke="${c.shade}" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>`) +
    `<path d="M80 214 H120 V282 H80 Z" fill="${c.shade}" opacity=".45"/></g>` +
    `<path d="M95 218 H105 V272 H95 Z" fill="${FUR}"/>` +
    both(leg) +
    `<path d="${bib}" fill="${WHITE}"/>` +
    `<path d="M83 188 q1 5 4 7 M90 190 q0 5 2 8 M117 188 q-1 5 -4 7 M110 190 q0 5 -2 8 M96 201 q1 4 3 6 M105 201 q-1 4 -3 6" fill="none" stroke="${FUR}" stroke-width="2" stroke-linecap="round"/>` +
    // 턱 밑 그늘: 머리와 몸이 한 덩어리로 보이지 않게
    `<g clip-path="url(#${id})"><path d="M44 150 C60 187 140 187 156 150 Z" fill="${INK}" opacity=".065"/></g>` +
    both(hindPaw);
}

// 든 앞발. 머리보다 앞에 보여야 해서 따로 그린다.
function arm(who) {
  const c = COAT[who];
  const shape = 'M143 198 C170 198 195 170 200 126 L181 123 C178 152 166 169 145 176 Z';
  const id = `${pre}ma${uid++}`;
  const inner = `<defs><clipPath id="${id}"><path d="${shape}"/></clipPath></defs><path d="${shape}" fill="${c.base}"/>` +
    `<g clip-path="url(#${id})">${tapers([[[206, 150], [193, 146], [181, 151], 7], [[200, 173], [187, 165], [173, 169], 7]], c.stripe)}</g>` +
    `<path d="M177 120 C174 106 182 100 192 101 C202 102 207 112 203 122 C200 131 192 133 186 131 C180 129 178 126 177 120 Z" fill="${WHITE}" stroke="${EDGE}" stroke-width="2"/>` +
    `<path d="M186 102 Q185 108 186 113 M195 103 Q196 108 195 113" fill="none" stroke="${EDGE}" stroke-width="1.8" stroke-linecap="round"/>`;
  return who === 'cheese' ? inner : `<g transform="${FLIP}">${inner}</g>`;
}

// 식빵 자세로 엎드린 몸(자는 모습). 머리는 앞쪽에 낮게 붙는다.
function loaf(who) {
  const c = COAT[who];
  const g = who === 'godeung';
  const id = `${pre}ml${uid++}`;
  const shape = 'M20 150 C20 108 70 90 122 94 C172 98 198 122 196 152 C194 169 172 175 110 175 C50 175 20 170 20 150 Z';
  const back = g
    ? [[[76, 90], [82, 108], [76, 128], 8], [[98, 88], [105, 108], [99, 134], 9], [[120, 89], [128, 110], [122, 138], 9], [[142, 93], [152, 112], [147, 140], 9], [[164, 101], [174, 118], [170, 140], 8], [[185, 116], [190, 128], [188, 144], 7]]
    : [[[84, 88], [92, 108], [85, 130], 12], [[115, 86], [125, 110], [118, 138], 13], [[146, 92], [157, 114], [151, 140], 12], [[176, 108], [183, 124], [180, 144], 10]];
  const tailShape = 'M186 138 C212 148 212 178 182 179 C166 180 146 180 144 172 C143 165 156 163 168 166 C184 169 192 160 180 150 Z';
  const rings = [[[214, 158], [202, 156], [184, 158], 7], [[200, 184], [194, 172], [182, 163], 8], [[177, 186], [175, 176], [170, 163], 7]];
  return `<defs><clipPath id="${id}"><path d="${shape}"/></clipPath><clipPath id="${id}t"><path d="${tailShape}"/></clipPath></defs>` +
    `<path d="${shape}" fill="${c.base}"/>` +
    `<g clip-path="url(#${id})">${tapers(back, c.stripe)}` +
    `<path d="M20 160 Q34 150 44 156 Q58 146 70 153 Q86 145 98 153 Q112 147 122 156 Q132 151 138 162 L142 180 H20 Z" fill="${WHITE}"/>` +
    `<path d="M134 128 C158 126 180 144 180 166" fill="none" stroke="${c.shade}" stroke-width="2.6" stroke-linecap="round" opacity=".55"/></g>` +
    `<path d="${tailShape}" fill="${c.base}" stroke="${c.shade}" stroke-width="1.4"/><g clip-path="url(#${id}t)">${tapers(rings, c.stripe)}<ellipse cx="147" cy="172" rx="10" ry="9" fill="${c.stripe}"/></g>` +
    // 턱 옆으로 삐져나온 앞발
    `<path d="M112 176 C110 165 122 161 134 163 C144 165 146 173 141 177 Z" fill="${WHITE}" stroke="${EDGE}" stroke-width="2"/>` +
    `<path d="M125 170 Q124 174 125 177 M134 170 Q135 174 134 177" fill="none" stroke="${EDGE}" stroke-width="1.7" stroke-linecap="round"/>`;
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
    return box(230, 282, at(15, 0, 1, cat(who, o)));
  }
  // 둘이 붙어 앉은 모습. 치즈가 조금 뒤, 고등어가 앞.
  const duo = (go, co, extra = '') => box(372, 290, at(164, 0, 0.98, c(co)) + at(16, 8, 1, g(go)) + extra);
  switch (pose) {
    case 'wave': return duo({}, { paw: 'up', mouth: 'smile' });
    case 'cheer': return duo({ paw: 'up' }, { eyes: 'happy', mouth: 'smile', paw: 'up' });
    case 'search': return duo({ look: 3 }, { look: 5 });
    case 'heart': return duo({ eyes: 'closed' }, { eyes: 'happy', mouth: 'smile' }, heart(188, 6, 0.8));
    case 'shock': return duo({}, { eyes: 'wide', mouth: 'open' });
    case 'ticket': return duo({}, { mouth: 'smile' }, ticket(190, 246, -8));
    default: return duo({}, {});
  }
}

export function mascotSvg(pose, who, size) {
  const m = mascot(pose, who);
  const h = Math.round((size * m.h) / m.w);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.viewBox}" width="${size}" height="${h}">${m.body}</svg>`;
}
