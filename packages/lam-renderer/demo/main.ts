// Two modes:
//   default            sample_palm head + ElevenLabs line expr/mp3 from /local-assets (no auth)
//   ?uid=<uuid>&line=<line_id>   a real Village user via the API: manifest -> head_package_url, with X-Demo-User
import { fetchJson, fetchObjectUrl, mountLamHead, type ExprData } from "../src/index";

const q = new URLSearchParams(location.search);
const statusEl = document.getElementById("status")!;
const btn = document.getElementById("play") as HTMLButtonElement;
const audio = document.getElementById("audio") as HTMLAudioElement;
const setStatus = (s: string) => (statusEl.textContent = s);
(window as any).__lam = { state: "loading" };

const DEV = "13370000-0000-4000-8000-000000000005";
const DEV_LINE = "846fdc9a-b924-4991-a371-ea9155741779";

async function main() {
  const t0 = performance.now();
  let packageUrl: string, exprUrl: string, mp3Url: string, headers: Record<string, string> | undefined;
  const uid = q.get("uid");
  if (uid) {
    headers = { "X-Demo-User": q.get("as") ?? uid };
    const m = await fetchJson<any>(`/api/avatars/${uid}`, headers);
    if (m.portrait?.kind !== "lam_head") throw new Error(`no LAM head yet (portrait=${m.portrait?.kind})`);
    packageUrl = m.portrait.head_package_url;
    const line = q.get("line") ?? DEV_LINE;
    exprUrl = `/api/assets/avatars/${uid}/voice/${line}/line_expr.json`;
    mp3Url = `/api/assets/voice/${uid}/${line}.mp3`;
  } else {
    packageUrl = q.get("pkg") ?? "/local-assets/avatars/sample_palm/head/avatar.zip";
    exprUrl = "/local-assets/avatars/sample_palm/voice/dev_line1/line_expr.json";
    mp3Url = `/local-assets/voice/${DEV}/${DEV_LINE}.mp3`;
  }
  const [expr, src] = await Promise.all([fetchJson<ExprData>(exprUrl, headers), fetchObjectUrl(mp3Url, headers)]);
  audio.src = src;
  const head = await mountLamHead(document.getElementById("head")!, {
    packageUrl, expr, audio, headers,
    onProgress: (p) => { if ((window as any).__lam.state === "loading") setStatus(`loading ${Math.round(p * 100)}%`); },
  });
  const loadMs = Math.round(performance.now() - t0);
  setStatus(`ready in ${loadMs} ms · ${expr.frames.length} expr frames`);
  (window as any).__lam = { state: "ready", loadMs, head, audio };
  btn.disabled = false;
  btn.onclick = () => { audio.currentTime = 0; audio.play(); };
  audio.onplay = () => setStatus("speaking…");
  audio.onended = () => setStatus("idle");
}

main().catch((e) => { console.error(e); setStatus(`error: ${e.message}`); (window as any).__lam = { state: "error", error: String(e) }; });
