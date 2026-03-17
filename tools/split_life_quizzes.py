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
]

for spec in SPECS:
    source_path = LIFE_DIR / spec["source"]
    data = json.loads(source_path.read_text(encoding="utf-8"))
    questions = data["questions"]

    for part_index, group in enumerate(spec["groups"], start=1):
        part_data = {
            "topic": data["topic"],
            "topicId": data["topicId"],
            "description": f"{spec['description']} - Section {part_index}",
            "examTips": data.get("examTips"),
            "questions": [questions[number - 1] for number in group],
        }

        output_path = LIFE_DIR / f"{spec['output_base']}-part-{part_index}.json"
        output_path.write_text(
            json.dumps(part_data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(output_path.name)
