# CLAUDE.md — ainovel/

Ai-Novel (LXC 50176, https://novel.50.internal.kr) 한국어화 + 프로젝트 관리 정본.

## 운영 철학

- **커맨드가 문서다**: 모든 작업은 `pxi run ainovel <cmd>` 로 재현 가능해야 한다. 1회성 SQL·파이썬 스크립트는 먼저 `scripts/` 또는 `pxi/pxi-ainovel` 에 박제하고 그걸 호출한다. 일회성으로 Agent Task·수동 SQL 을 돌리지 말 것.
- **시나리오·원본은 건드리지 않는다**: 원본 프로젝트(단편영화판, 원본 대본)는 read-only. 변형이 필요하면 `project clone` 으로 복제 후 사본에서 작업.
- **백업은 이중화**: 논리 백업(`project export` JSON) + 물리 백업(`pxi run backup now <VMID>` vzdump) 둘 다. NAS 에 보관.
- **번역/소설화는 반복 가능**: 새 한자가 섞이면 `zh-to-ko.py run`, 새 프로젝트 clone 은 `chapter novelize <src> <dst> all`.

## 디렉토리

```
ainovel/
├── CLAUDE.md                  (이 파일)
├── pxi/
│   ├── pxi-ainovel            ★ 메인 CLI (bash). /usr/local/bin/ 에 심볼릭/카피해서 사용
│   ├── ainovel.toml           pxi deploy 레시피
│   └── README.md              배치/사용법
├── scripts/
│   ├── zh-to-ko.py            프론트엔드 TS/TSX 한자 세그먼트 번역 (run-until-zero)
│   ├── db-zh-to-ko.py         DB whitelist 컬럼 번역 (사용자 데이터 제외)
│   ├── backend-zh-to-ko.py    Python seed 번역 (neo 프로젝트 한국어 시딩)
│   ├── backend-final-fix.py   mojibake 상수 + 章→장 sanitize_literals
│   ├── fix-prompts.sql / fix-prompts2.sql  Jinja 레이블 수동 치환 룰
│   ├── project-audit.py       프로젝트 빈/부족 지점 JSON 리포트
│   ├── project-export.py      전체 상태 JSON 덤프 (json_agg 기반, 개행 안전)
│   ├── project-import.py      JSON upsert (meta/settings/outline/chapters/
│   │                          characters/entities/relations/worldbook/
│   │                          foreshadows/glossary/evidence/story_memories/
│   │                          plot_analysis/numeric_tables 14 섹션)
│   ├── novelize-chapter.py    backend container 내 실행. src 대본 → dst 산문화
│   └── _legacy/               레거시 1회성 스크립트 (참고만)
├── src/                       LXC 50176 frontend/src 의 한국어화 정본 미러
├── translations/
│   ├── full-translations.json  zh→ko 캐시 (2,364+ entries)
│   └── skip-files.txt
├── examples/
│   └── missing-found.json     "실종된 너를 발견했다" 전량 export (1,782 lines)
└── CODE-REVIEW.md             번역 도구 코드 리뷰 기록 (288 lines)
```

## pxi-ainovel 커맨드 맵 (44+)

### 수명 / 컨테이너
```
install [...]  up  down  ps  logs [svc]  rebuild [svc]  status  scan  health  vram
```

### 번역 (zh → ko)
```
translate [--include-templates] [--no-rebuild]   프론트·DB·(옵션 template) 일괄
translate-frontend / translate-db / translate-backend
auto-on [interval]  auto-off  auto-status  auto-run-now
```

### LLM 모드 토글 (Gemma 4 ↔ TG)
```
llm-mode status | gemma | translate | off
embed on | off | status
rag-rebuild <proj>
```

### 프로젝트 데이터 API
```
project list
project audit  <id>                JSON 리포트 (coverage_pct, critical, warn, missing[])
project export <id> [out.json]     전량 JSON 덤프
project import <id> <in.json>      upsert (--dry-run 지원)
project reset-tasks <id>           failed·cancelled task + proposed change_set 청소
project new <name> [--genre G] [--logline L]
project delete <id>
project clone <src> <new_name>
```

### 장 조작 (CRUD + 산문화)
```
chapter list <proj>
chapter show <proj> <n>
chapter add <proj> <n> <title> [--from-file F]
chapter update <proj> <n> [--title T] [--from-file F] [--status S]
chapter delete <proj> <n>
chapter set-status <proj> <n> <drafting|done>
chapter generate <proj> <n>        auto_update 전체 스케줄
chapter analyze <proj> <n>         plot_analysis 재생성
chapter novelize <src> <dst> <n|all> [--style-file F]
                                   src 대본 → dst 소설 산문화 (dst LLM preset 사용,
                                   env AINOVEL_LLM_* 로 override)
chapter import-md <proj> <n> <file.md>
```

### 그래프·메모리 단건 추가
```
character add <proj> <name> [--role R] [--profile-file F]
character delete <proj> <name>
worldbook add <proj> <title> [--from-file F] [--priority P]
foreshadow add <proj> --chapter N --title T [--content-file F] [--resolved-at M]
glossary add <proj> <term> [--aliases "a,b,c"]
memory add <proj> <n> <type> <title> [--from-file F] [--importance 0.8]
```

### 질의 / 유틸
```
ask <proj> <질문>                 Gemma 4 + project context(chapters + top memories)
sql "<query>"                      postgres 직접
shell [svc]                        compose 서비스 bash (svc whitelist 적용)
```

## 표준 워크플로

### 새 작품 (대본) 시작
```bash
# 프로젝트 생성 (id stdout)
ID=$(pxi run ainovel project new "작품명" --genre SF --logline "…" | tail -1)

# 설정 (world/style/constraints) + 캐릭터 먼저
pxi run ainovel character add $ID "이름" --role 주인공 --profile-file p.md
pxi run ainovel worldbook add $ID "세계관" --priority must --from-file w.md

# 장 본문
pxi run ainovel chapter add $ID 1 "제목" --from-file ch1_대본.md

# 복선·용어·기억
pxi run ainovel foreshadow add $ID --chapter 1 --title 단서 --resolved-at 9
pxi run ainovel glossary add $ID "용어" --aliases "a,b,c"
pxi run ainovel memory add $ID 1 chapter_summary 요약 --importance 0.9

# 상태 점검
pxi run ainovel project audit $ID
```

### 단편영화 대본 → 소설 산문화
```bash
# 1. 원본 export (NAS + 레포 양쪽 백업)
pxi run ainovel project export <src> /root/ainovel-backups/src-$(date +%F).json
pxi run backup now 50176 --storage truenas-backup --mode snapshot

# 2. 복제 + 본문 비움
NOVEL=$(pxi run ainovel project clone <src> "소설판" | tail -1)
pxi run ainovel sql "UPDATE chapters SET content_md='' WHERE project_id='$NOVEL'"

# 3. 산문화 (장별 LLM 호출, Gemma 4 기본)
pxi run ainovel chapter novelize <src> $NOVEL all

# 외부 파일(Opus 4.7 등 더 강력한 LLM 결과) 이 있다면
pxi run ainovel chapter import-md $NOVEL 1 ch1.md
```

### 프로젝트 데이터 덤프/복원
```bash
pxi run ainovel project export <id> backup.json
pxi run ainovel project import <new_id> backup.json --dry-run    # preview
pxi run ainovel project import <new_id> backup.json              # upsert
```

### 번역 drift 대응 (새 프로젝트 생성 시 중국어 seed 재발)
```bash
pxi run ainovel llm-mode translate      # Gemma 4 stop, TG start, auto-timer on
pxi run ainovel auto-run-now            # 즉시 1회 번역
pxi run ainovel llm-mode gemma          # 다시 소설 쓰기 모드
```

## 운영 주의

- **docker compose 는 반드시 `--env-file .env.docker`**: 안 주면 default password(`ainovel`)로 시도해 postgres auth 실패. 기본 `pxi-ainovel` 은 자동 지정.
- **CJK scan 은 Python 으로**: bash `grep -P "[\x{4e00}-\x{9fff}]"` 는 pct→lxc→bash 레이어에서 거짓 0 을 반환. `Python re.compile(r'[\u4e00-\u9fff]')` 필수.
- **LLM 공존 불가**: Gemma 4(31GB) + TG 4 shim(17GB×4) 동시 상주 시 4 GPU 각 24GB 한도 초과. 반드시 `llm-mode` 로 단독 상주.
- **Gemma 4 는 reasoning 모델**: max_tokens 24k 도 content 잘릴 수 있음. 긴 본문이 필요하면 외부 LLM(Opus 등) 을 env override 로 주입.
- **clone 직후 meta 반영 버그**: `project clone` 이 import 를 거치면서 src 의 name/owner 를 복사. 필요 시 수동 `UPDATE projects SET name='...', owner_user_id='...'`.
- **svc 인자 whitelist**: logs/rebuild/shell 은 `frontend|backend|postgres|redis|rq_worker` 만 받음.

## 현재 운영 프로젝트

| id | 이름 | 성격 | 상태 |
|---|---|---|---|
| `9220fbe2-12d3-4684-a1d3-7049fdb3706d` | 실종된 너를 발견했다 (단편영화판) | 원본 대본, read-only | 11장 완성, audit 100% |
| `5e85f22f-3887-4234-b29b-c4771d7b195b` | 실종된 너를 발견했다 (소설판) | 산문화 사본 | 11장 63,842자 주입 완료 |

## 인프라 매핑

- Ai-Novel: LXC 50176 (10.0.50.176) · docker compose (`postgres`, `backend`, `rq_worker`, `frontend`)
- Gemma 4 31B Q8: LXC 60104 · `http://10.0.60.104:8091/v1` · tensor_split 1,1,1,1
- nomic-embed-text v1.5: LXC 60104 · `http://10.0.60.104:8092/v1`
- TranslateGemma 27B Q4_K_M (4 shim): LXC 60108 · `http://10.0.60.108:{8080,8081,8082,8083}/translate`
- 자동 번역 timer: pve 호스트 systemd `ainovel-translate.timer` (`*:0/10` 권장)
- 번역 캐시: `/tmp/ainovel-gemma-translate/translations.json`
- LXC 백업: `/mnt/pve/truenas-backup/dump/vzdump-lxc-50176-*.tar.zst`
- 프로젝트 JSON 백업: `/root/ainovel-backups/` + `/mnt/truenas/shared/ainovel-backups/`
