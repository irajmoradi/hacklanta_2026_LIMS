"""Explicit, budget-capped generation. Never retries a paid request, even on failure."""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

HERE = Path(__file__).resolve().parent
STYLE = "Cozy cute virtual-pet village game sound effect; warm rounded toy-like timbre, playful gentle humor, clean close sound, no harsh transients, no music bed, no intelligible speech. "


def read_key():
    value = os.environ.get("ELEVENLABS_API_KEY")
    if value:
        return value
    path = os.environ.get("VILLAGE_ENV_FILE")
    if not path:
        raise SystemExit("Set VILLAGE_ENV_FILE or ELEVENLABS_API_KEY; no request sent.")
    if os.name == "nt" and path.startswith("/c/"):
        path = "C:/" + path[3:]
    # Parse just the needed dotenv entry; never print or persist its value.
    from dotenv import dotenv_values
    value = dotenv_values(path).get("ELEVENLABS_API_KEY")
    if not value:
        raise SystemExit("ELEVENLABS_API_KEY is missing; no request sent.")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generate", action="store_true", help="Authorize remaining paid requests (18 lifetime maximum).")
    args = parser.parse_args()
    pack = json.loads((HERE / "pack.json").read_text())
    if not args.generate:
        print("Dry run: 18 planned sounds. Use --generate to make paid requests.")
        return
    key = read_key()
    lock = HERE / ".generation.lock"
    # A crash leaves the lock for manual investigation rather than risking extra charges.
    with lock.open("x") as handle:
        handle.write(str(os.getpid()))
    try:
        log = HERE / "calls.jsonl"
        calls = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
        raw = HERE / "raw"
        raw.mkdir(exist_ok=True)
        for entry in pack:
            if any(call["name"] == entry["name"] for call in calls):
                continue
            if len(calls) >= 18:
                raise SystemExit("18-call lifetime budget exhausted.")
            body = {"text": STYLE + entry["sound"], "duration_seconds": entry["duration"],
                    "loop": entry.get("loop", False), "prompt_influence": 0.65,
                    "model_id": "eleven_text_to_sound_v2"}
            call = {"call": len(calls) + 1, "name": entry["name"],
                    "requested_at": datetime.now(timezone.utc).isoformat(), **body, "status": "reserved"}
            calls.append(call)
            # Reserve BEFORE network access, counting ambiguous failures toward the budget.
            def save():
                with log.open("w", encoding="utf-8", newline="\n") as handle:
                    handle.write("".join(json.dumps(c) + "\n" for c in calls))
                    handle.flush()
                    os.fsync(handle.fileno())
            save()
            request = Request("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
                              data=json.dumps(body).encode(),
                              headers={"xi-api-key": key, "Content-Type": "application/json"}, method="POST")
            try:
                with urlopen(request, timeout=180) as response:
                    audio = response.read()
                    call["http_status"] = response.status
                    call["character_cost"] = response.headers.get("character-cost")
                if len(audio) < 512:
                    raise ValueError("Audio response too short")
                (raw / (entry["name"] + ".mp3")).write_bytes(audio)
                call.update(status="ok", bytes=len(audio))
            except Exception as exc:
                call["status"] = "failed"
                call["error_type"] = type(exc).__name__
                if isinstance(exc, HTTPError):
                    call["http_status"] = exc.code
                save()
                raise SystemExit(f"Request {len(calls)} failed ({call['error_type']}); no retry. See calls.jsonl.") from None
            save()
            print(f"{len(calls)}/18 {entry['name']}: saved", flush=True)
    finally:
        lock.unlink()


if __name__ == "__main__":
    main()
