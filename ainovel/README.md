# ainovel — 한국어 번역 (Phase A + B)

[inliver233/Ai-Novel](https://github.com/inliver233/Ai-Novel) 한국어화.

## 현황

| Phase | 범위 | 도구 | 파일 | 문자열 | 상태 |
|---|---|---|---|---|---|
| A | 핵심 UI (`uiCopy.ts`) | Claude Sonnet 4.6 (OpenRouter) | 1 | 376 | ✅ 완료 |
| B | Backend Python | TranslateGemma 27B (local, 4-GPU) | 337 | ~1,100 | ✅ 완료 |
| B | JSON/env/yml | TranslateGemma | 18 | 172 | ✅ 완료 |
| B | 메타 (lang, TZ, FastAPI) | 수동 | 3 | - | ✅ 완료 |
| Frontend .tsx/.ts | (rolled back) | TranslateGemma | 0 | 0 | 🟡 syntax 이슈로 보류 |

**총**: 약 **1,297 유니크 문자열** 번역 (translations/full-translations.json).

## 구조

```
ainovel/
├── src/                              # Phase A: uiCopy.ts 원본·번역본
│   ├── uiCopy.zh.ts
│   └── uiCopy.ko.ts
├── patches/
│   └── 001-ko-uiCopy.patch           # Phase A diff
├── translations/                     # Phase B 결과물
│   ├── full-translations.json        # 1,297 키 zh→ko 사전
│   ├── skip-files.txt                # LLM 프롬프트 파일 (번역 금지)
│   └── translated-files.txt          # 번역 완료 파일 목록
├── scripts/                          # 재현 스크립트
│   ├── translate-all.py              # TranslateGemma 기반 배치 번역
│   ├── scan-cjk.sh                   # 중국어 포함 파일 스캔
│   ├── find-skip.sh                  # LLM 프롬프트 파일 식별
│   ├── rollback-broken.sh            # syntax 깨진 파일 복구
│   └── apply-translations.sh         # LXC 반영
├── scripts-translate-uicopy.py       # Phase A Claude 번역 스크립트
├── deploy.sh                          # Phase A 배포 (uiCopy만)
└── README.md
```

## 배포

### Phase A 만 (안전)
```bash
bash deploy.sh                         # uiCopy.ts 교체 + rebuild
```

### Phase B 전체 (고급)
⚠️ **Frontend .tsx/.ts 는 syntax 깨짐 위험** 있어 현재 skip. Python/JSON/env는 OK.

```bash
# 1. 전체 번역 재실행 (~1시간)
export OPENROUTER_API_KEY=...  # Phase A용
bash scripts/scan-cjk.sh > /tmp/all-cjk.txt
bash scripts/find-skip.sh > /tmp/skip.txt
python3 scripts/translate-all.py frontend   # uiCopy 외에는 주의
python3 scripts/translate-all.py backend    # Python 안전

# 2. 선별 적용
bash scripts/apply-translations.sh
```

## 번역 스킵 정책 (skip-files.txt)

Backend Python 파일 중 **LLM 시스템 프롬프트** 포함한 것은 번역 금지.
번역 시 AI 출력 품질·포맷 깨질 위험.

예:
- `backend/app/services/prompt*.py`
- `backend/app/services/prompting.py`
- `backend/app/api/routes/chapters.py` 등 긴 프롬프트 포함 파일

(전체 31개 파일, `translations/skip-files.txt` 참조)

## 알려진 한계

| 이슈 | 원인 | 대응 |
|---|---|---|
| Frontend .tsx/.ts syntax 깨짐 | TranslateGemma 가 TypeScript 리터럴 경계 넘어 번역 | 원본 복구, uiCopy.ts(Claude)만 사용 |
| Mojibake `category` | UTF-8→GBK 잘못된 재해석 | 하드코딩 매핑 (`본문 최적화`, `윤색`) |
| 고유명사 일관성 | Gemma 단일 요청 컨텍스트 없음 | glossary 보강 필요 |
| 8082 shim 일시 down | 부팅 중 llama-server 하나 로드 실패 | fallback 라우팅으로 완주 |

## 메트릭

- 총 번역 소요: **약 25분** (frontend + backend 합산, 4-GPU 병렬)
- 비용: **0원** (TranslateGemma 로컬) + $0.15 (Phase A Claude)
- 에러율: frontend 0%, backend 8/345 = **2.3% 롤백**

## 업데이트 이력

- 2026-04-18: Phase A uiCopy.ts (Claude Sonnet 4.6)
- 2026-04-19: Phase B backend + JSON/env + 메타 수정 (TranslateGemma)
