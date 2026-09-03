/**
 * Curated whitelist of J-pop / J-rock / Japanese-artist names used by
 * scripts/fetch-kopis.mjs to decide "is this KOPIS listing a J-pop act" -
 * KOPIS has no nationality/genre field for this (see fetch-kopis.mjs header),
 * so detection is pure name matching against this list, chosen over a
 * Japanese-script heuristic (2026-08-30 decision - see README).
 *
 * TRADE-OFF (accepted, not a bug): a brand-new/very obscure artist NOT yet
 * added here will be silently skipped rather than mis-filed as J-pop. This
 * list is meant to be extended over time - when `npm run fetch:kopis` logs
 * unmatched-but-plausible titles (see UNMATCHED LOGGING in fetch-kopis.mjs),
 * check them by hand and add real hits here.
 *
 * Each entry: `name` (canonical display name, used only in logs/output, not
 * written into events.json - the raw KOPIS title is used verbatim as
 * `artist`) and `aliases` (every spelling likely to appear in a KOPIS title:
 * Korean transliteration, romaji/English, and official stylization such as
 * "Official髭男dism"). Matching is substring-based after normalization
 * (see normalizeForMatch in fetch-kopis.mjs), guarded by a word-boundary
 * check for short/Latin aliases to avoid false hits inside unrelated words
 * (e.g. "Ado" inside "adorable") - see matchJpopArtist().
 *
 * Coverage: mainstream J-pop/J-rock + a meaningful layer of touring
 * indie/livehouse-tier acts, per the 2026-08-30 request to catch minor
 * artists too. This is NOT exhaustive - Japan's indie scene is enormous and
 * this file reflects what could be curated with confidence in one pass.
 */

