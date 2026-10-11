"""Summarize the balanced, frozen-scene before/after performance samples."""
import json
from pathlib import Path

artifacts = Path(__file__).resolve().parents[1] / 'artifacts/web050'
results = []
for seed in (1337, 42, 19, 24109):
    for row in json.loads((artifacts / f'paired-{seed}-performance.json').read_text()):
        a, b = row['before'], row['after']
        settings = {(s['dpr'], s['shadows']) for s in row['samples']}
        results.append(dict(seed=seed, view=row['view'],
            before_calls=a['calls'], after_calls=b['calls'],
            before_fps=round(a['fps'], 3), after_fps=round(b['fps'], 3),
            calls_change_percent=round((b['calls']/a['calls']-1)*100, 2),
            fps_change_percent=round((b['fps']/a['fps']-1)*100, 2),
            passed=b['calls'] <= a['calls']*1.05 and b['fps'] >= a['fps']*.95 and len(settings)==1))
print(json.dumps(results, indent=2))
(artifacts/'paired-comparison.json').write_text(json.dumps(results, indent=2))
raise SystemExit(0 if all(r['passed'] for r in results) else 1)
