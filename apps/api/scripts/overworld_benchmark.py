"""Pure reducer benchmark: synthetic villagers, no DB, network or providers."""
import json
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.overworld import World

w = World(1337, [dict(user_id=str(i), house_slot=i, idle_activity=['studying','reading','dancing','working_out','gaming'][i%5]) for i in range(100)])
w.world = dict(level=100, unlocked=[l['entry']['id'] for l in w.buildings.values() if 'entry' in l])
elapsed, sizes, changes = [], [], []
for tick in range(600):
    start = time.perf_counter()
    delta = w.tick(1000.+tick)
    elapsed.append(time.perf_counter()-start)
    sizes.append(len(json.dumps(delta)))
    changes.append(len(delta))
print(json.dumps(dict(villagers=100,ticks=600,mean_tick_ms=1000*sum(elapsed)/600,
                     max_tick_ms=1000*max(elapsed),mean_delta_bytes=sum(sizes)/600,
                     max_delta_bytes=max(sizes),mean_changed_avatars=sum(changes)/600), indent=2))
