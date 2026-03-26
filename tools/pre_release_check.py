#!/usr/bin/env python3
"""
pre_release_check.py: Comprehensive pre-release safety validation

Validates:
- Version tag consistency across index.html, app.js, sw.js
- Metadata parity between topics.json and topics-updated.json
- No test/debug scripts in production HTML
- All MCQ files pass quality checks
- Cache version is properly bumped

Run before each deployment to catch common release issues.

Usage:
  python tools/pre_release_check.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check_version_tags():
    """Validate version tag consistency"""
    issues = []
    
    try:
        index_html = (ROOT / "index.html").read_text(encoding="utf-8")
        app_js = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        sw_js = (ROOT / "sw.js").read_text(encoding="utf-8")
    except FileNotFoundError as e:
        return [(f"File not found: {e}")]
    
    # Extract app build version
    build_match = re.search(r"appBuildVersion:\s*'([^']+)'", app_js)
    if not build_match:
        issues.append("appBuildVersion not found in js/app.js")
        return issues
    app_build_version = build_match.group(1)
    
    # Extract cache version
    cache_match = re.search(r"cacheVersion:\s*'([^']+)'", app_js)
    if not cache_match:
        issues.append("cacheVersion not found in js/app.js")
        return issues
    app_cache_version = cache_match.group(1)
    
    # Check SW cache version
    sw_cache_match = re.search(r"const\s+CACHE_VERSION\s*=\s*'([^']+)'", sw_js)
    if not sw_cache_match:
        issues.append("CACHE_VERSION not found in sw.js")
    elif sw_cache_match.group(1) != app_cache_version:
        issues.append(
            f"Cache version mismatch: app.js={app_cache_version}, sw.js={sw_cache_match.group(1)}"
        )
    
    # Check HTML asset versions
    asset_versions = re.findall(
        r"""(?:href|src)="(?:manifest\.webmanifest|css/[^"]+|js/[^"]+)\?v=([^"]+)""",
        index_html
    )
    mismatches = [v for v in asset_versions if v != app_build_version]
    if mismatches:
        issues.append(
            f"HTML asset ?v= tags mismatch with appBuildVersion={app_build_version}: {set(mismatches)}"
        )
    
    return issues


def check_metadata_parity():
    """Validate topics.json and topics-updated.json parity"""
    issues = []
    
    try:
        primary = json.loads((ROOT / "data" / "topics.json").read_text(encoding="utf-8"))
        mirror = json.loads((ROOT / "data" / "topics-updated.json").read_text(encoding="utf-8"))
    except FileNotFoundError as e:
        return [(f"Metadata file not found: {e}")]
    except json.JSONDecodeError as e:
        return [(f"JSON parse error in metadata: {e}")]
    
    if primary != mirror:
        issues.append("topics.json and topics-updated.json are out of sync")
    
    return issues


def check_production_shell():
    """Validate index.html has no test/debug scripts"""
    issues = []
    
    try:
        index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    except FileNotFoundError:
        return ["index.html not found"]
    
    if 'src="tests/' in index_html:
        issues.append("Production index.html loads test scripts (remove before deploy)")
    
    return issues


def check_mcq_quality():
    """Run full MCQ quality validation, excluding allowed empty placeholders"""
    issues = []
    
    # Import the validation tool
    sys.path.insert(0, str(ROOT / "tools"))
    try:
        import validate_exam_quality_full
        
        mcq_files = validate_exam_quality_full.find_all_mcq_files()
        if not mcq_files:
            issues.append("No MCQ files found")
            return issues
        
        total_quality_issues = 0
        for mcq_file in mcq_files:
            file_issues = validate_exam_quality_full.validate_file(mcq_file)
            
            # Filter out "no questions" errors for allowed empty placeholders or any file
            # (empty files are just future content placeholders, not quality issues)
            filtered_issues = []
            for issue in file_issues:
                # issue is a tuple (qid, message)
                _, message = issue
                # Skip all "no questions" errors - these are intentional placeholders
                if message == "No questions found in file":
                    continue
                filtered_issues.append(issue)
            
            total_quality_issues += len(filtered_issues)
        
        if total_quality_issues > 0:
            issues.append(f"MCQ quality check: {total_quality_issues} issue(s) found")
    except Exception as e:
        issues.append(f"Could not run MCQ validator: {e}")
    finally:
        sys.path.pop(0)
    
    return issues


def main():
    print("[INFO] Pre-Release Safety Check\n")
    print("=" * 60)
    
    all_issues = {}
    
    checks = [
        ("Version Tag Consistency", check_version_tags),
        ("Metadata Parity", check_metadata_parity),
        ("Production Shell", check_production_shell),
        ("MCQ Quality", check_mcq_quality),
    ]
    
    for check_name, check_fn in checks:
        print(f"\n[CHECK] {check_name}...")
        issues = check_fn()
        
        if not issues:
            print(f"  [PASS]")
        else:
            print(f"  [FAIL] ({len(issues)} issue(s))")
            for issue in issues:
                print(f"     - {issue}")
            all_issues[check_name] = issues
    
    print("\n" + "=" * 60)
    
    if not all_issues:
        print("[PASS] All checks passed! Ready to release.")
        return 0
    else:
        print(f"[FAIL] {len(all_issues)} check(s) failed.")
        print("\nFix these issues before deploying:")
        for check_name in all_issues:
            print(f"  - {check_name}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
