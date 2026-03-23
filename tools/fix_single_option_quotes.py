from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "flashcards" / "flashcards-2.json"

s = TARGET.read_text(encoding='utf-8')
old = "'Needing written documentation of claim details'"
new = '"Needing written documentation of claim details"'
if old in s:
    s = s.replace(old, new)
    TARGET.write_text(s, encoding='utf-8')
    print('Replaced single-quoted option.')
else:
    print('Target substring not found; no change made.')
