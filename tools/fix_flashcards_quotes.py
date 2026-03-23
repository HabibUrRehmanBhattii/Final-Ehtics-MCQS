from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "flashcards" / "flashcards-2.json"

s = TARGET.read_text(encoding='utf-8')
# Replace known problematic inner double-quotes with single quotes
s = s.replace('\"Needing written documentation of claim details\"', "'Needing written documentation of claim details'")
# Also replace other occurrences of smart problematic sequences: double quote followed by a phrase and closing double quote inside a sentence
# Common pattern: ... except "Some text"
import re
s = re.sub(r'except\s+"([^"]+)"', lambda m: "except '"+m.group(1)+"'", s)
TARGET.write_text(s, encoding='utf-8')
print('Fixed and wrote', TARGET)
