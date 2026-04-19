# pxi-ainovel

Ai-Novel (LXC 50176) 수명 관리 + 한자→한국어 자동 번역 CLI.

## 배치

```bash
# 호스트(pve)에 복사
cp pxi-ainovel /usr/local/bin/pxi-ainovel
chmod +x /usr/local/bin/pxi-ainovel
cp ainovel.toml /etc/pxi/recipes/ainovel.toml

# 번역 스크립트는 homelab-i18n 경로에서 직접 사용 (정본)
ls /root/homelab-i18n/ainovel/scripts/
# zh-to-ko.py         (프론트엔드)
# db-zh-to-ko.py      (DB)
```

## 사용

```bash
# 신규 설치 — recipe 배포 + 자동 번역 + 타이머 활성까지 한 방
pxi run ainovel install --vmid 50176 --hostname ainovel --ip 10.0.50.176

# 수명
pxi run ainovel status
pxi run ainovel logs backend
pxi run ainovel rebuild frontend

# 번역 (수동)
pxi run ainovel scan                           # 현재 한자 카운트
pxi run ainovel translate --include-templates  # 프론트 + DB + rebuild
pxi run ainovel translate-frontend
pxi run ainovel translate-db --include-templates

# 자동 번역 (pve 호스트 systemd timer)
pxi run ainovel auto-on daily       # 또는 hourly, "*:0/30" 등 OnCalendar 표현
pxi run ainovel auto-status
pxi run ainovel auto-run-now        # 즉시 한 번
pxi run ainovel auto-off
```

## 아키텍처

```
pve 호스트
├── /usr/local/bin/pxi-ainovel           (이 CLI)
├── /etc/pxi/recipes/ainovel.toml        (배포 레시피)
├── /etc/systemd/system/
│   ├── ainovel-translate.service         (auto-on 으로 생성)
│   └── ainovel-translate.timer
└── /root/homelab-i18n/ainovel/scripts/   (번역 정본)
    ├── zh-to-ko.py                        — 프론트엔드 소스 번역
    └── db-zh-to-ko.py                     — DB 내용 번역

LXC 50176 (ainovel)
└── /opt/ainovel/                          (docker compose)
```

## 번역 파이프라인

`pxi-ainovel translate`:

1. `zh-to-ko.py run` — 프론트엔드 `src/**/*.{ts,tsx}` 세그먼트 번역 (한자 0까지 반복)
2. `db-zh-to-ko.py translate --include-templates` — DB whitelist 컬럼 번역
3. `docker compose up -d --build frontend` — Vite 번들 재빌드
4. 최종 스캔

**TranslateGemma 4-way 병렬** (10.0.60.108:8080-8083). 캐시는 `/tmp/ainovel-gemma-translate/translations.json`.

## 안전장치

- 사용자 데이터 whitelist 제외 (`outlines.title`, `users.display_name`, `chapters.*`, `characters.*` 등)
- 코드 syntax 손상 방지: 개행/탭/백틱 포함된 번역 결과는 reject
- JSON 컬럼은 번역 후 `json.loads` 검증 통과해야 UPDATE
- 번역 결과 길이가 원본의 6배+80자 초과하면 reject
