"""Record wall time and sampled local process-tree RSS; no environment logging."""
import argparse
import json
from pathlib import Path
import subprocess
import time

import psutil

parser = argparse.ArgumentParser()
parser.add_argument('--label', required=True)
parser.add_argument('--cwd', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('command', nargs=argparse.REMAINDER)
args = parser.parse_args()
command = args.command[1:] if args.command[:1] == ['--'] else args.command
started = time.monotonic()
proc = subprocess.Popen(command, cwd=args.cwd)
peak = 0
while proc.poll() is None:
    try:
        parent = psutil.Process(proc.pid)
        rss = 0
        for child in [parent, *parent.children(recursive=True)]:
            try:
                rss += child.memory_info().rss
            except psutil.Error:
                pass
        peak = max(peak, rss)
    except psutil.Error:
        pass
    time.sleep(.1)
result = dict(label=args.label, command=command, exit_code=proc.returncode,
              seconds=round(time.monotonic()-started, 2), peak_local_rss_mib=round(peak/2**20, 1))
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
with output.open('a') as stream:
    stream.write(json.dumps(result) + '\n')
print(json.dumps(result), flush=True)
raise SystemExit(proc.returncode)
