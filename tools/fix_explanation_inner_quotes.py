from pathlib import Path
p = Path(r"c:\Users\C6475\Desktop\Ehtics MCQS\data\flashcards\flashcards-2.json")
s = p.read_text(encoding='utf-8')
old = 'except "Needing written documentation of claim details".'
new = "except 'Needing written documentation of claim details'."
if old in s:
    s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')
    print('Fixed inner explanation quotes.')
else:
    print('Pattern not found; no change.')
