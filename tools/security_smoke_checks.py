#!/usr/bin/env python3
"""Production security smoke checks.

Usage:
  python tools/security_smoke_checks.py --base-url https://hllqpmcqs.com
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


def request(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: int = 20,
) -> tuple[int, str]:
    request_headers = {
        "User-Agent": "security-smoke-checks/1.0",
        "Accept": "application/json,text/plain,*/*",
        **(headers or {}),
    }
    req = urllib.request.Request(url=url, method=method, headers=request_headers, data=body)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = resp.read().decode("utf-8", errors="replace")
            return int(resp.getcode()), payload
    except urllib.error.HTTPError as err:
        payload = err.read().decode("utf-8", errors="replace")
        return int(err.code), payload


def require(condition: bool, message: str) -> None:
    if not condition:
        print(f"FAIL: {message}")
        raise SystemExit(1)
    print(f"OK: {message}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="https://hllqpmcqs.com")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    print(f"Running security smoke checks for: {base_url}")

    # 1) Auth config should be reachable and secure flags should be present.
    status, body = request(f"{base_url}/api/auth/config")
    require(status == 200, f"GET /api/auth/config returns 200 (got {status})")

    config = json.loads(body)
    require(config.get("enabled") is True, "Auth config enabled=true")
    require(config.get("adminConfigured") is True, "Admin allowlist is configured")
    require(config.get("adminAutoProvision") is False, "Admin auto-provision is disabled")

    # 2) Sensitive static paths must be blocked.
    blocked_paths = [
        "/data/admin-users.json",
        "/.venv/Lib/site-packages/_pytest/py.typed",
        "/tests/worker_helpers.test.js",
    ]
    for path in blocked_paths:
        status, _ = request(
            f"{base_url}{path}",
            headers={
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
        )
        require(status == 404, f"{path} returns 404 (got {status})")

    # 3) Invalid admin login should be rejected.
    payload = json.dumps(
        {
            "email": "security.probe@example.com",
            "password": "definitely-wrong-password",
        }
    ).encode("utf-8")
    status, _ = request(
        f"{base_url}/api/admin/auth/login",
        method="POST",
        headers={"Content-Type": "application/json"},
        body=payload,
    )
    require(status == 401, f"POST /api/admin/auth/login invalid credentials returns 401 (got {status})")

    print("\nOK: Security smoke checks passed.")


if __name__ == "__main__":
    main()