export const JPOP_ARTISTS = [
  // --- Mainstream J-pop / J-rock ---
  { name: 'YOASOBI', aliases: ['요아소비', 'YOASOBI'] },
  { name: 'Mrs. GREEN APPLE', aliases: ['미세스 그린 애플', 'Mrs. GREEN APPLE', 'Mrs.GREEN APPLE'] },
  { name: 'King Gnu', aliases: ['킹누', 'King Gnu'] },
  { name: 'Ado', aliases: ['아도', 'Ado'] },
  { name: 'Kenshi Yonezu', aliases: ['요네즈 켄시', '켄시 요네즈', 'Kenshi Yonezu'] },
  { name: 'Fujii Kaze', aliases: ['후지이 카제', 'Fujii Kaze'] },
  { name: 'Official髭男dism', aliases: ['오피셜히게단디즘', '히게단', 'Official髭男dism', 'Official Hige Dandism'] },
  { name: 'back number', aliases: ['백넘버', 'back number'] },
  { name: 'Vaundy', aliases: ['반디', 'Vaundy'] },
  { name: 'Aimyon', aliases: ['아이묭', 'Aimyon'] },
  { name: 'RADWIMPS', aliases: ['래드윔프스', 'RADWIMPS'] },
  { name: 'ONE OK ROCK', aliases: ['원오크록', '원 오크 록', 'ONE OK ROCK'] },
  { name: 'Mr.Children', aliases: ['미스터 칠드런', 'Mr.Children', 'Mr Children'] },
  { name: 'Spitz', aliases: ['스핏츠', 'Spitz'] },
  { name: 'Southern All Stars', aliases: ['서던 올스타즈', 'Southern All Stars', 'サザンオールスターズ'] },
  { name: 'Yuzu', aliases: ['유즈', 'Yuzu'] },
  { name: 'SEKAI NO OWARI', aliases: ['세카이노 오와리', 'SEKAI NO OWARI', 'SEKAINOOWARI'] },
  { name: 'Perfume', aliases: ['퍼퓸', 'Perfume'] },
  { name: 'BABYMETAL', aliases: ['베이비메탈', 'BABYMETAL'] },
  { name: 'LiSA', aliases: ['리사', 'LiSA'] },
  { name: 'Eve', aliases: ['Eve'] }, // '이브' dropped - too common a Korean word (Christmas Eve etc.) on its own
  { name: 'ずっと真夜中でいいのに。', aliases: ['즈토마요', 'ZUTOMAYO', 'ずっと真夜中でいいのに。'] },
  { name: 'Yorushika', aliases: ['요루시카', 'Yorushika'] },
  { name: 'Creepy Nuts', aliases: ['크리피 넛츠', 'Creepy Nuts'] },
  { name: 'tuyu', aliases: ['츠유', 'tuyu'] },
  { name: 'Number_i', aliases: ['넘버아이', 'Number_i'] },
  { name: 'Snow Man', aliases: ['스노우맨', 'Snow Man'] },
  { name: 'Arashi', aliases: ['아라시', 'Arashi'] },
  { name: 'Nogizaka46', aliases: ['노기자카46', 'Nogizaka46'] },
  { name: 'Sakurazaka46', aliases: ['사쿠라자카46', 'Sakurazaka46'] },
  { name: 'AKB48', aliases: ['AKB48'] },
  { name: 'Momoiro Clover Z', aliases: ['모모이로 클로버Z', 'ももいろクローバーZ', 'Momoiro Clover Z'] },
  { name: 'SCANDAL', aliases: ['SCANDAL'] }, // '스캔들' dropped - common Korean word, too ambiguous alone
  { name: 'BAND-MAID', aliases: ['밴드메이드', 'BAND-MAID'] },
  { name: 'MAN WITH A MISSION', aliases: ['맨 위드 어 미션', 'MAN WITH A MISSION'] },
  { name: 'WANIMA', aliases: ['와니마', 'WANIMA'] },
  { name: 'UVERworld', aliases: ['유버월드', 'UVERworld'] },
  { name: 'flumpool', aliases: ['플럼풀', 'flumpool'] },
  { name: 'GLAY', aliases: ['글레이', 'GLAY'] },
  { name: "L'Arc-en-Ciel", aliases: ['라르크앙시엘', "L'Arc~en~Ciel", "L'Arc-en-Ciel", 'Laruku'] },
  { name: 'LUNA SEA', aliases: ['루나씨', 'LUNA SEA'] },
  { name: 'X JAPAN', aliases: ['엑스재팬', 'X JAPAN'] },
  { name: 'Dir en grey', aliases: ['디르 앙 그레이', 'Dir en grey'] },
  { name: 'MIYAVI', aliases: ['미야비', 'MIYAVI'] },
  { name: 'GACKT', aliases: ['갓토', '갹쿠토', 'GACKT'] },
  { name: 'Do As Infinity', aliases: ['두 애즈 인피니티', 'Do As Infinity'] },
  { name: 'Every Little Thing', aliases: ['에브리 리틀 씽', 'Every Little Thing'] },
  { name: 'Ayumi Hamasaki', aliases: ['하마사키 아유미', '아유미', 'Ayumi Hamasaki'] },
  { name: 'Hikaru Utada', aliases: ['우타다 히카루', 'Utada Hikaru', 'Hikaru Utada'] },
  { name: 'Superfly', aliases: ['수퍼플라이', 'Superfly'] },
  { name: 'Aimer', aliases: ['에메', 'Aimer'] },
  { name: 'milet', aliases: ['밀레', 'milet'] },
  { name: 'Uru', aliases: ['우루', 'Uru'] },
  { name: 'Ai Otsuka', aliases: ['오츠카 아이', 'Ai Otsuka'] },
  { name: 'Kana Nishino', aliases: ['니시노 카나', 'Kana Nishino'] },
  { name: 'Wagakki Band', aliases: ['와가키밴드', '和楽器バンド', 'Wagakki Band'] },
  { name: 'Kyary Pamyu Pamyu', aliases: ['캬리 파뮤파뮤', 'Kyary Pamyu Pamyu'] },
  { name: 'Sheena Ringo', aliases: ['시이나 링고', 'Sheena Ringo'] },
  { name: 'Tokyo Jihen', aliases: ['도쿄지헨', '東京事変', 'Tokyo Jihen', 'Tokyo Incidents'] },
  { name: 'Tatsuro Yamashita', aliases: ['야마시타 타츠로', 'Tatsuro Yamashita'] },
  { name: 'Anri', aliases: ['Anri'] },
  { name: 'Mariya Takeuchi', aliases: ['타케우치 마리야', 'Mariya Takeuchi'] },
  { name: 'Toshiki Kadomatsu', aliases: ['카도마츠 토시키', 'Toshiki Kadomatsu'] },
  { name: 'Casiopea', aliases: ['카시오페아', 'Casiopea'] },
  { name: 'T-Square', aliases: ['티스퀘어', 'T-Square'] },
  { name: 'Hiromi Uehara', aliases: ['우에하라 히로미', 'Hiromi Uehara', 'Hiromi'] },
  { name: 'cero', aliases: ['cero'] }, // '세로' dropped - means 'vertical', too ambiguous alone
  { name: 'Suchmos', aliases: ['서치모스', 'Suchmos'] },

  // --- Indie / livehouse-tier / smaller touring acts ---
  { name: 'never young beach', aliases: ['네버영비치', 'never young beach'] },
  { name: 'Yogee New Waves', aliases: ['요기뉴웨이브스', 'Yogee New Waves'] },
  { name: 'DYGL', aliases: ['디와이지엘', 'DYGL'] },
  { name: 'downy', aliases: ['downy'] }, // '다우니' dropped - also the fabric-softener brand name
  { name: 'LOSTAGE', aliases: ['로스테이지', 'LOSTAGE'] },
  { name: 'ART-SCHOOL', aliases: ['아트스쿨(밴드)', 'ART-SCHOOL'] },
  { name: 'Base Ball Bear', aliases: ['베이스볼 베어', 'Base Ball Bear'] },
  { name: 'THE NOVEMBERS', aliases: ['더 노벰버스', 'THE NOVEMBERS'] },
  { name: "Nothing's Carved In Stone", aliases: ['낫씽즈 카브드 인 스톤', "Nothing's Carved In Stone"] },
  { name: 'ELLEGARDEN', aliases: ['엘르가든', 'ELLEGARDEN'] },
  { name: 'ACIDMAN', aliases: ['애시드맨', 'ACIDMAN'] },
  { name: 'THE BACK HORN', aliases: ['더 백혼', 'THE BACK HORN'] },
  { name: 'ASIAN KUNG-FU GENERATION', aliases: ['아시안 쿵푸 제너레이션', 'ASIAN KUNG-FU GENERATION', 'アジカン'] },
  { name: 'BUMP OF CHICKEN', aliases: ['범프 오브 치킨', 'BUMP OF CHICKEN'] },
  { name: '10-FEET', aliases: ['텐피트', '10-FEET'] },
  { name: 'coldrain', aliases: ['콜드레인', 'coldrain'] },
  { name: 'Crossfaith', aliases: ['크로스페이스', 'Crossfaith'] },
  { name: 'Crystal Lake', aliases: ['크리스탈 레이크', 'Crystal Lake'] },
  { name: 'SiM', aliases: ['SiM'] }, // '심' dropped - single generic Korean syllable
  { name: 'Hitorie', aliases: ['히토리에', 'ヒトリエ', 'Hitorie'] },
  { name: 'yama', aliases: ['yama'] }, // '야마' dropped - common Korean slang/word
  { name: 'majiko', aliases: ['마지코', 'majiko'] },
  { name: 'indigo la End', aliases: ['인디고 라 엔드', 'indigo la End'] },
  { name: 'sumika', aliases: ['스미카', 'sumika'] },
  { name: '[Alexandros]', aliases: ['알렉산드로스', '[Alexandros]', 'Alexandros'] },
  { name: 'THE ORAL CIGARETTES', aliases: ['더 오럴 시가렛츠', 'THE ORAL CIGARETTES'] },
  { name: 'Kaneko Ayano', aliases: ['카네코 아야노', 'Kaneko Ayano'] },
  { name: 'NOT WONK', aliases: ['낫웡크', 'NOT WONK'] },
  { name: 'Homecomings', aliases: ['홈커밍스', 'Homecomings'] },
  { name: 'tricot', aliases: ['트라이코트', 'tricot'] },
  { name: 'CHAI', aliases: ['CHAI'] }, // '챠이' dropped - also just means 'chai tea'
  { name: 'Otoboke Beaver', aliases: ['오토보케 비버', 'Otoboke Beaver'] },
  { name: 'GEZAN', aliases: ['게잔', 'GEZAN'] },
  { name: 'Yura Yura Teikoku', aliases: ['유라유라 테이코쿠', 'Yura Yura Teikoku'] },
  { name: 'BORIS', aliases: ['BORIS'] }, // '보리스' dropped - common transliteration of the given name Boris
  { name: 'Bo Ningen', aliases: ['보닌겐', 'Bo Ningen'] },
  { name: 'Kikagaku Moyo', aliases: ['키카가쿠 모요', 'Kikagaku Moyo'] },
  { name: 'Ling Tosite Sigure', aliases: ['링토시테시구레', 'Ling Tosite Sigure', 'Ling tosite sigure'] },
  { name: 'coalamode.', aliases: ['코알라모드', 'coalamode.'] },
  { name: 'yonige', aliases: ['요니게', 'yonige'] },
  { name: 'andymori', aliases: ['앤디모리', 'andymori'] },
  { name: 'THE CHARM PARK', aliases: ['더 참 박', 'THE CHARM PARK'] },
  { name: 'Awesome City Club', aliases: ['어썸 시티 클럽', 'Awesome City Club'] },
  { name: 'Ovall', aliases: ['오볼', 'Ovall'] },
  { name: 'STUTS', aliases: ['스터츠', 'STUTS'] },
  { name: 'PUNPEE', aliases: ['펀피', 'PUNPEE'] },
  { name: 'Frederic', aliases: ['프레데릭(밴드)', 'Frederic (밴드)'] },

  // --- Idol / vocal groups (touring-relevant) ---
  { name: 'Atarashii Gakko!', aliases: ['아타라시이 각코', 'Atarashii Gakko!', 'ATARASHII GAKKO!'] },
  { name: 'CHiCO with HoneyWorks', aliases: ['치코 위드 허니웍스', 'CHiCO with HoneyWorks'] },
  { name: 'FRUITS ZIPPER', aliases: ['후르츠 지퍼', 'FRUITS ZIPPER'] },
  { name: 'CANDY TUNE', aliases: ['캔디튠', 'CANDY TUNE'] },
  { name: '≠ME', aliases: ['노트이퀄미', '≠ME'] },
  { name: 'ZOC', aliases: ['ZOC'] }, // '젝' dropped - meaningless single syllable alone
  { name: 'BiSH', aliases: ['비시', 'BiSH'] },
  { name: 'PassCode', aliases: ['패스코드', 'PassCode'] },
  { name: 'Wednesday Campanella', aliases: ['수요일의 캄파넬라', 'Wednesday Campanella'] },

  // --- Anime / OST-adjacent artists (frequent Korea draws) ---
  { name: 'Aqua Timez', aliases: ['아쿠아 타임즈', 'Aqua Timez'] },
  { name: 'GARNiDELiA', aliases: ['가르니델리아', 'GARNiDELiA'] },
  { name: 'Konomi Suzuki', aliases: ['스즈키 코노미', 'Konomi Suzuki'] },
  { name: 'ClariS', aliases: ['클라리스', 'ClariS'] },
  { name: 'nano.RIPE', aliases: ['나노.라이프', 'nano.RIPE'] },
  { name: 'MYTH & ROID', aliases: ['미스앤로이드', 'MYTH & ROID'] },
  { name: 'ReoNa', aliases: ['레오나', 'ReoNa'] },

  // --- Added 2026-09-03: small-scale/livehouse-tier touring acts test case ---
  // Hump Back (Japanese rock band, humpback.jp) - Seoul show confirmed for
  // 2027-01-23 at YES24 LIVE HALL (a livehouse, not in VENUE_CITY_MAP), ticket
  // sale opens 2026-10-07. Added as the test case for whether the KOPIS pipeline
  // can catch a small-scale J-rock act that a major-venue-only filter would miss.
  { name: 'Hump Back', aliases: ['험프백', 'Hump Back', 'HUMP BACK', 'humpback'] },
];
