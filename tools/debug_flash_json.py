import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "flashcards" / "flashcards-2.json"

s = TARGET.read_text(encoding='utf-8')
try:
    json.loads(s)
    print('JSON OK')
except json.JSONDecodeError as e:
    print('JSON error:', e)
    pos = e.pos
    start = max(0, pos-200)
    end = min(len(s), pos+200)
    context = s[start:end]
    print('\n--- context around error ---\n')
    print(context)
    print('\n--- end context ---')
