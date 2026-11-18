# 다른 컴퓨터(윈도)에서 작업하기

스케줄 작업은 원래 맥에서만 돈다. 윈도 컴퓨터에서는 사람이 직접 하는 작업(공연 추가·글 쓰기·UI 수정)만 한다.

## 처음 한 번

1. 설치: Git for Windows, Node.js 24 LTS, Claude 데스크톱 앱(Code 탭). Claude Code는 Git Bash를 셸로 쓴다.
2. 받기 (Git Bash나 PowerShell에서):

```bash
git clone https://github.com/q2qeq/concert_festival-carendar.git krconcerts
cd krconcerts
npm install
cp .env.example .env.local   # 값 두 개는 원래 맥의 .env.local 에서 옮긴다
```

3. 화면 캡처 도구(`.claude/tools/shots`)를 쓰려면 그 폴더에서 `npm install` 과 `npx playwright install chromium` 을 한 번 한다.

줄바꿈은 `.gitattributes`가 LF로 맞춰 주므로 `core.autocrlf`는 따로 바꾸지 않아도 된다.

## 작업할 때

- 시작 전에 `git pull --rebase origin main`. 스케줄 작업이 매일 커밋하므로 꼭 한다.
- 나머지 규칙(검사 명령, git 규칙)은 `CLAUDE.md` 그대로다. 사람 세션은 메인 체크아웃에서 바로 일하면 된다.
- `npm run og:cards`는 윈도에서도 돈다. 한글은 맑은 고딕으로 그려져서 맥에서 만든 카드와 글자 모양만 조금 다르다.

## 원래 맥에만 있는 것

| 무엇 | 윈도에서는 |
| --- | --- |
| 스케줄 작업(`~/.claude/scheduled-tasks`), 작업 프롬프트·로그(`.routines/`), `scripts/task.sh` | 없다. 스케줄 작업은 맥에서만 고친다. |
| Claude 메모리 | 없다. 지켜야 할 규칙은 `CLAUDE.md`와 `docs/`에 있다. |
| NOL 가격 확인 | 그 컴퓨터의 Chrome에 Claude in Chrome 확장이 있어야 한다. |
