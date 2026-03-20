import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    ROOT / "data" / "llqp-life" / "llqp-life-certification-exam.json",
    ROOT / "data" / "llqp-segregated" / "llqp-segregated-certification-exam.json",
]

DRAFT_PATTERNS = re.compile(
    r"wait, let me|user provided|context-dependent|may have intended|the answer is [A-D]\\b",
    re.IGNORECASE,
)


def validate_file(path: Path):
    issues = []
    data = json.loads(path.read_text(encoding="utf-8"))
    questions = data.get("questions", [])

    for q in questions:
        qid = q.get("id")
        options = q.get("options", [])
        feedback = q.get("optionFeedback", [])
        correct = q.get("correctAnswer")
        explanation = q.get("explanation", "")

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
                        issues.append((qid, f"optionFeedback for wrong option index {i} is null"))
            else:
                issues.append((qid, "correctAnswer must be an integer in range 0..3"))

        if DRAFT_PATTERNS.search(explanation or ""):
            issues.append((qid, "draft language found in explanation"))

    return issues


def main():
    total_issues = 0
    for target in TARGETS:
        if not target.exists():
            print(f"[MISSING] {target}")
            total_issues += 1
            continue

        issues = validate_file(target)
        if not issues:
            print(f"[PASS] {target.name} - no issues found")
            continue

        print(f"[FAIL] {target.name} - {len(issues)} issue(s)")
        for qid, msg in issues:
            print(f"  - Q{qid}: {msg}")
        total_issues += len(issues)

    raise SystemExit(1 if total_issues else 0)


if __name__ == "__main__":
    main()
