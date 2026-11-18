# 다른 컴퓨터에서 작업하기

스케줄 작업은 원래 맥에서만 돈다. 다른 컴퓨터에서는 사람이 직접 하는 작업(공연 추가·글 쓰기·UI 수정)만 한다.

## 처음 한 번

```bash
git clone https://github.com/q2qeq/concert_festival-carendar.git krconcerts
cd krconcerts
npm install
cp .env.example .env.local   # 값 두 개는 원래 맥의 .env.local 에서 옮긴다
```

화면 캡처 도구(`.claude/tools/shots`)를 쓰려면 그 폴더에서 `npm install` 과 `npx playwright install chromium` 을 한 번 한다.

## 작업할 때

- 시작 전에 `git pull --rebase origin main`. 스케줄 작업이 매일 커밋하므로 꼭 한다.
- 나머지 규칙(검사 명령, git 규칙)은 `CLAUDE.md` 그대로다. 사람 세션은 메인 체크아웃에서 바로 일하면 된다.

## 원래 맥에만 있는 것

| 무엇 | 다른 컴퓨터에서는 |
| --- | --- |
| 스케줄 작업(`~/.claude/scheduled-tasks`), 작업 프롬프트·로그(`.routines/`) | 없다. 스케줄 작업은 맥에서만 고친다. |
| Claude 메모리 | 없다. 지켜야 할 규칙은 `CLAUDE.md`와 `docs/`에 있다. |
| `npm run og:cards`의 글꼴 | 맥이면 어느 맥이든 같은 Apple SD Gothic Neo로 그려진다. 윈도·리눅스에서는 Noto Sans KR로 그려져 모양이 달라지니 공유 카드는 맥에서 만든다. |
| NOL 가격 확인 | 그 컴퓨터의 Chrome에 Claude in Chrome 확장이 있어야 한다. |
