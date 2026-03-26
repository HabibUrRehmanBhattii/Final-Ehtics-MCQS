#!/usr/bin/env python3
"""
fix_qa_issues.py: Automatically fix common MCQ quality issues

Fixes:
1. optionFeedback at correctAnswer must be null
2. Ensures all feedback entries exist (pad with null/empty)
3. Validates correctAnswer is integer 0..3
4. Warns about missing explanations

Usage:
  python tools/fix_qa_issues.py [--dry-run]
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def find_all_mcq_files():
    """Discover all MCQ JSON files in data/"""
    data_dir = ROOT / "data"
    mcq_files = []
    
    for subdir in data_dir.iterdir():
        if subdir.is_dir() and subdir.name not in ['.', '__pycache__']:
            for json_file in subdir.glob("*.json"):
                if not json_file.name.startswith('.'):
                    mcq_files.append(json_file)
    
    return sorted(mcq_files)


def fix_question(question):
    """Fix a single question and return (fixed_question, changes_made)"""
    changes = []
    q = dict(question)  # Copy
    
    # Get/validate correctAnswer
    correct = q.get("correctAnswer")
    if not isinstance(correct, int) or correct < 0 or correct >= 4:
        changes.append(f"Invalid correctAnswer {correct}")
        correct = 0
        q["correctAnswer"] = correct
    
    # Get/pad options (need exactly 4)
    options = q.get("options", [])
    if len(options) != 4:
        changes.append(f"Options count {len(options)} != 4")
        # Pad with empty strings if needed
        while len(options) < 4:
            options.append("")
        q["options"] = options[:4]
    
    # Get/fix feedback
    feedback = q.get("optionFeedback", [])
    if len(feedback) != 4:
        changes.append(f"Feedback count {len(feedback)} != 4")
        # Pad to 4 entries
        while len(feedback) < 4:
            feedback.append(None)
        feedback = feedback[:4]
    
    # Fix: correctAnswer feedback must be null
    if feedback[correct] is not None:
        changes.append(f"Cleared feedback at correct answer index {correct}")
        feedback[correct] = None
    
    # Ensure wrong answers have non-null feedback
    for i in range(4):
        if i != correct:
            if feedback[i] is None or (isinstance(feedback[i], str) and len(str(feedback[i]).strip()) == 0):
                # Set placeholder if empty
                if feedback[i] is None:
                    feedback[i] = ""
                    changes.append(f"Ensured feedback exists at option {i}")
    
    q["optionFeedback"] = feedback
    
    # Ensure explanation exists (warn only, don't auto-generate)
    if not q.get("explanation") or len(str(q.get("explanation", "")).strip()) == 0:
        changes.append("Missing or empty explanation")
    
    return q, changes


def fix_file(path: Path, dry_run=False):
    """Fix all questions in a file"""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return {"status": "error", "error": f"JSON parse error: {e}"}
    
    questions = data.get("questions", [])
    if not questions:
        return {"status": "skip", "reason": "No questions"}
    
    fixed_questions = []
    total_changes = 0
    change_details = []
    
    for q in questions:
        fixed_q, changes = fix_question(q)
        fixed_questions.append(fixed_q)
        if changes:
            total_changes += len(changes)
            change_details.append({
                "qid": q.get("id"),
                "changes": changes
            })
    
    if not dry_run and change_details:
        data["questions"] = fixed_questions
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return {"status": "fixed", "changes": total_changes, "details": change_details}
    elif dry_run and change_details:
        return {"status": "would_fix", "changes": total_changes, "details": change_details}
    else:
        return {"status": "ok", "changes": 0}


def main():
    dry_run = "--dry-run" in sys.argv
    mode = "DRY-RUN" if dry_run else "FIX"
    
    print(f"[{mode}] MCQ QA Auto-Fixer\n")
    
    mcq_files = find_all_mcq_files()
    if not mcq_files:
        print("[FAIL] No MCQ files found")
        return 1
    
    print(f"[INFO] Scanning {len(mcq_files)} files...\n")
    
    total_fixed = 0
    total_issues = 0
    file_results = []
    
    for mcq_file in mcq_files:
        rel_path = mcq_file.relative_to(ROOT)
        result = fix_file(mcq_file, dry_run=dry_run)
        
        status = result.get("status")
        if status == "ok":
            print(f"[OK] {rel_path}")
        elif status == "skip":
            print(f"[SKIP] {rel_path} - {result['reason']}")
        elif status == "error":
            print(f"[ERROR] {rel_path} - {result['error']}")
            total_issues += 1
        elif status in ("fixed", "would_fix"):
            changes = result.get("changes", 0)
            action = "Fixed" if status == "fixed" else "Would fix"
            print(f"[{action.upper()}] {rel_path} - {changes} change(s)")
            total_fixed += changes
            
            # Show first 3 details
            details = result.get("details", [])
            for detail in details[:3]:
                qid = detail.get("qid")
                changes_list = detail.get("changes", [])
                print(f"     Q{qid}: {changes_list[0] if changes_list else 'N/A'}")
            if len(details) > 3:
                print(f"     ... and {len(details) - 3} more questions")
        
        file_results.append((rel_path, result))
    
    print(f"\n[SUMMARY]")
    print(f"  Total changes: {total_fixed}")
    print(f"  Errors: {total_issues}")
    
    if dry_run:
        print(f"\n[DRY-RUN] Would apply {total_fixed} fixes. Run without --dry-run to commit.")
        return 0 if total_issues == 0 else 1
    else:
        print(f"\n[DONE] Applied {total_fixed} fixes.")
        return 0 if total_issues == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
