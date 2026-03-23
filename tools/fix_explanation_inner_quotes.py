from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "flashcards" / "flashcards-2.json"

s = TARGET.read_text(encoding='utf-8')
old = 'except "Needing written documentation of claim details".'
new = "except 'Needing written documentation of claim details'."
if old in s:
    s = s.replace(old, new)
    TARGET.write_text(s, encoding='utf-8')
    print('Fixed inner explanation quotes.')
else:
    print('Pattern not found; no change.')
