# homelab-i18n

셀프호스티드 앱 한국어 번역 모노레포. [gemma-translate](https://github.com/dalsoop/gemma-translate) 로 생성/유지.

## 앱별 현황

| 앱 | 번역 | 커버리지 | 상태 |
|----|------|---------|------|
| **Sentry** | 15,173 entries | 100% | ✅ 완료 |
| **Mattermost** | 1,970 / 2,603 | 75% | 🔄 633개 남음 |
| Outline | 1,143 / 1,143 | 100% | ✅ 공식 번역 완료 |
| **Hi.events** | 2,140 / 2,308 | 93% | ✅ 배포 완료 (LXC 50174) |
| Formbricks | — | — | ⏳ 예정 |
| MedusaJS | — | — | ⏳ 예정 |

## 구조

```
homelab-i18n/
├── sentry/
│   ├── dist/ko.js              drop-in webpack chunk (1.3 MB)
│   ├── src/translations.json   {msgid: msgstr}
│   ├── src/state.json          pipeline state
│   ├── deploy.sh / bust-cache.sh
│
├── mattermost/
│   ├── ko.json                 현재 공식 ko (1,970 entries)
│   ├── en.json                 원본 en (2,603 entries)
│   └── (번역 후 ko-patched.json 생성)
│
├── outline/                    (예정)
├── hi-events/
│   ├── src/
│   │   ├── ko.po               frontend Lingui (2,308 msgid, 93%)
│   │   ├── ko.json             backend app-specific (690 entries)
│   │   ├── lang-ko/*.php       Laravel 기본 (auth/validation 등)
│   │   └── patches/*.patch     upstream 소스 패치 5개 (버그 수정 포함)
│   └── deploy.sh               clone + patch + build + swap
│
├── formbricks/                 (예정)
├── medusa/                     (예정)
│
├── shared/
│   └── glossary.json           574 표준 UI 용어
│
└── scripts/
    └── translate-missing.sh    누락 키 추출 → phs-translate → 병합
```

## 사용

```bash
# Sentry
sudo bash sentry/deploy.sh --pct 50105

# Mattermost (번역 후)
pct push 50202 mattermost/ko-patched.json /opt/mattermost/i18n/ko.json
pct exec 50202 -- systemctl restart mattermost

# Hi.events (빌드 + LXC 50174 컨테이너 교체)
bash hi-events/deploy.sh --vmid 50174
```

## 번역 인프라

번역 서버: `translate.50.internal.kr` (TranslateGemma 27B, llama.cpp, 4× RTX 3090)

```bash
# 누락 키 번역
translate -i mattermost/missing.json -o mattermost/translated.json -w 16
```
