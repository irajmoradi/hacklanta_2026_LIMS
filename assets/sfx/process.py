"""Offline processing and independent delivery checks; never calls ElevenLabs."""
import argparse
import hashlib
import json
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "apps/web/public/sfx"
RATE = 44100


def tool(name):
    found = shutil.which(name)
    if found:
        return found
    found = list((HERE / ".tools").rglob(name + ".exe"))
    if not found:
        raise SystemExit(f"Install {name} on PATH or under assets/sfx/.tools.")
    return str(found[0])


def run(args, data=None):
    result = subprocess.run(args, input=data, capture_output=True, check=True)
    return result.stdout


def decode(ffmpeg, path):
    return np.frombuffer(run([ffmpeg, "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(RATE),
                              "-f", "f32le", "pipe:1"]), dtype="<f4").copy()


def db(value):
    return round(20 * math.log10(max(float(value), 1e-12)), 3)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    ffmpeg, ffprobe = tool("ffmpeg"), tool("ffprobe")
    pack = json.loads((HERE / "pack.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    processing = {}
    if not args.verify_only:
        manifest = []
        for item in pack:
            name, loop = item["name"], item.get("loop", False)
            samples = decode(ffmpeg, HERE / "raw" / (name + ".mp3"))
            original_length = len(samples)
            samples -= np.mean(samples)
            if loop:
                # Blend tail into head, preserving a continuous periodic signal.
                overlap = int(0.12 * RATE)
                t = np.linspace(0, 1, overlap, dtype=np.float32)
                bridge = samples[-overlap:] * (1 - t) + samples[:overlap] * t
                samples = np.concatenate((samples[overlap:-overlap], bridge))
            else:
                # Relative -45 dB amplitude gate, with 8 ms of breathing room.
                active = np.flatnonzero(np.abs(samples) > np.max(np.abs(samples)) * 10 ** (-45 / 20))
                if not len(active):
                    raise ValueError(f"Silent generation: {name}")
                pad = int(0.008 * RATE)
                samples = samples[max(0, active[0] - pad):min(len(samples), active[-1] + pad + 1)]
                # Preserve minimum UI duration even if the source is a tiny impulse.
                if len(samples) < int(0.3 * RATE):
                    samples = np.pad(samples, (0, int(0.3 * RATE) - len(samples)))
                fade = min(int(0.005 * RATE), len(samples) // 2)
                samples[:fade] *= np.linspace(0, 1, fade)
                samples[-fade:] *= np.linspace(1, 0, fade)
            rms = np.sqrt(np.mean(samples.astype(np.float64) ** 2))
            peak = np.max(np.abs(samples))
            # Common -20 dBFS RMS target; -3 dBFS peak ceiling avoids harsh limiting.
            gain = min(10 ** (-20 / 20) / rms, 10 ** (-3 / 20) / peak)
            samples = (samples * gain).astype("<f4")
            processing[name] = {"source_samples": original_length, "processed_samples": len(samples),
                                "gain_db": db(gain), "peak_constrained": bool(gain < 0.1 / rms)}
            for extension, codec in [("mp3", ["-c:a", "libmp3lame", "-b:a", "128k"]),
                                     ("ogg", ["-c:a", "libvorbis", "-q:a", "5"])]:
                run([ffmpeg, "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE), "-ac", "1",
                     "-i", "pipe:0", "-map_metadata", "-1", *codec, str(OUT / f"{name}.{extension}")],
                    samples.tobytes())
            manifest.append({"name": name, "file": f"/sfx/{name}.mp3",
                             "duration_ms": round(len(samples) / RATE * 1000), "loop": loop,
                             "volume": item["volume"], "description": item["description"]})
        (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        (HERE / "processing.json").write_text(json.dumps(processing, indent=2) + "\n", encoding="utf-8")

    manifest = json.loads((OUT / "manifest.json").read_text())
    assert len(manifest) == 18 and {m["name"] for m in manifest} == {p["name"] for p in pack}
    calls = [json.loads(line) for line in (HERE / "calls.jsonl").read_text().splitlines()]
    assert len(calls) <= 18 and len({c["name"] for c in calls}) == len(calls)
    assert all(c["status"] == "ok" for c in calls)
    report = []
    audition = []
    audition_index = []
    audition_samples = 0
    for item in manifest:
        assert set(item) == {"name", "file", "duration_ms", "loop", "volume", "description"}
        assert 0 < item["volume"] <= 1
        assert item["file"] == f"/sfx/{item['name']}.mp3"
        decoded = []
        for extension in ["mp3", "ogg"]:
            path = OUT / f"{item['name']}.{extension}"
            probe = json.loads(run([ffprobe, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))
            samples = decode(ffmpeg, path)
            decoder_padding = 0
            if extension == "ogg":
                # Honor Vorbis's exact end granule. Some FFmpeg builds emit an
                # extra partial block despite its discard-padding packet metadata.
                expected = int(probe["streams"][0]["duration_ts"])
                decoder_padding = len(samples) - expected
                assert -128 <= decoder_padding <= 1024, (path, decoder_padding)
                if decoder_padding > 0:
                    assert db(np.max(np.abs(samples[expected:]))) < -45, (path, "audible codec padding")
                    samples = samples[:expected]
            decoded.append(samples)
            seconds = len(samples) / RATE
            peak = db(np.max(np.abs(samples)))
            rms = db(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
            assert np.all(np.isfinite(samples)) and peak < -1, (path, peak)
            assert -33 < rms < -17, (path, rms)
            assert (4 <= seconds <= 6) if item["loop"] else (0.299 <= seconds <= 2.5), (path, seconds)
            assert abs(seconds * 1000 - item["duration_ms"]) < 15, (path, seconds)
            assert probe["streams"][0]["sample_rate"] == str(RATE)
            assert probe["streams"][0]["codec_name"] == ("mp3" if extension == "mp3" else "vorbis")
            row = {"file": path.name, "codec": probe["streams"][0]["codec_name"],
                   "ffprobe_duration_ms": round(float(probe["format"]["duration"]) * 1000, 3),
                   "decoded_duration_ms": round(seconds * 1000, 3), "sample_peak_dbfs": peak,
                   "decoder_samples_minus_end_granule": decoder_padding,
                   "rms_dbfs": rms, "bytes": path.stat().st_size,
                   "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            if item["loop"]:
                boundary = abs(float(samples[0] - samples[-1]))
                typical = float(np.quantile(np.abs(np.diff(samples)), 0.99))
                row["loop_boundary_step_dbfs"] = db(boundary)
                row["loop_boundary_step_vs_p99"] = round(boundary / max(typical, 1e-9), 3)
                assert boundary < max(0.01, typical * 2), (path, "loop boundary", row)
            report.append(row)
        common = min(map(len, decoded))
        assert np.corrcoef(decoded[0][:common], decoded[1][:common])[0, 1] > 0.9, item["name"]
        audition_index.append({"name": item["name"], "start_seconds": round(audition_samples / RATE, 3),
                               "repetitions": 2 if item["loop"] else 1})
        # Decode OGG to preserve gapless timing; loop twice so the seam is audible.
        clip = np.tile(decoded[1], 2 if item["loop"] else 1) * item["volume"]
        silence = np.zeros(int(RATE * 0.6), dtype=np.float32)
        audition.extend([clip, silence])
        audition_samples += len(clip) + len(silence)
    (HERE / "qa.json").write_text(json.dumps({"api_calls": len(calls), "file_count": len(report),
        "sample_rate": RATE, "normalization": "-20 dBFS RMS, -3 dBFS pre-encode peak ceiling",
        "ffmpeg": run([ffmpeg, "-version"]).decode().splitlines()[0], "files": report}, indent=2) + "\n", encoding="utf-8")
    if not args.verify_only:
        run([ffmpeg, "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE), "-ac", "1",
             "-i", "pipe:0", "-map_metadata", "-1", "-c:a", "libmp3lame", "-b:a", "128k",
             str(HERE / "audition.mp3")], np.concatenate(audition).astype("<f4").tobytes())
        (HERE / "audition.json").write_text(json.dumps(audition_index, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: {len(report)} files, 18 manifest entries, {len(calls)}/18 API calls; durations, peaks, RMS, codecs, loop seams, format correlation.")


if __name__ == "__main__":
    main()
