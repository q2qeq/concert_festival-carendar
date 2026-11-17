// 공연 요청(아티스트 이름)과 공연 이름을 맞춰 보는 규칙. 서버(/api/request, /api/push-send)와
// 빌드(/request-index.json), 브라우저(요청 상자)가 모두 이 파일 하나를 쓴다. 파일 이름이 _로 시작해서
// Vercel이 주소로 노출하지 않는다.
//
// 공연 이름은 "아이유 (IU)", "제천…시즌2 (FTISLAND·Crush·리센느 외)"처럼 섞여 있어서
// 괄호·가운뎃점·쉼표 등으로 나눈 조각마다 비교 키를 만든다. 비교는 띄어쓰기·기호·대소문자를 무시한다.

export const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const SPLIT = /[()（）[\]{}·・,、&＆/|:：+]|\s[-–—]\s|\s(?:with|feat\.?|x|×)\s/i;

// 공연 하나의 비교 키: 이름 전체, 이름 조각, 라인업 각 팀
export function nameKeys(artist, lineup = []) {
  const keys = new Set([norm(artist)]);
  const add = (s) => {
    const k = norm(String(s).replace(/\s*(외|등)\s*$/, ''));
    if (k.length >= 2) keys.add(k);
  };
  String(artist).split(SPLIT).forEach(add);
  lineup.forEach(add);
  keys.delete('');
  return [...keys];
}

const HANGUL = /[가-힣]/;

// 요청 키 q가 공연 키 목록과 맞는지. 조각과 똑같으면 맞다고 본다.
// 일부만 겹치는 건 짧은 이름이 엉뚱한 공연에 걸리지 않게 한글 3자·영문 4자 이상일 때만 인정한다.
export function matches(q, keys) {
  if (!q || q.length < 2) return false;
  if (keys.includes(q)) return true;
  const min = HANGUL.test(q) ? 3 : 4;
  return q.length >= min && keys.some((k) => k.includes(q));
}
