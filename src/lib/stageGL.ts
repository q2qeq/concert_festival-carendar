// 랜딩 시안의 3D 무대 (three.js). 페이지가 뜬 뒤에 따로 불러온다 - 실패하면 2D 조명으로 남는다.
//
// 장면 구성: 뒤벽(아티스트 이름이 크게 적힘) · 바닥 · 가운데 선 포스터 · 천장의 조명 5대.
// 조명은 진짜 스포트라이트라서 벽과 바닥에 타원으로 떨어지고, 이름 글자는 빛이 닿는 곳만 드러난다.
// 빛줄기(공기 중에 보이는 원뿔)는 가장자리가 옅어지는 반투명 원뿔로 따로 그린다.
// 카메라는 포인터를 따라 조금 움직여서 포스터·빛·벽 사이의 깊이가 보인다.
import * as THREE from 'three';

export interface StageItem { img: string; mark: string; rgb: [number, number, number] }
export interface StageHandle {
  show(i: number): void;
  pointer(x: number, y: number): void;
  resize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

const POSTER_W = 1.83, POSTER_H = 2.5;
const WALL_Z = -3.6;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeIn = (p: number) => p * p * p;

// 빛줄기 원뿔: 옆에서 볼수록(가장자리) 옅고, 조명기에서 멀어질수록 옅다.
const coneMaterial = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color() }, uPower: { value: 0 } },
  vertexShader: `
    varying vec3 vN; varying vec3 vV; varying float vT;
    void main() {
      vT = uv.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uColor; uniform float uPower;
    varying vec3 vN; varying vec3 vV; varying float vT;
    void main() {
      float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);
      float fall = pow(vT, 1.5);
      gl_FragColor = vec4(uColor, edge * fall * uPower);
    }`,
});

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// 벽에 적을 이름. 좁은 화면에선 단어마다 줄을 바꿔 크게 쓴다. 반환값은 텍스처와 가로세로 비.
function markTexture(text: string, stacked: boolean): { tex: THREE.Texture; aspect: number } {
  const lines = stacked ? text.split(' ') : [text];
  const size = 400;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = `${size}px Anton, "Black Han Sans", Pretendard, sans-serif`;
  g.font = font;
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 40;
  const lh = size * 0.92;
  c.width = Math.min(4096, Math.ceil(w)); c.height = Math.ceil(lh * lines.length + size * 0.12);
  const k = c.width / w;
  g.scale(k, 1);
  g.font = font; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  lines.forEach((l, i) => g.fillText(l, w / 2, size * 0.9 + lh * i));
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return { tex, aspect: c.width / c.height };
}

