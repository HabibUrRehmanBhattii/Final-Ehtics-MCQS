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


split_flashcards = load_module("split_flashcards", "tools/split_flashcards.py")


class SplitFlashcardsTests(unittest.TestCase):
    def test_split_flashcards_writes_parts_backup_and_topics_metadata(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            flashcards_dir = root / "data" / "flashcards"
            flashcards_dir.mkdir(parents=True)

            source_payload = {
                "questions": [
                    {"id": 1, "question": "Q1"},
                    {"id": 2, "question": "Q2"},
                    {"id": 3, "question": "Q3"},
                    {"id": 4, "question": "Q4"},
                    {"id": 5, "question": "Q5"},
                ]
            }
            (flashcards_dir / "flashcards-2.json").write_text(
                json.dumps(source_payload),
                encoding="utf-8",
            )
            (root / "data" / "topics.json").write_text(
                json.dumps(
                    {
                        "topics": [
                            {
                                "id": "flashcards-basic",
                                "practiceTests": [
                                    {"id": "flash-1", "name": "Set 1"},
                                    {"id": "flash-2-old", "name": "Old Set 2"},
                                ],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            created = split_flashcards.split_flashcards(root=root, chunk_size=2)

            self.assertEqual(
                created,
                [
                    ("flashcards-2-part-1.json", 2),
                    ("flashcards-2-part-2.json", 2),
                    ("flashcards-2-part-3.json", 1),
                ],
            )

            backup_payload = json.loads(
                (flashcards_dir / "flashcards-2-full.json").read_text(encoding="utf-8")
            )
            part_one_payload = json.loads(
                (flashcards_dir / "flashcards-2-part-1.json").read_text(encoding="utf-8")
            )
            topics_payload = json.loads(
                (root / "data" / "topics.json").read_text(encoding="utf-8")
            )

            self.assertEqual(backup_payload, source_payload)
            self.assertEqual(part_one_payload["topicId"], "flashcards-advanced-2-part-1")
            self.assertEqual(
                part_one_payload["description"],
                "Part 1 of Flashcards Set 2 (Policy provisions, group & health insurance basics)",
            )
            self.assertEqual([question["id"] for question in part_one_payload["questions"]], [1, 2])

            practice_tests = topics_payload["topics"][0]["practiceTests"]
            self.assertEqual(
                [item["id"] for item in practice_tests],
                ["flash-1", "flash-2-part-1", "flash-2-part-2", "flash-2-part-3"],
            )
            self.assertEqual(
                practice_tests[1]["description"],
                "Part 1 - Policy provisions, group & health insurance basics",
            )


if __name__ == "__main__":
    unittest.main()
