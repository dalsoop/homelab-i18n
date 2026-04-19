-- 중첩된 괄호 제거
UPDATE prompt_blocks SET name = replace(name, '장(장(장).)', '장') WHERE name LIKE '%장(장(장).)%';

-- 한자 章 → 장 전면 치환 (name/template)
UPDATE prompt_blocks SET name = replace(name, '章', '장') WHERE name ~ '章';
UPDATE prompt_blocks SET template = replace(template, '章', '장') WHERE template ~ '章';

-- post_edit sanitize 중국어 문장 번역
UPDATE prompt_blocks SET template =
  replace(replace(replace(replace(replace(replace(template,
    '味"表达，减少无意义形容词堆叠', '의 표현을 줄이고 무의미한 형용사 나열을 삭제'),
    '保持段落结构与关键信息完整，不要删减关键情节或结尾钩子', '단락 구조와 핵심 정보를 유지하고, 핵심 플롯이나 엔딩 훅을 삭제하지 않음'),
    '保持作者声音/语体一致', '작가 목소리/문체 일관성 유지'),
    '在不改变情节的前提下，轻度润色以提升流畅度', '플롯을 바꾸지 않는 선에서 가독성 향상을 위한 가벼운 윤문'),
    '保留人物对白与关键转折', '인물 대화와 주요 전환점 보존'),
    '仅返回修订后的正文，不要额外解释或分析', '수정된 본문만 반환, 추가 설명이나 분석 금지')
WHERE id = 'f4270981-c9e5-473e-93ce-4ac92d7fea6f';
