#!/usr/bin/env python3
"""src_project 의 chapter 본문(대본)을 소설 산문체로 변환해 dst_project 에 저장.

사용법:
    novelize-chapter.py <src_proj> <dst_proj> <n> [--style FILE]
    novelize-chapter.py <src_proj> <dst_proj> all [--style FILE]

Ai-Novel backend container 안에서 실행됨 (LLM client 의존).
환경변수로 모델/엔드포인트 오버라이드 가능:
    AINOVEL_LLM_BASE_URL (기본: dst_proj 의 llm_preset 사용)
    AINOVEL_LLM_MODEL
    AINOVEL_LLM_API_KEY

호스트에서는 pxi-ainovel chapter novelize 커맨드로 호출.
"""
from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, "/app")

from app.db.session import SessionLocal
from app.llm.client import call_llm
from app.models.chapter import Chapter
from app.models.llm_preset import LLMPreset
from sqlalchemy import update


DEFAULT_STYLE = """당신은 한국어 문학 소설을 쓰는 작가입니다. 영화 대본을 읽고 그것을 장편 소설의 한 장으로 자연스럽게 재구성합니다.

원칙:
- 3인칭 관찰자 시점. 주인공 내면에 접근할 때는 3인칭 제한적 시점으로 자연스럽게 이동.
- 지문(화면 지시)은 구체적 묘사와 분위기로 풀어내고, 불필요한 카메라 지시어는 지움.
- 대사는 쌍따옴표("")로 감싸고 화자 태그(우주가 말했다 / 조용히 덧붙였다)는 필요한 곳에만.
- INTRO 기사·자막 같은 메타 정보는 작품 프롤로그/에피그래프 형태로 재배치.
- 배경·시각·냄새·소리·온도를 한 번씩 짚어 독자를 장면에 앉힌다.
- 문장 호흡: 짧고 단단한 문장과 긴 묘사 문장을 섞어 리듬을 만든다.
- 번역투("~할 수 있다", "~것으로 보인다") 지양.
- 원본 대사는 가급적 보존, 지문만 문학적으로 풀어냄.
- 분량: 한국어 약 4,000~6,000자.
"""


def get_llm_config(db, dst_proj: str) -> dict:
    """프로젝트 preset 또는 env 에서 LLM 설정 추출."""
    p = db.get(LLMPreset, dst_proj)
    if not p:
        raise RuntimeError(f"llm_preset for {dst_proj} not found")
    return {
        "provider": os.environ.get("AINOVEL_LLM_PROVIDER") or p.provider,
        "base_url": os.environ.get("AINOVEL_LLM_BASE_URL") or p.base_url,
        "model": os.environ.get("AINOVEL_LLM_MODEL") or p.model,
        "api_key": os.environ.get("AINOVEL_LLM_API_KEY") or "sk-local",
        "temperature": float(os.environ.get("AINOVEL_LLM_TEMPERATURE") or p.temperature or 0.85),
        "max_tokens": int(os.environ.get("AINOVEL_LLM_MAX_TOKENS") or p.max_tokens or 24000),
        "timeout": int(os.environ.get("AINOVEL_LLM_TIMEOUT") or p.timeout_seconds or 600),
    }


def novelize(db, src_proj: str, dst_proj: str, n: int, system: str, cfg: dict) -> tuple[int, str]:
    src = db.query(Chapter).filter_by(project_id=src_proj, number=n).first()
    dst = db.query(Chapter).filter_by(project_id=dst_proj, number=n).first()
    if not src:
        return (1, f"src ch{n} 없음")
    if not dst:
        return (1, f"dst ch{n} 없음")

    user = (
        f"다음은 원본 대본 {n}장 \"{src.title}\" 입니다. 소설 {n}장으로 재작성하세요.\n\n"
        f"[원본]\n{src.content_md}\n\n"
        f"[요약 (참고)]\n{dst.summary or ''}\n\n"
        "지금부터 소설 본문만 출력하세요. 장 제목이나 메타 설명 없이 본문부터 시작합니다."
    )

    r = call_llm(
        provider=cfg["provider"], base_url=cfg["base_url"], api_key=cfg["api_key"],
        model=cfg["model"], system=system, user=user,
        params={"temperature": cfg["temperature"], "max_tokens": cfg["max_tokens"]},
        timeout_seconds=cfg["timeout"],
    )
    text = (r.text or "").strip()
    if not text:
        return (2, f"ch{n} 빈 응답 (finish={r.finish_reason})")

    db.execute(update(Chapter).where(Chapter.id == dst.id).values(content_md=text))
    db.commit()
    return (0, f"ch{n}: {len(text)} chars, finish={r.finish_reason}, {r.latency_ms}ms")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src_proj")
    ap.add_argument("dst_proj")
    ap.add_argument("n", help="chapter number 또는 'all'")
    ap.add_argument("--style-file", help="system prompt override file")
    args = ap.parse_args()

    db = SessionLocal()
    system = DEFAULT_STYLE
    if args.style_file:
        system = Path(args.style_file).read_text(encoding="utf-8")

    cfg = get_llm_config(db, args.dst_proj)
    print(f"using: {cfg['provider']} {cfg['base_url']} model={cfg['model']} temp={cfg['temperature']} max={cfg['max_tokens']}", file=sys.stderr)

    if args.n == "all":
        chapters = db.query(Chapter).filter_by(project_id=args.src_proj).order_by(Chapter.number).all()
        numbers = [c.number for c in chapters]
    else:
        numbers = [int(args.n)]

    rc = 0
    for n in numbers:
        code, msg = novelize(db, args.src_proj, args.dst_proj, n, system, cfg)
        print(msg)
        rc |= code
    return rc


if __name__ == "__main__":
    sys.exit(main())
