"""Read every reachable Git blob; emit locations/categories, never matched values.

Heuristic triage, not a proof of absence. No checkout, network, or history edits.
Run: python docs/architecture/audit_history.py
"""
import collections
import io
import json
import os
import re
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def main():
    refs = sorted(set(git("for-each-ref", "--format=%(objectname)").decode().splitlines()
                      + [git("rev-parse", "HEAD").decode().strip()]))
    objects = {}
    for line in git("rev-list", "--objects", *refs).decode().splitlines():
        oid, _, path = line.partition(" ")
        objects[oid] = path
    patterns = {
        "private-key": rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
        "provider-token": rb"(?:AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{35,}|sk-(?:proj-|or-v1-)?[0-9A-Za-z_-]{24,}|xox[baprs]-[0-9A-Za-z-]{20,}|AKIA[A-Z0-9]{16})",
        "credential-url": rb"[a-zA-Z][a-zA-Z0-9+.-]*://[^\s/:\"'<>]+:[^\s/@\"'<>]{4,}@",
        "assigned-secret": rb"(?im)^\s*[\"']?(?:[A-Z0-9_]*(?:API_KEY|SECRET|PASSWORD|ACCESS_TOKEN|SERVICE_KEY|GPU_KEY|PRIVATE_KEY))[\"']?\s*[:=]\s*[\"']?([^\s\"',;#]{12,})",
        "jwt": rb"eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}",
        "email": rb"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        "phone": rb"(?<![\w])\+1[ .(-]*\d{3}[ .)-]*\d{3}[ .-]*\d{4}(?!\d)",
    }
    compiled = {k: re.compile(v) for k, v in patterns.items()}
    # Compare configured secrets in memory only, including tokens without known prefixes.
    private = os.environ.get("VILLAGE_ENV_FILE", "")
    if os.name == "nt" and re.match(r"^/[A-Za-z]/", private):
        private = private[1] + ":" + private[2:]
    known = {}
    if private:
        for line in Path(private).read_text(encoding="utf-8-sig").splitlines():
            name, sep, value = line.partition("=")
            name, value = name.strip(), value.strip().strip("\"'")
            if sep and re.search(r"KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL", name) and len(value) >= 12:
                known[name] = value.encode()
    batch = subprocess.Popen(["git", "cat-file", "--batch"], cwd=ROOT,
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    hits, media, large, envfiles = [], [], [], []
    counts = collections.Counter()
    def scan(data, item):
        for kind, pattern in compiled.items():
            matches = list(pattern.finditer(data))
            if matches:
                hits.append({**item, "kind": kind, "count": len(matches),
                             "lines": sorted({data.count(b"\n", 0, m.start()) + 1 for m in matches})[:40]})
        for name, value in known.items():
            if value in data:
                hits.append({**item, "kind": "known-secret:" + name, "count": data.count(value)})
    extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm", ".mov", ".wav", ".mp3", ".m4a", ".ogg", ".glb", ".gltf", ".ply", ".zip", ".pdf", ".pt", ".pth", ".safetensors", ".onnx"}
    for oid, path in objects.items():
        batch.stdin.write((oid + "\n").encode())
        batch.stdin.flush()
        head = batch.stdout.readline().decode().split()
        size = int(head[2])
        data = batch.stdout.read(size)
        batch.stdout.read(1)
        if head[1] != "blob":
            continue
        counts["blobs"] += 1
        counts["bytes"] += size
        item = {"blob": oid, "path": path, "bytes": size}
        if size >= 5 * 1024 * 1024:
            large.append(item)
        if Path(path).suffix.lower() in extensions:
            media.append(item)
        if re.search(r"(?:^|/)(?:\.env(?:\..*)?|[^/]*\.(?:pem|key)|id_rsa|id_ed25519)$", path):
            envfiles.append(item)
        # Scan binary bytes too; no size cutoff. Values never enter output.
        scan(data, item)
        if data.startswith(b"PK\x03\x04"):
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                for entry in archive.infolist():
                    if not entry.is_dir():
                        counts["archive_members"] += 1
                        scan(archive.read(entry), {**item, "member": entry.filename})
    batch.stdin.close()
    batch.wait()
    # Identity metadata is also published by Git; report counts only.
    authors = git("log", "--format=%ae%n%ce", *refs).decode().splitlines()
    scan(git("log", "--format=%B", *refs), {"path": "<commit messages>", "blob": "metadata"})
    result = {"base": git("rev-parse", "HEAD").decode().strip(),
              "refs": refs, "commits": int(git("rev-list", "--count", *refs)),
              "known_secret_names_checked": sorted(known),
              "objects": len(objects), **counts,
              "metadata_email_identities": len(set(authors)),
              "findings": hits, "sensitive_paths": envfiles,
              "media": media, "large": large}
    output = ROOT / "docs/architecture/history-inventory.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k not in {"findings", "media", "large", "sensitive_paths", "refs"}}))
    print("Candidate categories:", dict(collections.Counter(x["kind"] for x in hits)))
    print("Media versions:", len(media), "large blobs:", len(large), "sensitive paths:", len(envfiles))


if __name__ == "__main__":
    main()
