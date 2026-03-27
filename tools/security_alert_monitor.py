#!/usr/bin/env python3
"""Security alert monitor for production.

Checks:
1) Runs production security smoke checks (blocked paths + auth behavior).
2) Alerts when repeated admin login failures exceed threshold in recent window.

Usage:
  python tools/security_alert_monitor.py \
    --base-url https://hllqpmcqs.com \
    --db-name final-ehtics-mcqs \
    --window-minutes 15 \
    --threshold 20
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys


def run(cmd: list[str]) -> tuple[int, str, str]:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.returncode, proc.stdout, proc.stderr


def parse_failed_count(raw: str) -> int:
    """Best-effort parser for wrangler d1 --json output.

    Handles common shapes and falls back to recursive search for keys.
    """
    data = json.loads(raw)

    def walk(node):
        if isinstance(node, dict):
            for key in ("failed_count", "count", "value"):
                if key in node and isinstance(node[key], (int, float)):
                    yield int(node[key])
            for value in node.values():
                yield from walk(value)
        elif isinstance(node, list):
            for item in node:
                yield from walk(item)

    counts = list(walk(data))
    if not counts:
        raise ValueError("Could not parse failed login count from wrangler output")
    return max(counts)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--db-name", required=True)
    parser.add_argument("--window-minutes", type=int, default=15)
    parser.add_argument("--threshold", type=int, default=20)
    args = parser.parse_args()

    print(f"Monitoring security for {args.base_url}")

    # 1) Smoke checks (includes blocked-path 404 assertions)
    code, out, err = run([
        sys.executable,
        "tools/security_smoke_checks.py",
        "--base-url",
        args.base_url,
    ])
    sys.stdout.write(out)
    if err:
        sys.stderr.write(err)
    if code != 0:
        print("FAIL: Security smoke checks failed")
        raise SystemExit(1)

    # 2) Repeated admin login failure monitoring
    sql = (
        "SELECT COUNT(*) AS failed_count "
        "FROM auth_attempts "
        "WHERE scope IN ('ip','email') "
        "AND success = 0 "
        f"AND created_at >= datetime('now', '-{args.window_minutes} minutes');"
    )

    code, out, err = run([
        "wrangler",
        "d1",
        "execute",
        args.db_name,
        "--remote",
        "--command",
        sql,
        "--json",
    ])

    if code != 0:
        sys.stdout.write(out)
        sys.stderr.write(err)
        print("FAIL: Could not query D1 auth_attempts")
        raise SystemExit(1)

    failed_count = parse_failed_count(out)
    print(
        f"Auth failures (window={args.window_minutes}m): {failed_count} "
        f"(threshold={args.threshold})"
    )

    if failed_count >= args.threshold:
        print("FAIL: Repeated /api/admin/auth/login failures threshold exceeded")
        raise SystemExit(1)

    print("OK: Security alert monitor checks passed")


if __name__ == "__main__":
    main()
