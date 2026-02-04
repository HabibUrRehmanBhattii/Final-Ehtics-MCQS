from pathlib import Path
p = Path(r"c:\Users\C6475\Desktop\Ehtics MCQS\data\flashcards\flashcards-2.json")
s = p.read_text(encoding='utf-8')
# Replace known problematic inner double-quotes with single quotes
s = s.replace('\"Needing written documentation of claim details\"', "'Needing written documentation of claim details'")
# Also replace other occurrences of smart problematic sequences: double quote followed by a phrase and closing double quote inside a sentence
# Common pattern: ... except "Some text"
import re
s = re.sub(r'except\s+"([^"]+)"', lambda m: "except '"+m.group(1)+"'", s)
p.write_text(s, encoding='utf-8')
print('Fixed and wrote', p)
