import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name, relative_path):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


validate_exam_quality = load_module("validate_exam_quality", "tools/validate_exam_quality.py")


class ValidateExamQualityTests(unittest.TestCase):
    def write_exam_file(self, payload):
        tmpdir = tempfile.TemporaryDirectory()
        path = Path(tmpdir.name) / "exam.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        self.addCleanup(tmpdir.cleanup)
        return path

    def test_validate_file_accepts_well_formed_question(self):
        path = self.write_exam_file(
            {
                "questions": [
                    {
                        "id": 1,
                        "options": ["A", "B", "C", "D"],
                        "optionFeedback": ["Wrong", None, "Wrong", "Wrong"],
                        "correctAnswer": 1,
                        "explanation": "A clean explanation.",
                    }
                ]
            }
        )

        issues = validate_exam_quality.validate_file(path)
        self.assertEqual(issues, [])

    def test_validate_file_reports_common_quality_issues(self):
        path = self.write_exam_file(
            {
                "questions": [
                    {
                        "id": 9,
                        "options": ["A", "B", "C"],
                        "optionFeedback": ["Wrong", "Should be null", None],
                        "correctAnswer": 1,
                        "explanation": "Wait, let me think about this draft answer.",
                    }
                ]
            }
        )

        issues = validate_exam_quality.validate_file(path)
        self.assertIn((9, "options must contain exactly 4 entries"), issues)
        self.assertIn((9, "optionFeedback must contain exactly 4 entries"), issues)
        self.assertIn((9, "draft language found in explanation"), issues)


if __name__ == "__main__":
    unittest.main()
