#!/usr/bin/env python3
"""uiCopy.ts 중국어 value → 한국어. Claude Sonnet via OpenRouter."""
import json
import os
import re
import urllib.request
import urllib.error
import time

INPUT = "/tmp/uiCopy.zh.ts"
OUTPUT = "/tmp/uiCopy.ko.ts"
KEY = os.environ["OPENROUTER_API_KEY"]

src = open(INPUT).read()

# 중국어 포함 string literal 모두 추출 ("..." 형태)
cjk_re = re.compile(r'"([^"\n]*[\u4e00-\u9fff][^"\n]*)"')
values = sorted(set(cjk_re.findall(src)))
print(f"추출: {len(values)} 개 고유 중국어 문자열")

# 배치 번역 (60개씩)
BATCH = 25
ko_map = {}

SYSTEM = """You are a professional Chinese→Korean translator for a novel-writing web app UI.

CRITICAL OUTPUT RULES:
- Output VALID JSON only. No prose, no markdown, no code fences.
- In JSON values, escape double quotes as \\" — NEVER unescaped.
- In JSON values, escape backslash as \\\\.
- Keep placeholders (e.g. {count}, %s, ${var}) EXACTLY as-is.
- Keep English brand names as-is (ainovel, Atelier, RAG, etc.).

TRANSLATION RULES:
- Natural Korean, 해요체 (professional-friendly).
- Short and clear, UI-appropriate.
- Korean punctuation where natural.

OUTPUT FORMAT (strict JSON):
{"chinese1":"한국어1","chinese2":"한국어2",...}"""


def translate_batch(chunk):
    payload = {
        "model": "anthropic/claude-sonnet-4.6",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Translate to Korean:\n\n" + json.dumps({v: "" for v in chunk}, ensure_ascii=False, indent=2)},
        ],
        "max_tokens": 16000,
        "temperature": 0.2,
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://pve.50.internal.kr",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        resp = json.loads(r.read())
    content = resp["choices"][0]["message"]["content"].strip()
    # ```json ... ``` 벗기기
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\n?", "", content)
        content = re.sub(r"\n?```$", "", content)
    # 첫 { 부터 마지막 } 까지만
    m = re.search(r"\{.*\}", content, re.DOTALL)
    if m:
        content = m.group(0)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # 복구: "key":"value" 패턴 직접 매치
        result = {}
        for km, vm in re.findall(r'"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"', content):
            result[km] = vm.replace('\\"', '"').replace("\\\\", "\\")
        if result:
            return result
        raise


for i in range(0, len(values), BATCH):
    chunk = values[i : i + BATCH]
    print(f"  배치 {i//BATCH + 1}/{(len(values)+BATCH-1)//BATCH}: {len(chunk)}개...", flush=True)
    for attempt in range(3):
        try:
            result = translate_batch(chunk)
            ko_map.update(result)
            break
        except Exception as e:
            print(f"    재시도 {attempt+1}: {e}")
            time.sleep(5)
    time.sleep(1)


# 원본 파일에 치환
translated = src
missing = []
for zh, ko in ko_map.items():
    if not ko:
        missing.append(zh)
        continue
    # 정확한 replacement (따옴표 포함)
    old = f'"{zh}"'
    # 한국어에 " 들어가면 escape
    ko_esc = ko.replace("\\", "\\\\").replace('"', '\\"')
    new = f'"{ko_esc}"'
    translated = translated.replace(old, new)

open(OUTPUT, "w").write(translated)
print(f"\n✓ {OUTPUT} 생성 ({len(ko_map)} 번역 적용, {len(missing)} 누락)")
if missing[:5]:
    print(f"  누락 샘플: {missing[:5]}")