export async function createStage(canvas: HTMLCanvasElement, hero: HTMLElement, items: StageItem[], anchor: HTMLElement): Promise<StageHandle> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x050506);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050506, 0.022);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

  // 벽과 바닥: 빛을 받아야 보이는 어두운 면
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), new THREE.MeshStandardMaterial({ color: 0x1d1d22, roughness: 1, metalness: 0 }));
  wall.position.set(0, 8, WALL_Z);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.5, metalness: 0.15, transparent: true, opacity: 0.8 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 6;
  scene.add(wall, floor, new THREE.AmbientLight(0xffffff, 0.025));

  // 벽의 이름 글자: 벽보다 밝은 면이라 빛이 닿으면 글자가 드러난다
  const markMat = new THREE.MeshStandardMaterial({ color: 0xe9e9ee, roughness: 1, transparent: true, emissive: 0x070708 });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), markMat);
  mark.position.z = WALL_Z + 0.02;
  scene.add(mark);

  // 포스터: 두께가 있는 판. 그림은 조명과 상관없이 제 색으로 보이게 한다.
  const loader = new THREE.TextureLoader();
  const textures = await Promise.all(items.map((it) => loader.loadAsync(it.img).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })));
  const face = new THREE.MeshBasicMaterial({ map: textures[0], toneMapped: false });
  const side = new THREE.MeshBasicMaterial({ color: 0x0c0c0e });
  const poster = new THREE.Mesh(new THREE.BoxGeometry(POSTER_W, POSTER_H, 0.05), [side, side, side, side, face, side]);
  poster.position.y = POSTER_H / 2 + 0.03;
  scene.add(poster);
  // 바닥에 비친 포스터: 뒤집은 판을 바닥 아래에 두고, 반투명한 바닥 너머로 비치게 한다
  const fade = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64;
    const g = c.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.45, '#161616'); gr.addColorStop(1, '#6a6a6a');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    return new THREE.CanvasTexture(c);
  })();
  const mirrorMat = new THREE.MeshBasicMaterial({ map: textures[0], alphaMap: fade, transparent: true, toneMapped: false });
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(POSTER_W, POSTER_H), mirrorMat);
  mirror.scale.y = -1; mirror.position.y = -POSTER_H / 2 - 0.03;
  scene.add(mirror);

  // 조명 5대: 양쪽 두 대(key)는 늘 포스터를 비추고, 나머지는 벽을 훑는다
  const glow = glowTexture();
  const defs = [
    { x: -5.2, key: true, speed: 0, phase: 0, ax: 0 },
    { x: 5.2, key: true, speed: 0, phase: 0, ax: 0 },
    { x: -8, key: false, speed: 0.11, phase: 0, ax: -4.5 },
    { x: 0, key: false, speed: 0.08, phase: 2.1, ax: 0 },
    { x: 8, key: false, speed: 0.1, phase: 4, ax: 4.5 },
  ];
  const rigs = defs.map((d) => {
    const light = new THREE.SpotLight(0xffffff, 0, 40, d.key ? 0.2 : 0.17, 0.75, 0);
    light.position.set(d.x, 7.4, d.key ? -1.4 : -0.4);
    const len = 13;
    const geo = new THREE.ConeGeometry(Math.tan(light.angle) * len, len, 40, 1, true);
    geo.translate(0, -len / 2, 0); // 꼭짓점을 원점으로
    geo.rotateX(-Math.PI / 2); // 축을 +Z로 → lookAt으로 겨눈다
    const cone = new THREE.Mesh(geo, coneMaterial());
    cone.position.copy(light.position);
    const lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    lens.position.copy(light.position); lens.scale.setScalar(1.5);
    scene.add(light, light.target, cone, lens);
    return { ...d, light, cone, lens, on: 0, aim: new THREE.Vector3(d.ax, 3, WALL_Z) };
  });

  // 빛 속 먼지
  const DUST = 260;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 16; dustPos[i * 3 + 1] = Math.random() * 7; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 7; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.05, map: glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  scene.add(new THREE.Points(dustGeo, dustMat));

  // ── 상태 ──
  let cur = 0;
  const col = new THREE.Color().setRGB(items[0].rgb[0] / 255, items[0].rgb[1] / 255, items[0].rgb[2] / 255, THREE.SRGBColorSpace);
  const colTo = col.clone();
  const white = new THREE.Color(1, 1, 1);
  const tmp = new THREE.Color();
  let dim = 0, dimTo = 1, gather = 0, gatherTo = 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  let flipAt = -1, flipSwapped = true, pending = 0;
  let running = false, last = 0, born = 0;
  let stacked = false, camZ = 9, lookY = 1.4;
  const posterAim = new THREE.Vector3(0, 0.2, -0.9); // 포스터 바로 뒤 바닥
  const gatherAim = new THREE.Vector3(0, POSTER_H * 0.7, WALL_Z); // 전환 때 모이는 곳: 포스터 뒤 벽
  const v = new THREE.Vector3();

  const setMark = (text: string) => {
    const { tex, aspect } = markTexture(text, stacked);
    markMat.alphaMap?.dispose();
    markMat.alphaMap = tex; markMat.needsUpdate = true;
    // 화면에 보이는 벽 폭에 맞춘다
    const dist = camZ - WALL_Z;
    const visH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
    const visW = visH * camera.aspect;
    const w = Math.min(visW * 0.96, visH * (stacked ? 0.5 : 0.62) * aspect);
    mark.scale.set(w, w / aspect, 1);
    mark.position.y = stacked ? POSTER_H * 0.62 : POSTER_H * 0.56;
  };

  const resize = () => {
    const r = hero.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    stacked = r.width < 860;
    // 포스터가 화면에서 차지할 높이 비율을 정하고, 그에 맞게 카메라 거리를 잡는다
    const a = anchor.getBoundingClientRect();
    const frac = Math.min(0.5, Math.max(0.26, a.height / r.height));
    camZ = POSTER_H / frac / (2 * Math.tan((camera.fov * Math.PI) / 360));
    // 포스터 중심이 DOM에서 잡아 둔 자리(anchor)에 오도록 시선 높이를 내린다
    const center = (a.top + a.height / 2 - r.top) / r.height;
    const visH = POSTER_H / frac;
    lookY = poster.position.y - (0.5 - center) * visH;
    camera.updateProjectionMatrix();
    setMark(items[flipSwapped ? cur : pending].mark);
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    const t = now / 1000;
    const k = 1 - Math.pow(0.001, dt);
    dim += (dimTo - dim) * (dimTo < dim ? k * 2.4 : k * 0.9);
    gather += (gatherTo - gather) * k * 1.4;
    col.lerp(colTo, k);
    ptr.x += (ptr.tx - ptr.x) * k * 0.7; ptr.y += (ptr.ty - ptr.y) * k * 0.7;

    // 전환: 포스터가 옆으로 돌아 얇아진 순간에 그림을 바꾼다
    let dolly = 0, rotY = 0;
    if (flipAt >= 0) {
      const p = (now - flipAt) / 900;
      if (p >= 0.5 && !flipSwapped) {
        flipSwapped = true; cur = pending;
        face.map = textures[cur]; mirrorMat.map = textures[cur]; face.needsUpdate = true; mirrorMat.needsUpdate = true;
        colTo.setRGB(items[cur].rgb[0] / 255, items[cur].rgb[1] / 255, items[cur].rgb[2] / 255, THREE.SRGBColorSpace);
        setMark(items[cur].mark);
        dimTo = 1;
      }
      if (p >= 1) { flipAt = -1; window.setTimeout(() => { gatherTo = 0; }, 500); }
      else {
        rotY = p < 0.5 ? easeIn(p * 2) * (Math.PI / 2) : -(1 - easeOut((p - 0.5) * 2)) * (Math.PI / 2);
        dolly = Math.sin(p * Math.PI) * 0.7;
      }
    }
    poster.rotation.y = rotY + ptr.x * 0.16;
    poster.rotation.x = -ptr.y * 0.05;
    mirror.rotation.y = poster.rotation.y;
    const shade = 0.12 + 0.88 * Math.min(1, dim * 1.2);
    face.color.setScalar(shade); mirrorMat.color.setScalar(shade * 0.55);

    // 카메라: 등장할 때 뒤에서 다가오고, 포인터를 따라 조금 움직이고, 가만히 있어도 천천히 흔들린다
    const intro = easeOut(Math.min(1, (now - born) / 2400));
    const sway = Math.sin(t * 0.25) * 0.18;
    camera.position.set(ptr.x * 0.9 + sway, 1.5 + ptr.y * -0.3 + (1 - intro) * -0.5, camZ - dolly + (1 - intro) * 2.6);
    camera.lookAt(0, lookY, 0);

    for (const r of rigs) {
      const pow = dim * r.on;
      if (r.key) {
        r.aim.copy(posterAim);
      } else {
        v.set(r.ax + Math.sin(t * r.speed * 6.283 + r.phase) * 4.2 + ptr.x * 1.2, 3.2 + Math.cos(t * r.speed * 4.1 + r.phase) * 1.6, WALL_Z);
        r.aim.copy(v).lerp(gatherAim, gather);
      }
      r.light.target.position.copy(r.aim);
      r.cone.lookAt(r.aim);
      tmp.copy(col).lerp(white, r.key ? 0.12 : 0.5);
      r.light.color.copy(tmp);
      r.light.intensity = pow * (r.key ? 5 : 3.4);
      const m = r.cone.material as THREE.ShaderMaterial;
      (m.uniforms.uColor.value as THREE.Color).copy(tmp);
      m.uniforms.uPower.value = pow * (r.key ? 0.55 : 0.42);
      (r.lens.material as THREE.SpriteMaterial).color.copy(tmp);
      (r.lens.material as THREE.SpriteMaterial).opacity = pow * 0.9;
    }

    dustMat.color.copy(col).lerp(white, 0.4);
    dustMat.opacity = dim * 0.55;
    const arr = dustGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < DUST; i++) {
      arr[i * 3 + 1] += dt * (0.05 + (i % 7) * 0.012);
      arr[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.03;
      if (arr[i * 3 + 1] > 7) arr[i * 3 + 1] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
    if (running) requestAnimationFrame(frame);
  };

  await document.fonts.load('400px Anton').catch(() => {});
  resize();
  born = performance.now();
  // 조명이 하나씩 깜빡이며 켜진다
  [3, 0, 1, 2, 4].forEach((bi, n) => window.setTimeout(() => {
    const r = rigs[bi];
    r.on = 1;
    window.setTimeout(() => (r.on = 0.2), 70);
    window.setTimeout(() => (r.on = 1), 150);
  }, 200 + n * 140));

  return {
    show(i) {
      if (i === (flipSwapped ? cur : pending)) return;
      pending = i; flipSwapped = false; flipAt = performance.now();
      dimTo = 0.05; gatherTo = 1;
    },
    pointer(x, y) { ptr.tx = x; ptr.ty = y; },
    resize,
    start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } },
    stop() { running = false; },
    dispose() { running = false; renderer.dispose(); },
  };
}
