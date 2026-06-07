"""
프롬프트 인젝션 / 제일브레이크 탐지 게이트웨이 테스트 러너.

data/prompt_test_dataset.csv 의 각 prompt 를 /api/analyze 로 POST 한 뒤
data/prompt_test_result.csv 에 결과를 저장한다.

실행:
    cd backend
    python run_test.py

옵션:
    python run_test.py --url http://localhost:8000/api/analyze
    python run_test.py --timeout 60
"""

import argparse
import csv
import os
import re
import sys
import time
import uuid

import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
INPUT_CSV = os.path.join(PROJECT_ROOT, "data", "prompt_test_dataset.csv")
OUTPUT_CSV = os.path.join(PROJECT_ROOT, "data", "prompt_test_result_v6.csv")

DEFAULT_URL = "http://localhost:8000/api/analyze"
DEFAULT_TIMEOUT = 60

OUTPUT_FIELDS = [
    "id",
    "prompt",
    "category",
    "expected_action",
    "actual_action",
    "expected_rule",
    "actual_rule",
    "risk_score",
    "test_result",
    "note",
]

RULE_REASON_RE = re.compile(r"YARA Rule matched:\s*(\S+)")


def extract_rule_name(rule_result: dict) -> str:
    """rule_result.reason 에서 매칭된 YARA 룰명을 뽑아낸다. 없으면 'none'."""
    if not isinstance(rule_result, dict):
        return "none"
    if not rule_result.get("detected"):
        return "none"
    reason = rule_result.get("reason", "")
    m = RULE_REASON_RE.search(reason)
    if m:
        return m.group(1)
    # 룰명이 reason 에 없으면 attack_type 으로 폴백
    return rule_result.get("attack_type") or "unknown"


def judge(expected: str, actual: str) -> str:
    """expected_action 과 actual_action 비교해서 PASS / PARTIAL / FAIL / ERROR 반환."""
    if actual == "ERROR":
        return "ERROR"
    if expected == actual:
        return "PASS"

    # 공격 기대 (Block / Warning) ↔ Allow 는 FAIL
    if expected in ("Block", "Warning") and actual == "Allow":
        return "FAIL"
    # 정상 기대 (Allow) ↔ Block/Warning 도 FAIL
    if expected == "Allow" and actual in ("Block", "Warning"):
        return "FAIL"

    # Block ↔ Warning 은 PARTIAL
    if {expected, actual} == {"Block", "Warning"}:
        return "PARTIAL"

    return "FAIL"


def call_api(session: requests.Session, url: str, prompt: str, timeout: int) -> dict:
    """API 호출. 성공 시 (decision, rule_name, risk_score, error_msg) 형태의 dict 반환."""
    payload = {
        # 행마다 고유 ID 를 부여해 이전 대화 컨텍스트 오염을 방지한다.
        "conversation_id": f"test-{uuid.uuid4().hex[:12]}",
        "user_input": prompt,
        "use_security": True,
    }
    try:
        resp = session.post(url, json=payload, timeout=timeout)
    except requests.exceptions.RequestException as e:
        return {"error": f"RequestException: {e}"}

    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}

    try:
        data = resp.json()
    except ValueError as e:
        return {"error": f"JSON decode error: {e}"}

    # app.py 는 예외 시 status=error 로 200 을 돌려준다.
    if data.get("status") == "error":
        return {"error": f"server error: {data.get('message', 'unknown')}"}

    return {
        "decision": data.get("decision", "ERROR"),
        "rule_name": extract_rule_name(data.get("rule_result", {})),
        "risk_score": data.get("risk_score", ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Prompt detection gateway test runner")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"API endpoint (default: {DEFAULT_URL})")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="요청 타임아웃(초)")
    parser.add_argument("--input", default=INPUT_CSV, help="입력 CSV 경로")
    parser.add_argument("--output", default=OUTPUT_CSV, help="출력 CSV 경로")
    parser.add_argument("--sleep", type=float, default=0.0, help="요청 사이 sleep(초). 레이트리밋 회피용")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"[ERROR] 입력 CSV 를 찾을 수 없습니다: {args.input}")
        return 1

    with open(args.input, "r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    total = len(rows)
    if total == 0:
        print("[ERROR] 입력 CSV 가 비어 있습니다.")
        return 1

    print(f"[INFO] 입력: {args.input}")
    print(f"[INFO] 출력: {args.output}")
    print(f"[INFO] 엔드포인트: {args.url}")
    print(f"[INFO] 총 {total} 건 처리 시작\n")

    session = requests.Session()
    results = []
    counts = {"PASS": 0, "PARTIAL": 0, "FAIL": 0, "ERROR": 0}

    started = time.time()
    for i, row in enumerate(rows, start=1):
        row_id = row.get("id", "")
        prompt = row.get("prompt", "")
        category = row.get("category", "")
        expected_action = row.get("expected_action", "")
        expected_rule = row.get("expected_rule", "")

        print(f"[{i}/{total}] id={row_id} 처리 중...", end=" ", flush=True)

        resp = call_api(session, args.url, prompt, args.timeout)

        if "error" in resp:
            actual_action = "ERROR"
            actual_rule = "ERROR"
            risk_score = ""
            err_msg = resp["error"]
            print(f"ERROR ({err_msg})")
        else:
            actual_action = resp["decision"]
            actual_rule = resp["rule_name"]
            risk_score = resp["risk_score"]
            print(f"decision={actual_action} rule={actual_rule} score={risk_score}")

        test_result = judge(expected_action, actual_action)
        counts[test_result] = counts.get(test_result, 0) + 1

        results.append({
            "id": row_id,
            "prompt": prompt,
            "category": category,
            "expected_action": expected_action,
            "actual_action": actual_action,
            "expected_rule": expected_rule,
            "actual_rule": actual_rule,
            "risk_score": risk_score,
            "test_result": test_result,
            "note": "",
        })

        if args.sleep > 0:
            time.sleep(args.sleep)

    elapsed = time.time() - started

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(results)

    print()
    print(f"[INFO] 완료: {elapsed:.1f}s, 결과 저장 -> {args.output}")
    print(f"[INFO] 요약: PASS={counts['PASS']}  PARTIAL={counts['PARTIAL']}  "
          f"FAIL={counts['FAIL']}  ERROR={counts['ERROR']}  (total={total})")
    return 0


if __name__ == "__main__":
    sys.exit(main())