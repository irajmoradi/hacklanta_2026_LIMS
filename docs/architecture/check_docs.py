"""Check DOCS-012 Markdown targets and README size without network access."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote

root = Path(__file__).resolve().parents[2]
files = [root / 'README.md', root / 'docs/ARCHITECTURE.md',
         root / 'docs/security/REPO-AUDIT.md', root / 'docs/architecture/VALIDATION.md',
         *sorted((root / '.github').rglob('*.md'))]
errors = []
links = 0
for file in files:
    if not file.exists():
        errors.append(f'Missing {file.relative_to(root)}')
        continue
    source = file.read_text(encoding='utf-8-sig')
    if source.count('```') % 2:
        errors.append(f'Unclosed fence: {file.relative_to(root)}')
    text = re.sub(r'```[\s\S]*?```', '', source)
    for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
        target = target.strip().strip('<>')
        if re.match(r'[a-z]+:', target):
            continue
        path, _, anchor = unquote(target).partition('#')
        resolved = (file.parent / path).resolve() if path else file
        links += 1
        if not resolved.exists():
            errors.append(f'{file.relative_to(root)}: missing {target}')
        elif anchor and resolved.suffix == '.md':
            headings = re.findall(r'^#+\s+(.+)$', resolved.read_text(encoding='utf-8-sig'), re.M)
            slugs = [re.sub(r'[^\w\- ]', '', h.lower()).replace(' ', '-') for h in headings]
            if anchor not in slugs:
                errors.append(f'{file.relative_to(root)}: missing anchor {target}')
readme = (root / 'README.md').read_text(encoding='utf-8-sig')
words = len(readme.split())
if not 1500 <= words <= 2200:
    errors.append(f'README size {words} outside 1500–2200 words (including code/diagrams)')
diagrams = re.findall(r'```mermaid\s+([\s\S]*?)```', readme)
if len(diagrams) != 3:
    errors.append(f'Expected 3 diagrams, found {len(diagrams)}')
for error in errors:
    print(error)
print(f'{len(files)} Markdown files; {links} relative links; {words} README words; {len(diagrams)} diagrams; {len(errors)} errors')
sys.exit(bool(errors))
