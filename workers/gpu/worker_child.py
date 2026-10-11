"""Per-model child process for server.py. Runs inside the model's own conda env.

  python worker_child.py segment|head|expr|body
Protocol: one JSON request per stdin line -> one JSON response per line on the ORIGINAL stdout.
Library prints are redirected to stderr so they can't corrupt the protocol.
The model is loaded lazily on the first request and then stays resident until the parent kills us.
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(WORKER_DIR))

_proto = os.fdopen(os.dup(1), "w", buffering=1)
os.dup2(2, 1)
sys.stdout = sys.stderr


def build(kind: str):
    if kind == "segment":
        from segment import Segmenter
        import items
        m = Segmenter()

        def seg_fn(req):
            op = req.get("op", "segment")
            if op == "outfit":
                return items.outfit(m, req["image"], req["out"], req.get("slot", "torso"), req.get("prompt"))
            if op == "object_cutout":
                return items.object_cutout(m, req["image"], req["out"], req.get("prompt"))
            return m.run(req["image"], req["out"])
        return seg_fn
    if kind == "head":
        from head import HeadBuilder
        from talk import TalkRenderer
        m = HeadBuilder()
        talk = TalkRenderer(m)

        def head_fn(req):
            if req.get("op") == "talk":
                return talk.run(req["face"], req["expr_json"], req["audio"], req["out"], req.get("max_seconds", 15))
            return m.run(req["face"], req["out"], motion=req.get("motion") or "Look_In_My_Eyes",
                         export=req.get("export", True))
        return head_fn
    if kind == "body":
        from body import BodyBuilder
        m = BodyBuilder()
        return lambda req: (m.object(req["image"], req["out"], req.get("max_faces", 3000)) if req.get("op") == "object"
                            else m.run(req["face"], req["out"], req.get("traits")))
    if kind == "expr":
        from expr import ExprModel
        m = ExprModel()
        return lambda req: m.run(req["wav"], req["out"])
    raise SystemExit(f"unknown kind {kind}")


def main() -> None:
    kind = sys.argv[1]
    fn = None
    _proto.write(json.dumps({"ready": True, "kind": kind, "pid": os.getpid()}) + "\n")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            if fn is None:
                fn = build(kind)
            res = fn(req)
            _proto.write(json.dumps({"ok": True, "result": res}) + "\n")
        except Exception as e:  # report and keep serving
            _proto.write(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}",
                                     "trace": traceback.format_exc()[-3000:]}) + "\n")


if __name__ == "__main__":
    main()
