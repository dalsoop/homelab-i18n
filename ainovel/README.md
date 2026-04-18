# ainovel — 한국어 번역

[inliver233/Ai-Novel](https://github.com/inliver233/Ai-Novel) UI 중국어 → 한국어.

## 범위

- **대상 파일**: `frontend/src/lib/uiCopy.ts` (중앙 UI 사전, 508줄)
- **번역 수**: 378 문자열 → 376 적용 (99.5%)
- **번역 모델**: Claude Sonnet 4.6 (OpenRouter, 배치 25)
- **톤**: 해요체, UI 전문 용어 일관성 유지

## 구조

```
ainovel/
├── src/
│   ├── uiCopy.zh.ts         # 원본 (upstream 스냅샷)
│   └── uiCopy.ko.ts         # 한국어 번역본
├── patches/
│   └── 001-ko-uiCopy.patch  # diff (재적용용)
├── scripts-translate-uicopy.py  # 재번역 스크립트
├── deploy.sh                # LXC 자동 배포
└── README.md
```

## 배포 (LXC 50176 기준)

```bash
# 직접 파일 교체 방식 (간편)
bash deploy.sh

# 또는 패치 방식
cd /opt/ainovel
patch -p1 < /path/to/patches/001-ko-uiCopy.patch
docker compose --env-file .env.docker build frontend
docker compose --env-file .env.docker up -d frontend
```

## 번역 재실행 (upstream 변경 시)

```bash
# 1. upstream uiCopy.ts 최신화
pct pull 50176 /opt/ainovel/frontend/src/lib/uiCopy.ts src/uiCopy.zh.ts

# 2. 번역 실행 (OpenRouter 키 필요)
export OPENROUTER_API_KEY=...
python3 scripts-translate-uicopy.py

# 3. diff 검토 후 적용
diff src/uiCopy.ko.ts /tmp/uiCopy.ko.ts
cp /tmp/uiCopy.ko.ts src/uiCopy.ko.ts

# 4. 재배포
bash deploy.sh
```

## 남은 작업 (추후)

이 번역은 **A 플랜 (핵심 UI)** 만 커버. 아직 중국어가 남아있는 부분:

- `pages/*/use*PageState.ts` (비즈니스 로직 내 문자열)
- `components/**/*.tsx` (인라인 메시지·에러 텍스트)
- 총 38K 문자열 중 이 번역은 378개 (~1%)

B 플랜 (전체 자동 번역) 는 별도 PR로 진행.

## 참고

- 원본 라이선스: Apache 2.0 (Ai-Novel)
- 번역 방식·비용: 약 $0.15 (Claude Sonnet 4.6)
- 최초 적용일: 2026-04-19
