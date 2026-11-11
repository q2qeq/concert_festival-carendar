#!/usr/bin/env bash
# 스케줄 작업용 격리 작업 공간.
# 여러 스케줄 작업이 같은 체크아웃에서 동시에 커밋하면 서로의 변경이 섞이거나 덮어써진다.
# 그래서 작업마다 origin/main에서 새 git worktree를 만들어 거기서만 일하고, 끝나면 rebase 후 main에 푸시한다.
#
#   scripts/task.sh start <작업이름>      새 작업 공간을 만들고 마지막 줄에 경로를 출력
#   scripts/task.sh finish [경로]         검사 → origin/main 위로 rebase → 푸시 → 작업 공간 삭제
#   scripts/task.sh status                남아 있는 작업 공간과 푸시 안 된 커밋 보기
#
# finish 종료 코드: 0 성공(또는 푸시할 커밋 없음), 2 rebase 충돌, 3 검사 실패, 4 푸시 실패.
# 실패하면 작업 공간을 지우지 않는다(작업 유실 방지).
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${KRC_TASK_DIR:-$HOME/.krconcerts-tasks}"

die() { echo "task.sh: $*" >&2; exit "${2:-1}"; }

fetch_main() {
  local i
  for i in 1 2 3; do
    git -C "$REPO" fetch -q origin main && return 0
    sleep 5
  done
  return 1
}

cmd_start() {
  local name="${1:-}"
  [[ "$name" =~ ^[A-Za-z0-9_.-]+$ ]] || die "작업 이름이 필요합니다 (영문·숫자·-_.)"
  mkdir -p "$BASE"
  fetch_main || die "git fetch 실패"
  local dir="$BASE/$name-$(date +%Y%m%d-%H%M%S)-$$"
  git -C "$REPO" worktree add -q --detach "$dir" origin/main || die "worktree 생성 실패"
  # git에 없는 로컬 파일은 메인 체크아웃 것을 그대로 쓴다. 옛 .gitignore("node_modules/")가 링크를 못 걸러도 되게 exclude에 추가.
  local ex; ex="$(git -C "$REPO" rev-parse --git-common-dir)/info/exclude"
  case "$ex" in /*) ;; *) ex="$REPO/$ex";; esac
  mkdir -p "$(dirname "$ex")"; grep -qx '/node_modules' "$ex" 2>/dev/null || echo '/node_modules' >> "$ex"
  # node_modules는 심볼릭 링크로 두면 Astro 빌드가 깨진다. APFS 복제 복사(cp -c)는 몇 초면 되고 디스크도 거의 안 쓴다.
  cp -cR "$REPO/node_modules" "$dir/node_modules" 2>/dev/null || cp -R "$REPO/node_modules" "$dir/node_modules"
  [ -f "$REPO/.env.local" ] && ln -s "$REPO/.env.local" "$dir/.env.local"
  [ -f "$REPO/.env" ] && ln -s "$REPO/.env" "$dir/.env"
  [ -d "$REPO/.vercel" ] && ln -s "$REPO/.vercel" "$dir/.vercel"
  # 같은 이름으로 남은 작업 공간이 있으면 알려 준다(이전 실행이 실패했을 수 있음).
  local old
  for old in "$BASE/$name"-*; do
    [ "$old" = "$dir" ] || [ ! -d "$old" ] || echo "주의: 이전 작업 공간이 남아 있음: $old (scripts/task.sh status 로 확인)" >&2
  done
  echo "$dir"
}

check_tree() {
  local dir="$1" f
  for f in "$dir"/src/data/*.json; do
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$f" 2>/dev/null \
      || { echo "JSON 오류: ${f#$dir/}" >&2; return 1; }
  done
  (cd "$dir" && node scripts/audit-posts.mjs >/dev/null) || { echo "audit:posts ERROR (npm run audit:posts 로 확인)" >&2; return 1; }
}

cmd_finish() {
  local dir="${1:-$PWD}"
  dir="$(cd "$dir" 2>/dev/null && pwd)" || die "경로 없음: $1"
  case "$dir" in "$BASE"/*) ;; *) die "작업 공간 경로가 아닙니다: $dir (scripts/task.sh start 로 만든 곳에서 실행)";; esac

  if [ -n "$(git -C "$dir" status --porcelain)" ]; then
    git -C "$dir" status --short >&2
    die "커밋 안 한 변경이 있습니다. 필요한 파일을 git add 후 커밋하거나, 버릴 거면 지우고 다시 실행하세요." 3
  fi
  fetch_main || die "git fetch 실패" 4
  if [ -z "$(git -C "$dir" rev-list origin/main..HEAD)" ]; then
    echo "푸시할 커밋 없음. 작업 공간을 지웁니다."
    git -C "$REPO" worktree remove --force "$dir"
    return 0
  fi

  local i
  for i in 1 2 3 4 5; do
    if ! git -C "$dir" rebase -q origin/main; then
      echo "rebase 충돌. 충돌 파일:" >&2
      git -C "$dir" diff --name-only --diff-filter=U >&2
      git -C "$dir" rebase --abort
      die "충돌 해결 방법: cd $dir && git rebase origin/main → 양쪽 내용을 모두 살려 고치고 git add → git rebase --continue → 다시 finish" 2
    fi
    check_tree "$dir" || die "rebase 뒤 검사 실패 - 고친 뒤 새 커밋을 만들고 다시 finish" 3
    local count; count="$(git -C "$dir" rev-list --count origin/main..HEAD)"
    if git -C "$dir" push -q origin HEAD:refs/heads/main; then
      echo "푸시 완료: 커밋 ${count}건 → $(git -C "$dir" rev-parse --short HEAD)"
      git -C "$REPO" worktree remove --force "$dir"
      # 메인 체크아웃이 깨끗하면 빨리 감기만 해 둔다(사람이 보는 폴더를 최신으로).
      if [ -z "$(git -C "$REPO" status --porcelain --untracked-files=no)" ]; then
        git -C "$REPO" merge -q --ff-only origin/main 2>/dev/null || true
      fi
      return 0
    fi
    echo "푸시 거부(다른 작업이 먼저 푸시함). 다시 시도 $i/5" >&2
    sleep $((i * 5))
    fetch_main || true
  done
  die "푸시 5회 실패. 작업 공간은 남겨 둠: $dir" 4
}

cmd_status() {
  git -C "$REPO" worktree prune
  local d n=0
  for d in "$BASE"/*; do
    [ -d "$d" ] || continue
    n=$((n + 1))
    echo "== $d"
    git -C "$d" status --short | head -5
    git -C "$d" log --oneline origin/main..HEAD 2>/dev/null | sed 's/^/  안 올라간 커밋: /'
  done
  [ "$n" -gt 0 ] || echo "남은 작업 공간 없음"
}

case "${1:-}" in
  start) shift; cmd_start "$@";;
  finish) shift; cmd_finish "$@";;
  status) cmd_status;;
  *) sed -n '2,11p' "$0"; exit 1;;
esac
