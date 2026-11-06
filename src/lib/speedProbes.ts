// 다운로드 속도 측정용 파일: 이미 사이트에 있는 큰 포스터 3개(외부 호출 없이 같은 출처에서 측정).
// 빌드 시점(Node)에서만 호출한다.
import fs from 'node:fs';
import path from 'node:path';

export function speedProbes(count = 3) {
  const dir = path.join(process.cwd(), 'public', 'posters');
  return fs.readdirSync(dir)
    .map((f) => ({ f, size: fs.statSync(path.join(dir, f)).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, count)
    .map((x) => ({ url: `/posters/${x.f}`, size: x.size }));
}
