import type { Character, Outline, Project, ProjectSettings } from "../../types";

const TRIGGER_TOKEN_RE = /^[a-z][a-z0-9_]*$/;

export function formatTriggers(value: string[]): string {
  return (value ?? []).join(", ");
}

export function parseTriggersWithValidation(value: string): { triggers: string[]; invalid: string[] } {
  const trimmed = value.trim();
  if (!trimmed) return { triggers: [], invalid: [] };

  const raw = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const invalidSet = new Set<string>();
  const triggers: string[] = [];

  for (const item of raw) {
    if (!TRIGGER_TOKEN_RE.test(item) || item.length > 64) invalidSet.add(item);
    if (seen.has(item)) continue;
    seen.add(item);
    triggers.push(item);
  }
  return { triggers, invalid: [...invalidSet] };
}

function formatCharacters(chars: Character[]): string {
  return chars.map((c) => `- ${c.name}${c.role ? `（${c.role}）` : ""}`).join("\n");
}

export function guessPreviewValues(args: {
  project: Project | null;
  settings: ProjectSettings | null;
  outline: Outline | null;
  characters: Character[];
}): Record<string, unknown> {
  const projectName = args.project?.name ?? "";
  const genre = args.project?.genre ?? "";
  const logline = args.project?.logline ?? "";
  const worldSetting = args.settings?.world_setting ?? "";
  const styleGuide = args.settings?.style_guide ?? "";
  const constraints = args.settings?.constraints ?? "";
  const charactersText = formatCharacters(args.characters);
  const outlineText = args.outline?.content_md ?? "";

  const chapterNumber = 1;
  const chapterTitle = "제1장.";
  const chapterPlan = "(예시 주요 내용)";
  const chapterSummary = "(예시 요약)";
  const instruction = "(예시 지시문)";
  const previousChapter = "(이전 장의 요약 내용)";
  const targetWordCount = 2500;
  const rawContent = "(예시 텍스트가 생성되어 post_edit 미리보기용으로 사용되었습니다.)";
  const chapterContentMd = "(예시 챕터 본문, ‘chapter_analyze/chapter_rewrite’에 사용될 내용)";
  const planText = "(예시 계획으로, plan_first에 주입하여 사용할 수 있습니다.)";
  const analysisJson = JSON.stringify(
    {
      chapter_summary: "(예시 분석 요약)",
      hooks: [{ excerpt: "(예시 발췌문)", note: "(예시 훅 주석)" }],
      foreshadows: [],
      plot_points: [{ beat: "(예시 장면 구성)", excerpt: "(예시 발췌문)" }],
      suggestions: [
        {
          title: "(예시 제안)",
          excerpt: "(예시 발췌문)",
          issue: "(예시 문제)",
          recommendation: "(예시 제안)",
          priority: "medium",
        },
      ],
      overall_notes: "",
    },
    null,
    2,
  );
  const requirementsObj = { chapter_count: 12 };

  const values: Record<string, unknown> = {
    project_name: projectName,
    genre,
    logline,
    world_setting: worldSetting,
    style_guide: styleGuide,
    constraints,
    characters: charactersText,
    outline: outlineText,
    chapter_number: String(chapterNumber),
    chapter_title: chapterTitle,
    chapter_plan: chapterPlan,
    chapter_summary: chapterSummary,
    chapter_content_md: chapterContentMd,
    analysis_json: analysisJson,
    requirements: JSON.stringify(requirementsObj, null, 2),
    instruction,
    previous_chapter: previousChapter,
    target_word_count: String(targetWordCount),
    raw_content: rawContent,
    story_plan: planText,
    smart_context_recent_summaries: "(최근 요약된 내용)",
    smart_context_recent_full: "(최근 전체 맥락을 활용한 예시)",
    smart_context_story_skeleton: "(예시: 스마트 컨텍스트 스토리 템플릿)",
  };
  values.project = {
    name: projectName,
    genre,
    logline,
    world_setting: worldSetting,
    style_guide: styleGuide,
    constraints,
    characters: charactersText,
  };
  values.story = {
    outline: outlineText,
    chapter_number: chapterNumber,
    chapter_title: chapterTitle,
    chapter_plan: chapterPlan,
    chapter_summary: chapterSummary,
    previous_chapter: previousChapter,
    plan: planText,
    raw_content: rawContent,
    chapter_content_md: chapterContentMd,
    analysis_json: analysisJson,
    smart_context_recent_summaries: "(최근 요약된 내용)",
    smart_context_recent_full: "(최근 전체 맥락을 활용한 예시)",
    smart_context_story_skeleton: "(예시: 스마트 컨텍스트 스토리 템플릿)",
  };
  values.user = { instruction, requirements: requirementsObj };

  return values;
}
