#!/usr/bin/env python3
"""Kibana ja→ko bulk translator using TranslateGemma API"""
import json, sys, os, time, concurrent.futures, requests

API_ENDPOINTS = [
    "http://10.0.60.108:8080",
    "http://10.0.60.108:8081",
    "http://10.0.60.108:8082",
    "http://10.0.60.108:8083",
]
WORKERS = 8
BATCH_SAVE = 500  # save progress every N translations
TIMEOUT = 30

def translate(text, endpoint):
    """Translate ja→ko via TranslateGemma API"""
    try:
        r = requests.post(f"{endpoint}/translate", json={
            "text": text,
            "source_lang_code": "ja",
            "target_lang_code": "ko",
            "max_new_tokens": 1024,
        }, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json().get("translation", text)
    except Exception as e:
        return None

def main():
    src = json.load(open("/root/homelab-i18n/kibana/messages-ja.json"))
    
    # Load progress if exists
    out_path = "/root/homelab-i18n/kibana/messages-ko.json"
    if os.path.exists(out_path):
        done = json.load(open(out_path))
        print(f"Resuming: {len(done)}/{len(src)} done")
    else:
        done = {}
    
    todo = {k: v for k, v in src.items() if k not in done}
    print(f"To translate: {len(todo)} keys")
    if not todo:
        print("All done!")
        return
    
    # Check which endpoints are alive
    alive = []
    for ep in API_ENDPOINTS:
        try:
            r = requests.post(f"{ep}/translate", json={
                "text": "テスト", "source_lang_code": "ja", "target_lang_code": "ko"
            }, timeout=10)
            if r.status_code == 200 and "translation" in r.json():
                alive.append(ep)
                print(f"  ✓ {ep}")
            else:
                print(f"  ✗ {ep} (status={r.status_code})")
        except:
            print(f"  ✗ {ep} (unreachable)")
    
    if not alive:
        print("No alive endpoints!")
        sys.exit(1)
    
    print(f"Using {len(alive)} endpoints, {WORKERS} workers")
    
    items = list(todo.items())
    counter = [0]
    start = time.time()
    
    def do_one(idx_key_val):
        idx, key, val = idx_key_val
        ep = alive[idx % len(alive)]
        result = translate(val, ep)
        if result is None:
            # retry once on different endpoint
            ep2 = alive[(idx + 1) % len(alive)]
            result = translate(val, ep2)
        return key, result
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        tasks = [(i, k, v) for i, (k, v) in enumerate(items)]
        for key, result in pool.map(do_one, tasks):
            if result is not None:
                done[key] = result
            counter[0] += 1
            if counter[0] % 100 == 0:
                elapsed = time.time() - start
                rate = counter[0] / elapsed
                remaining = (len(items) - counter[0]) / rate if rate > 0 else 0
                print(f"  {counter[0]}/{len(items)} ({rate:.1f}/s, ~{remaining/60:.0f}m left)")
            if counter[0] % BATCH_SAVE == 0:
                json.dump(done, open(out_path, 'w'), ensure_ascii=False, indent=2)
    
    json.dump(done, open(out_path, 'w'), ensure_ascii=False, indent=2)
    print(f"\nDone: {len(done)}/{len(src)} keys translated")
    print(f"Saved to {out_path}")

if __name__ == "__main__":
    main()
