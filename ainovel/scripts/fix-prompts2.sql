UPDATE prompt_blocks SET template =
  replace(template, '味”表达，减少无意义形容词堆叠', '의 표현을 줄이고 무의미한 형용사 나열을 삭제')
WHERE template LIKE '%味”表达%';

UPDATE prompt_blocks SET template =
  replace(template, '对话更贴合角色语气与场景，避免泛化评价', '대화가 인물 어조와 장면에 더 잘 맞도록 하고, 일반화된 평가 회피')
WHERE template LIKE '%对话更贴合%';

UPDATE prompt_blocks SET template =
  replace(template, '本장摘要', '이 장 요약')
WHERE template LIKE '%本장摘要%';

SELECT 'remaining' AS k, COUNT(*) FROM prompt_blocks WHERE template ~ '[\u4e00-\u9fff]' OR name ~ '[\u4e00-\u9fff]';
