#!/usr/bin/env python3
"""
validate_exam_quality_full.py: Comprehensive content QA for all MCQ JSON files

Extends validate_exam_quality.py to scan ALL question JSON files in the repository,
not just certification exams. Validates schema consistency and content quality.

Usage:
  python tools/validate_exam_quality_full.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DRAFT_PATTERNS = re.compile(
    r"wait, let me|user provided|context-dependent|may have intended|the answer is [A-D]\b",
    re.IGNORECASE,
)


def find_all_mcq_files():
    """Discover all MCQ JSON files in data/"""
    data_dir = ROOT / "data"
    mcq_files = []
    
    # Scan all subdirectories
    for subdir in data_dir.iterdir():
        if subdir.is_dir() and subdir.name not in ['.', '__pycache__']:
            for json_file in subdir.glob("*.json"):
                # Skip non-question files (e.g., flashcards metadata)
                if not json_file.name.startswith('.'):
                    mcq_files.append(json_file)
    
    return sorted(mcq_files)


def validate_file(path: Path):
    """Validate a single MCQ JSON file"""
    issues = []
    
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [(None, f"JSON parse error: {e}")]
    
    questions = data.get("questions", [])
    
    if not questions:
        return [(None, "No questions found in file")]
    
    for q in questions:
        qid = q.get("id")
        options = q.get("options", [])
        feedback = q.get("optionFeedback", [])
        correct = q.get("correctAnswer")
        explanation = q.get("explanation", "")
        
        # Schema validation
        if len(options) != 4:
            issues.append((qid, "options must contain exactly 4 entries"))
        
        if len(feedback) != 4:
            issues.append((qid, "optionFeedback must contain exactly 4 entries"))
        else:
            if isinstance(correct, int) and 0 <= correct < 4:
                if feedback[correct] is not None:
                    issues.append((qid, "optionFeedback at correctAnswer must be null"))
                for i, f in enumerate(feedback):
                    if i != correct and f is None:
                        issues.append((qid, f"optionFeedback for wrong option {i} is null"))
            else:
                issues.append((qid, "correctAnswer must be integer 0..3"))
        
        # Content quality
        if not explanation or len(str(explanation).strip()) == 0:
            issues.append((qid, "explanation is empty or missing"))
        elif DRAFT_PATTERNS.search(explanation or ""):
            issues.append((qid, "draft language found in explanation"))
        
        if not q.get("question"):
            issues.append((qid, "question text is empty"))
    
    return issues


def main():
    mcq_files = find_all_mcq_files()
    
    if not mcq_files:
        print("[FAIL] No MCQ files found in data/")
        return 1
    
    print(f"[INFO] Scanning {len(mcq_files)} MCQ files...\n")
    
    total_issues = 0
    passed = 0
    failed = 0
    
    for mcq_file in mcq_files:
        rel_path = mcq_file.relative_to(ROOT)
        issues = validate_file(mcq_file)
        
        if not issues:
            print(f"[PASS] {rel_path}")
            passed += 1
        else:
            print(f"[FAIL] {rel_path} - {len(issues)} issue(s)")
            for qid, msg in issues[:5]:  # Show first 5 issues
                qid_label = f"Q{qid}" if qid else "FILE"
                print(f"    {qid_label}: {msg}")
            if len(issues) > 5:
                print(f"    ... and {len(issues) - 5} more")
            failed += 1
            total_issues += len(issues)
    
    print(f"\n[SUMMARY] {passed} passed, {failed} failed")
    print(f"[ISSUES] Total issues: {total_issues}")
    
    return 1 if total_issues > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
