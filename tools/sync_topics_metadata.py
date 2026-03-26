#!/usr/bin/env python3
"""
sync_topics_metadata.py: Auto-sync topics-updated.json from topics.json

This tool regenerates topics-updated.json from the authoritative topics.json
to prevent manual copy-paste drift. Run before each release.

Usage:
  python tools/sync_topics_metadata.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    primary_path = ROOT / "data" / "topics.json"
    mirror_path = ROOT / "data" / "topics-updated.json"

    if not primary_path.exists():
        print(f"[FAIL] Source file not found: {primary_path}")
        return 1

    try:
        # Read primary source
        primary_data = json.loads(primary_path.read_text(encoding="utf-8"))
        print(f"[PASS] Loaded primary: {primary_path}")

        # Write to mirror (overwrite)
        mirror_path.write_text(json.dumps(primary_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"[PASS] Synced mirror: {mirror_path}")

        # Verify parity
        mirror_data = json.loads(mirror_path.read_text(encoding="utf-8"))
        if primary_data == mirror_data:
            print("[PASS] Metadata now in sync")
            return 0
        else:
            print("[FAIL] Sync failed: data mismatch after write")
            return 1

    except json.JSONDecodeError as e:
        print(f"[FAIL] JSON parsing error: {e}")
        return 1
    except Exception as e:
        print(f"[FAIL] Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
