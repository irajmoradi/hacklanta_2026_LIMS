"""Tiny static server for head previews: /render/* -> this dir, /data/* -> VILLAGE_DATA_DIR, /models/* -> web models.
  python workers/gpu/render/serve.py [port]"""
import http.server, os, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DATA = Path(os.environ.get("VILLAGE_DATA_DIR", r"C:\Users\mourn\Downloads\hacklanta\data" if os.name == "nt" else ROOT / "data"))
MODELS = Path(os.environ.get("VILLAGE_MODELS_DIR", ROOT / "apps/web/public/models"))
MOUNTS = {"/render/": HERE, "/data/": DATA, "/models/": MODELS}

class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split("?")[0]
        for pre, base in MOUNTS.items():
            if path.startswith(pre):
                p = (base / path[len(pre):]).resolve()
                if p.is_relative_to(base.resolve()):
                    return str(p)
        return str(HERE / "__nope__")
    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8765), H).serve_forever()
