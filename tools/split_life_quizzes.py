import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIFE_DIR = ROOT / "data" / "llqp-life"

SPECS = [
    {
        "source": "llqp-life-01.json",
        "groups": [range(1, 11), range(11, 20)],
        "output_base": "llqp-life-01",
        "description": "HLLQP - LIFE 01 QZ - Introduction to Life Insurance",
    },
    {
        "source": "hllqp-life-02.json",
        "groups": [range(1, 11), range(11, 21), range(21, 29), range(29, 37)],
        "output_base": "hllqp-life-02",
        "description": "HLLQP - LIFE 02 QZ - Term Life Insurance",
    },
    {
        "source": "hllqp-life-03.json",
        "groups": [range(1, 11), range(11, 21), range(21, 30), range(30, 39), range(39, 48)],
        "output_base": "hllqp-life-03",
        "description": "HLLQP - LIFE 03 QZ - Whole Life and Term-100 Insurance",
    },
    {
        "source": "hllqp-life-05.json",
        "groups": [range(1, 11), range(11, 21), range(21, 31)],
        "output_base": "hllqp-life-05",
        "description": "HLLQP - LIFE 05 QZ - Riders and Supplementary Benefits",
    },
]


def build_part_data(data, description, part_index, group):
    questions = data["questions"]
    return {
        "topic": data["topic"],
        "topicId": data["topicId"],
        "description": f"{description} - Section {part_index}",
        "examTips": data.get("examTips"),
        "questions": [questions[number - 1] for number in group],
    }


def split_quiz_spec(life_dir, spec):
    source_path = Path(life_dir) / spec["source"]
    data = json.loads(source_path.read_text(encoding="utf-8"))

    written_paths = []
    for part_index, group in enumerate(spec["groups"], start=1):
        part_data = build_part_data(data, spec["description"], part_index, group)
        output_path = Path(life_dir) / f"{spec['output_base']}-part-{part_index}.json"
        output_path.write_text(
            json.dumps(part_data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        written_paths.append(output_path)

    return written_paths


def main():
    for spec in SPECS:
        for output_path in split_quiz_spec(LIFE_DIR, spec):
            print(output_path.name)


if __name__ == "__main__":
    main()
