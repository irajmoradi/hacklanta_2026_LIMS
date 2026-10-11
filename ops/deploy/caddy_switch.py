"""Replace precisely the known live site, retaining every byte outside it."""
import re
import sys
from pathlib import Path

def candidate(text):
    # Refuse unfamiliar layouts rather than guessing at nested Caddy directives.
    pattern = r'(?ms)^207-246-81-187\.sslip\.io \{\n.*?^\}'
    matches = list(re.finditer(pattern, text))
    if len(matches) != 1:
        raise ValueError('Expected one known live site block')
    block = matches[0].group()
    if block.count('{') != block.count('}') or sorted(re.findall(r'reverse_proxy\s+(\S+)', block)) != ['127.0.0.1:8080', '127.0.0.1:8090']:
        raise ValueError('Unexpected live routes; inspect before switching')
    return text[:matches[0].start()] + '207-246-81-187.sslip.io {\n  encode gzip\n  reverse_proxy 127.0.0.1:8082\n}' + text[matches[0].end():]

if __name__ == '__main__':
    Path(sys.argv[2]).write_text(candidate(Path(sys.argv[1]).read_text()))
