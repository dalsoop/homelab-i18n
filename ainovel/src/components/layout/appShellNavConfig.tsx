import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BookOpen,
  BookOpenText,
  BookText,
  Database,
  FileDown,
  Flag,
  Globe,
  ListTodo,
  Palette,
  PenLine,
  Share2,
  Settings,
  Snowflake,
  Sparkles,
  TableOfContents,
  Table2,
  Users,
} from "lucide-react";

import { UI_COPY } from "../../lib/uiCopy";

export type AppShellProjectNavGroup = "workbench" | "view" | "aiConfig" | "advancedDebug";

export type AppShellProjectNavItem = {
  id: string;
  group: AppShellProjectNavGroup;
  icon: LucideIcon;
  label: string;
  ariaLabel: string;
  to: (projectId: string) => string;
};

export const APP_SHELL_PRIMARY_PROJECT_NAV_GROUPS: AppShellProjectNavGroup[] = ["workbench", "view", "aiConfig"];
export const APP_SHELL_ADVANCED_DEBUG_PROJECT_NAV_GROUP: AppShellProjectNavGroup = "advancedDebug";

export const APP_SHELL_PROJECT_NAV_GROUP_TITLES: Record<AppShellProjectNavGroup, string> = {
  workbench: UI_COPY.nav.groupWorkbench,
  view: UI_COPY.nav.groupView,
  aiConfig: UI_COPY.nav.groupAiConfig,
  advancedDebug: UI_COPY.nav.groupAdvancedDebug,
};

export const APP_SHELL_PROJECT_NAV_ITEMS: ReadonlyArray<AppShellProjectNavItem> = [
  {
    id: "writing",
    group: "workbench",
    icon: PenLine,
    label: UI_COPY.nav.writing,
    ariaLabel: "글쓰기.",
    to: (projectId) => `/projects/${projectId}/writing`,
  },
  {
    id: "outline",
    group: "workbench",
    icon: TableOfContents,
    label: UI_COPY.nav.outline,
    ariaLabel: "개요.",
    to: (projectId) => `/projects/${projectId}/outline`,
  },
  {
    id: "characters",
    group: "workbench",
    icon: Users,
    label: UI_COPY.nav.characters,
    ariaLabel: "캐릭터 정보 카드 (nav_characters)",
    to: (projectId) => `/projects/${projectId}/characters`,
  },
  {
    id: "worldbook",
    group: "workbench",
    icon: Globe,
    label: UI_COPY.nav.worldBook,
    ariaLabel: "세계 도서관 (segye doseogwan)",
    to: (projectId) => `/projects/${projectId}/worldbook`,
  },
  {
    id: "graph",
    group: "workbench",
    icon: Share2,
    label: UI_COPY.nav.graph,
    ariaLabel: "네비게이션 그래프/관계도.",
    to: (projectId) => `/projects/${projectId}/graph`,
  },
  {
    id: "numericTables",
    group: "workbench",
    icon: Table2,
    label: UI_COPY.nav.numericTables,
    ariaLabel: "수치 표 (수치 표, nav_numeric_tables)",
    to: (projectId) => `/projects/${projectId}/numeric-tables`,
  },
  {
    id: "chapterAnalysis",
    group: "view",
    icon: BookText,
    label: UI_COPY.nav.chapterAnalysis,
    ariaLabel: "줄거리 분석.",
    to: (projectId) => `/projects/${projectId}/chapter-analysis`,
  },
  {
    id: "preview",
    group: "view",
    icon: BookOpen,
    label: UI_COPY.nav.preview,
    ariaLabel: "미리 보기 (miribogi)",
    to: (projectId) => `/projects/${projectId}/preview`,
  },
  {
    id: "foreshadows",
    group: "view",
    icon: Flag,
    label: UI_COPY.nav.foreshadows,
    ariaLabel: "복선 (bokseon)",
    to: (projectId) => `/projects/${projectId}/foreshadows`,
  },
  {
    id: "reader",
    group: "view",
    icon: BookOpenText,
    label: UI_COPY.nav.reader,
    ariaLabel: "읽기 (읽기)",
    to: (projectId) => `/projects/${projectId}/reader`,
  },
  {
    id: "export",
    group: "view",
    icon: FileDown,
    label: UI_COPY.nav.export,
    ariaLabel: "내보내기 (naebonegi)",
    to: (projectId) => `/projects/${projectId}/export`,
  },
  {
    id: "prompts",
    group: "aiConfig",
    icon: Bot,
    label: UI_COPY.nav.prompts,
    ariaLabel: "모델 구성 (탐색 프롬프트)",
    to: (projectId) => `/projects/${projectId}/prompts`,
  },
  {
    id: "promptStudio",
    group: "aiConfig",
    icon: Sparkles,
    label: UI_COPY.nav.promptStudio,
    ariaLabel: "프롬프트 제작 스튜디오 (프롬프트 제작 스튜디오)",
    to: (projectId) => `/projects/${projectId}/prompt-studio`,
  },
  {
    id: "styles",
    group: "aiConfig",
    icon: Palette,
    label: UI_COPY.nav.styles,
    ariaLabel: "스타일 (nav_styles)",
    to: (projectId) => `/projects/${projectId}/styles`,
  },
  {
    id: "settings",
    group: "aiConfig",
    icon: Settings,
    label: UI_COPY.nav.projectSettings,
    ariaLabel: "프로젝트 설정 (nav_settings)",
    to: (projectId) => `/projects/${projectId}/settings`,
  },
  {
    id: "rag",
    group: "advancedDebug",
    icon: Database,
    label: UI_COPY.nav.rag,
    ariaLabel: "지식 기반 (RAG) (nav_rag)",
    to: (projectId) => `/projects/${projectId}/rag`,
  },
  {
    id: "search",
    group: "advancedDebug",
    icon: BookText,
    label: UI_COPY.nav.search,
    ariaLabel: "검색 엔진 (검색 엔진)",
    to: (projectId) => `/projects/${projectId}/search`,
  },
  {
    id: "fractal",
    group: "advancedDebug",
    icon: Snowflake,
    label: UI_COPY.nav.fractal,
    ariaLabel: "프랙탈 (nav_fractal)",
    to: (projectId) => `/projects/${projectId}/fractal`,
  },
  {
    id: "structuredMemory",
    group: "advancedDebug",
    icon: Table2,
    label: UI_COPY.nav.structuredMemory,
    ariaLabel: "맵 구조화 메모리 데이터 (nav_structured_memory)",
    to: (projectId) => `/projects/${projectId}/structured-memory`,
  },
  {
    id: "tasks",
    group: "advancedDebug",
    icon: ListTodo,
    label: UI_COPY.nav.tasks,
    ariaLabel: "작업 센터 (작업 센터)",
    to: (projectId) => `/projects/${projectId}/tasks`,
  },
];

export function getAppShellProjectNavItems(group: AppShellProjectNavGroup): AppShellProjectNavItem[] {
  return APP_SHELL_PROJECT_NAV_ITEMS.filter((item) => item.group === group);
}
