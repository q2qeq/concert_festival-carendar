#!/bin/bash
# 서치콘솔 '페이지 색인' 사유별 내보내기(Coverage-Drilldown zip)를 지금 빌드(dist/)와 대조한다.
# 사용: .claude/skills/traffic-feedback/check-index-export.sh <Coverage-Drilldown zip> [출력 폴더]
# 저장소 루트에서 실행하고, 먼저 npm run build로 dist/를 최신으로 만든다.
# 출력 열: 빌드에 있음(Y/N) / noindex 여부 / 사이트맵 포함(Y/N) / 이 주소로 링크하는 페이지 수 / 주소
set -u   # grep이 못 찾으면 0이 아닌 값을 내므로 -e·pipefail은 쓰지 않는다
ZIP="$1"
OUT="${2:-$(mktemp -d)}"
mkdir -p "$OUT/x"
ditto -x -k "$ZIP" "$OUT/x"   # unzip은 한글 파일 이름(테이블.csv)을 못 푼다
echo "사유: $(grep '^문제' "$OUT/x/메타데이터.csv" | cut -d, -f2-)"
tail -n +2 "$OUT/x/테이블.csv" | grep '^https://jikgwannyang.com' | cut -d, -f1 | sed 's#https://jikgwannyang.com##' > "$OUT/urls.txt" || true
echo "주소 $(wc -l < "$OUT/urls.txt" | tr -d ' ')개 (따옴표로 줄이 나뉜 쿼리 주소는 빠짐)"
echo "최종 크롤링 날짜별:"; tail -n +2 "$OUT/x/테이블.csv" | grep -o ',[0-9-]*$' | tr -d , | sort | uniq -c
grep -o '<loc>[^<]*' dist/sitemap-0.xml | sed 's#<loc>https://jikgwannyang.com##' | sort > "$OUT/sitemap.txt"
find dist -name '*.html' > "$OUT/htmls.txt"
while read -r u; do
  p=$(python3 -c "import urllib.parse,sys;print(urllib.parse.unquote(sys.argv[1]))" "$u")
  f="dist${p}index.html"; ex=N; ni=-
  if [ -f "$f" ]; then ex=Y; if grep -q '<meta name="robots"[^>]*noindex' "$f"; then ni=noindex; else ni=index; fi; fi
  insm=N; grep -qxF "$p" "$OUT/sitemap.txt" && insm=Y
  n=$(xargs grep -l -F "href=\"$p\"" < "$OUT/htmls.txt" 2>/dev/null | wc -l | tr -d ' ')
  printf '%s\t%s\t%s\t%s\t%s\n' "$ex" "$ni" "$insm" "$n" "$p"
done < "$OUT/urls.txt" > "$OUT/check.tsv"
echo; echo "상태별(빌드/색인/사이트맵):"; awk -F'\t' '{print $1"/"$2"/sitemap:"$3}' "$OUT/check.tsv" | sort | uniq -c
echo; echo "사이트맵에 있는데 링크하는 페이지가 2개 이하(발견이 약한 후보):"
awk -F'\t' '$3=="Y" && $4<=2' "$OUT/check.tsv"
echo; echo "빌드에 없음(리디렉션이 있는지 vercel.json 확인):"; awk -F'\t' '$1=="N"' "$OUT/check.tsv"
echo; echo "전체 표: $OUT/check.tsv"
