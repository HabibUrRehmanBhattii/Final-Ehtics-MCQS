import json
from pathlib import Path
p = Path(r"c:\Users\C6475\Desktop\Ehtics MCQS\data\flashcards\flashcards-2.json")
s = p.read_text(encoding='utf-8')
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
