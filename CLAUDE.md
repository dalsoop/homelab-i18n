# CLAUDE.md — homelab-i18n

셀프호스팅 오픈소스 앱의 한국어 번역 정본 모노레포. pxi CLI 래퍼·번역 파이프라인·프로젝트 관리 도구를 함께 박제.

## 레포 구조

```
homelab-i18n/
├── ainovel/          ★ Ai-Novel 소설 작성 플랫폼 (LXC 50176)
├── dify/             Dify LLMOps
├── hi-events/        Hi.events 티켓팅
├── kibana/           Kibana (46K keys)
├── mailcow/          Mailcow (archived)
├── mattermost/       Mattermost
├── medusa/           MedusaJS 커머스
├── outline/          Outline wiki
└── CLAUDE.md         (이 파일)
```

## 서브 프로젝트별 가이드

- **ainovel/** — 가장 큰 워크로드. pxi-ainovel CLI(44+ 커맨드) + 번역 파이프라인 + 프로젝트 관리 API + LLM 스위치. 상세: [`ainovel/CLAUDE.md`](ainovel/CLAUDE.md)
- 나머지 앱은 정본 JSON/텍스트 번역만 보관. PR 시 해당 앱 디렉토리만 수정.

## 공통 원칙

- **커맨드 먼저 박제**: 1회성 스크립트로 작업하지 말고 `pxi-*` CLI 서브커맨드나 `scripts/` 정본으로 먼저 남긴 뒤 그걸 호출. 관리 가능성이 최우선.
- **번역 인프라**: `gemma-translate` CLI (TranslateGemma 27B, ranode 10.0.60.108) 가 전체 공용. 각 앱별 번역은 재사용 캐시(`/tmp/ainovel-gemma-translate/translations.json`) 로 dedupe.
- **PR flow**: `dalsoop/homelab-i18n` 은 main 브랜치 보호. 모든 변경은 feat/fix/chore/docs 브랜치 → PR → 머지.

## 참고

- 관련 상위 지침: `/root/CLAUDE.md` (proxmox 호스트 전반)
- 번역 서버: `/etc/pxi/llm-profiles.toml` 의 `translategemma` 프로필
