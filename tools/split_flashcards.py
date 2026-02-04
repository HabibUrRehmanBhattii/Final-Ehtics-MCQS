import json
from pathlib import Path

ROOT = Path(r"c:\Users\C6475\Desktop\Ehtics MCQS")
SRC = ROOT / "data" / "flashcards" / "flashcards-2.json"
BACKUP = ROOT / "data" / "flashcards" / "flashcards-2-full.json"
OUT_DIR = ROOT / "data" / "flashcards"
TOPICS = ROOT / "data" / "topics.json"
CHUNK = 20

with open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

# Backup full
with open(BACKUP, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

questions = data.get("questions", [])
chunks = [questions[i:i+CHUNK] for i in range(0, len(questions), CHUNK)]
created = []
for idx, chunk in enumerate(chunks, start=1):
    out = {
        "topic": f"Flashcards - Policy Provisions & Health/Group (Set 2 - Part {idx})",
        "topicId": f"flashcards-advanced-2-part-{idx}",
        "description": f"Part {idx} of Flashcards Set 2 (Policy provisions, group & health insurance basics)",
        "questions": chunk
    }
    filename = OUT_DIR / f"flashcards-2-part-{idx}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    created.append((filename.name, len(chunk)))

# Update topics.json: replace existing flash-2 with the new parts
with open(TOPICS, "r", encoding="utf-8") as f:
    topics = json.load(f)

for t in topics.get("topics", []):
    if t.get("id") == "flashcards-basic":
        tests = t.get("practiceTests", [])
        # remove any existing flash-2 entries
        tests = [p for p in tests if not (p.get("id","").startswith("flash-2"))]
        # append new parts
        for idx, (_, count) in enumerate(created, start=1):
            tests.append({
                "id": f"flash-2-part-{idx}",
                "name": f"Flashcards Set 2 - Part {idx}",
                "description": f"Part {idx} — Policy provisions, group & health insurance basics",
                "questionCount": count,
                "dataFile": f"data/flashcards/flashcards-2-part-{idx}.json"
            })
        t["practiceTests"] = tests
        break

with open(TOPICS, "w", encoding="utf-8") as f:
    json.dump(topics, f, indent=2, ensure_ascii=False)

print("Created files:")
for name, cnt in created:
    print(f" - {name}: {cnt} questions")
print("topics.json updated.")
