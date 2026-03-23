import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLASHCARDS_DIR = ROOT / "data" / "flashcards"
SRC = FLASHCARDS_DIR / "flashcards-2.json"
BACKUP = FLASHCARDS_DIR / "flashcards-2-full.json"
TOPICS = ROOT / "data" / "topics.json"
CHUNK_SIZE = 20


def build_part_data(data, part_index, chunk):
    return {
        "topic": f"Flashcards - Policy Provisions & Health/Group (Set 2 - Part {part_index})",
        "topicId": f"flashcards-advanced-2-part-{part_index}",
        "description": f"Part {part_index} of Flashcards Set 2 (Policy provisions, group & health insurance basics)",
        "questions": chunk,
    }


def update_topics(topics, created_parts):
    for topic in topics.get("topics", []):
        if topic.get("id") != "flashcards-basic":
            continue

        tests = [
            practice_test
            for practice_test in topic.get("practiceTests", [])
            if not practice_test.get("id", "").startswith("flash-2")
        ]
        for part_index, (_, count) in enumerate(created_parts, start=1):
            tests.append(
                {
                    "id": f"flash-2-part-{part_index}",
                    "name": f"Flashcards Set 2 - Part {part_index}",
                    "description": f"Part {part_index} - Policy provisions, group & health insurance basics",
                    "questionCount": count,
                    "dataFile": f"data/flashcards/flashcards-2-part-{part_index}.json",
                }
            )
        topic["practiceTests"] = tests
        break

    return topics


def split_flashcards(root=ROOT, chunk_size=CHUNK_SIZE):
    flashcards_dir = Path(root) / "data" / "flashcards"
    src = flashcards_dir / "flashcards-2.json"
    backup = flashcards_dir / "flashcards-2-full.json"
    topics_path = Path(root) / "data" / "topics.json"

    data = json.loads(src.read_text(encoding="utf-8"))
    backup.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    questions = data.get("questions", [])
    created = []
    for index, start in enumerate(range(0, len(questions), chunk_size), start=1):
        chunk = questions[start:start + chunk_size]
        output = build_part_data(data, index, chunk)
        output_path = flashcards_dir / f"flashcards-2-part-{index}.json"
        output_path.write_text(
            json.dumps(output, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        created.append((output_path.name, len(chunk)))

    topics = json.loads(topics_path.read_text(encoding="utf-8"))
    updated_topics = update_topics(topics, created)
    topics_path.write_text(
        json.dumps(updated_topics, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    return created


def main():
    created = split_flashcards()
    print("Created files:")
    for name, count in created:
        print(f" - {name}: {count} questions")
    print("topics.json updated.")


if __name__ == "__main__":
    main()
