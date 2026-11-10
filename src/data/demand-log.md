# 화제 공연(demand) 주간 갱신 로그

`krconcerts-demand-weekly` 스케줄 작업이 매주 Vercel Analytics(Production, Last 7 Days) 실측 방문자를 기준으로 추가하는 기록.
형식: `YYYY-MM-DD | 7일 방문자 {전체} | 상위: id1(n), id2(n), id3(n) | 부여: [...] | 해제: [...] | 현재 demand: [...] | 활성 고정: [...]`

2026-11-10 | 7일 방문자 637 | 상위: fujii-kaze-2027-01(151), 5-seconds-of-summer-2026-11(28), jujutsu-kaisen-in-concert-seoul-2026-11(19) | 부여: 없음(5SOS 28명으로 30명 기준 미달) | 해제: 없음 | 현재 demand: fujii-kaze-2027-01 | 활성 고정: kenshi-yonezu-ghost-incheon-2027-01(~11/20), yoasobi-korea-2027-04(~11/23) — 2개 동시 유효(코드는 featuredUntil이 가장 이른 kenshi만 인정, 교체 불필요)
