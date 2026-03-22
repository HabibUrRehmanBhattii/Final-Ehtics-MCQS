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


split_life_quizzes = load_module("split_life_quizzes", "tools/split_life_quizzes.py")


class SplitLifeQuizzesTests(unittest.TestCase):
    def test_split_quiz_spec_writes_expected_part_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            life_dir = Path(tmpdir)
            source_path = life_dir / "sample-life.json"
            source_path.write_text(
                json.dumps(
                    {
                        "topic": "Sample Topic",
                        "topicId": "sample-topic",
                        "description": "Sample Description",
                        "examTips": "Read carefully.",
                        "questions": [
                            {"id": 1, "question": "Q1"},
                            {"id": 2, "question": "Q2"},
                            {"id": 3, "question": "Q3"},
                            {"id": 4, "question": "Q4"},
                        ],
                    }
                ),
                encoding="utf-8",
            )

            spec = {
                "source": "sample-life.json",
                "groups": [range(1, 3), range(3, 5)],
                "output_base": "sample-life",
                "description": "Sample Life Quiz",
            }

            written_paths = split_life_quizzes.split_quiz_spec(life_dir, spec)

            self.assertEqual(
                [path.name for path in written_paths],
                ["sample-life-part-1.json", "sample-life-part-2.json"],
            )

            part_one = json.loads(written_paths[0].read_text(encoding="utf-8"))
            part_two = json.loads(written_paths[1].read_text(encoding="utf-8"))

            self.assertEqual(part_one["description"], "Sample Life Quiz - Section 1")
            self.assertEqual(part_two["description"], "Sample Life Quiz - Section 2")
            self.assertEqual([q["id"] for q in part_one["questions"]], [1, 2])
            self.assertEqual([q["id"] for q in part_two["questions"]], [3, 4])
            self.assertEqual(part_one["examTips"], "Read carefully.")


if __name__ == "__main__":
    unittest.main()
