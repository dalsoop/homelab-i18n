# homelab-i18n

셀프호스티드 앱 한국어 번역 모노레포. [gemma-translate](https://github.com/dalsoop/gemma-translate) 로 생성/유지.

## 앱별 현황

| 앱 | 키 수 | 커버리지 | 비고 |
|----|-------|---------|------|
| **Kibana** | 46,177 | 100% | ja-JP → ko-KR 번역. deploy.sh 포함 |
| **Sentry** | 30,248 | 100% | webpack chunk (ko.js) + deploy/bust-cache |
| **Dify** | 4,682 | 100% | 30개 JSON (GitLab에서 수거) |
| **Hi.events** | 3,090 | 100% | frontend Lingui + backend Laravel |
| **Mattermost** | 2,603 | 100% | JSON array 포맷 |
| **MedusaJS** | 2,148 | 100% | nested JSON, app.js 직접 패치 |
| **Outline** | 1,143 | 100% | flat JSON |
| Mailcow | 21 | 100% | 서비스 폐기, 아카이브용 |
| **Ai-Novel** | 378 (핵심 UI) | ~1% | uiCopy.ts 중앙 사전만 (A 플랜) |
| **합계** | **90,490** | | |

## 구조

```
homelab-i18n/
├── kibana/
│   ├── ko-KR.json           Kibana 번역 (5.4 MB, 46K messages)
│   ├── ja-JP.json            원본 참조 (일본어)
│   ├── messages-ko.json      flat messages
│   └── deploy.sh             LXC 배포 (locale + supportedLocale + i18nrc 등록)
│
├── sentry/
│   ├── dist/ko.js            webpack chunk (2.0 MB)
│   ├── src/translations.json
│   ├── src/state.json        30,248 entries
│   └── deploy.sh / bust-cache.sh
│
├── dify/
│   ├── common.json           627 keys
│   ├── workflow.json          1,049 keys
│   └── ... (30 JSON files)
│
├── hi-events/
│   ├── src/ko.po             frontend (2,308 msgid)
│   ├── src/ko.json           backend (690 entries)
│   └── deploy.sh
│
├── mattermost/
│   ├── en.json / ko.json
│   └── ko-patched.json       100% 완성본
│
├── medusa/
│   ├── en.json / ko.json
│   └── ko-patched.json       100% 완성본
│
├── outline/
│   ├── en.json / ko.json
│
├── mailcow/
│   └── ko.json               21 keys (아카이브)
│
├── shared/
│   └── glossary.json          574 표준 UI 용어
│
└── scripts/
    └── translate-missing.sh   누락 키 추출 → 번역 → 병합
```

## 사용

```bash
# Kibana
bash kibana/deploy.sh 50190

# Sentry
sudo bash sentry/deploy.sh --pct 50105

# Mattermost
bash scripts/translate-missing.sh mattermost --deploy 50202

# MedusaJS (app.js 직접 패치)
# medusa/ko-patched.json → LXC 50172 node_modules + app.js 교체

# Hi.events
bash hi-events/deploy.sh --vmid 50174
```

## 번역 인프라

[gemma-translate](https://github.com/dalsoop/gemma-translate) — TranslateGemma 27B, 4x RTX 3090, ~12 req/s

```bash
# 서버 상태 확인
gemma-translate status

# 누락 키 번역
gemma-translate translate -i missing.json -o translated.json -w 16 -s en -t ko

# 앱별 일괄 번역
bash scripts/translate-missing.sh <app> --workers 16
```

## 번역 품질

- 글로서리 (574 용어) — `Save→저장`, `Cancel→취소` 등 표준화
- 프리픽스 규칙 — `New ...` → `신규 ...` 자동 치환
- 플레이스홀더 보존 — `%s`, `{name}`, `{{count}}`, `<code>` 위치 유지
- 제품 고유명사 — `Discover`, `Kibana`, `Elasticsearch` 등 영문 유지
