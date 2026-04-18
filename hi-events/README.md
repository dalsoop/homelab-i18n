# Hi.events Korean (ko) Translation

[Hi.events](https://github.com/HiEventsDev/hi.events) (오픈소스 이벤트/티켓팅 플랫폼) 한국어 로케일.

## 커버리지

| 영역 | 파일 | 현황 |
|---|---|---|
| Frontend (Lingui PO) | `src/ko.po` | 2308 msgid 중 2140 번역 (**93%**) |
| Backend (Laravel JSON) | `src/ko.json` | 690 entries |
| Backend (Laravel PHP) | `src/lang-ko/{auth,pagination,passwords,validation}.php` | 130+ entries |

남은 ~168개는 대부분 고유명사(Stripe, Zapier, TikTok 등)·일부 테이블 헤더.

## 구조

```
hi-events/
├── README.md
├── src/
│   ├── ko.po                    frontend 번역 (Lingui gettext)
│   ├── ko.json                  backend app-specific 번역
│   ├── lang-ko/
│   │   ├── auth.php             Laravel 인증 메시지
│   │   ├── pagination.php       페이지네이션
│   │   ├── passwords.php        비밀번호 재설정
│   │   └── validation.php       밸리데이션
│   └── patches/
│       ├── Locale.patch         backend/app/Locale.php — ko enum 추가
│       ├── lingui.config.patch  lingui 컴파일 타겟에 ko 추가
│       ├── locales.patch        frontend/src/locales.ts — ko 등록
│       ├── index.patch          LanguageSwitcher — case "ko" 추가 (버그 수정)
│       └── summary.patch        이메일 템플릿 하드코딩 " at " 래핑
└── deploy.sh                    clone + 패치 + 빌드 + 배포
```

## 전제

- Hi.events 소스 (기본 브랜치: `develop`)
- Docker (풀 빌드 용, 이미지 ~1.5GB)
- 대상 LXC에서 `docker build` 실행

## 사용

```bash
# 기본 (develop 브랜치, hi-events-ko:latest 이미지, LXC 50174에 빌드)
bash deploy.sh

# 옵션
bash deploy.sh --vmid 50174 --image hi-events-ko:latest --src /opt/hi-events-src
```

## 업스트림 패치 내용

`src/patches/*.patch`에 5개 파일 변경. 중요한 버그 수정이 섞여 있음:

- **`index.patch` (LanguageSwitcher)**: `getLocaleName` switch에 `case "ko"` 추가. 이게 없으면 ko locale에서 SSR이 Mantine `defaultOptionsFilter` `.toLowerCase()` undefined로 500 에러. 업스트림 PR 감.
- **`summary.patch`**: 이메일 템플릿에 하드코딩된 " at " 문자열을 `__()` 로 래핑. 업스트림 PR 감.

## 핵심 상수

- 번역 스타일: 합쇼체(~합니다) + 해요체(따뜻한 CTA)
- 주요 용어: Event→이벤트 / Ticket→티켓 / Attendee→참가자 / Organizer→주최자 / Order→주문 / Check-in→체크인 / Refund→환불 / Waitlist→대기 명단 / Capacity→정원 / Invoice→청구서 / Webhook→웹훅

## 업데이트 워크플로

업스트림이 새 msgid를 추가하면:

```bash
cd /opt/hi-events-src && git fetch origin && git checkout origin/develop -- frontend/src/locales/en.po
msgmerge --output-file=frontend/src/locales/ko.po frontend/src/locales/ko.po frontend/src/locales/en.po
# 누락 msgstr 번역 후 ko.po를 이 리포의 src/ko.po로 복사
```
