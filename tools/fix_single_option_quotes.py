from pathlib import Path
p = Path(r"c:\Users\C6475\Desktop\Ehtics MCQS\data\flashcards\flashcards-2.json")
s = p.read_text(encoding='utf-8')
old = "'Needing written documentation of claim details'"
new = '"Needing written documentation of claim details"'
if old in s:
    s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')
    print('Replaced single-quoted option.')
else:
    print('Target substring not found; no change made.')
