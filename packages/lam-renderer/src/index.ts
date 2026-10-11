/**
 * @village/lam-renderer — mount a LAM Gaussian talking head in the browser.
 *
 * Wraps the official LAM WebGL renderer (`gaussian-splat-renderer-for-lam`, MIT, aigc3d/LAM_WebRender,
 * itself built on mkkellogg/GaussianSplats3D, MIT). It loads the LAM avatar.zip export
 * (<dir>/skin.glb + offset.ply + animation.glb + vertex_order.json) and drives it with:
 *   - idle: renderer's own idle body clip (animation.glb) + our procedural blinks / micro-expression
 *   - speaking: LAM Audio2Expression ARKit-52 frames stepped by `audio.currentTime` (30 fps)
 *
 * Limitations inherited from the upstream renderer: it is a singleton (one head per page at a time) and it
 * downloads the zip itself with its own HTTP client; we inject auth headers for that one request.
 */
import * as GS from "gaussian-splat-renderer-for-lam";

export type ExprData = {
  names: string[];
  metadata?: { fps?: number; frame_count?: number };
  frames: { weights: number[]; time?: number }[];
};

export type MountOptions = {
  /** URL of the LAM avatar package zip. Its path must end in `<name>.zip` (upstream requirement). */
  packageUrl: string;
  /** URL of an Audio2Expression line_expr.json (or pass `expr` directly). */
  exprUrl?: string;
  expr?: ExprData;
  /** When this element is playing, expression frames follow audio.currentTime. */
  audio?: HTMLAudioElement;
  /** Extra headers for package/expr requests, e.g. {"X-Demo-User": uid} for the Village API. */
  headers?: Record<string, string>;
  /** "0xRRGGBB" background (upstream format). Default white. */
  backgroundColor?: string;
  /** Background opacity 0..1 (upstream). Default 1. NOTE: upstream treats 0/undefined as fully transparent. */
  alpha?: number;
  /** Head framing: camera height/distance in avatar units, looking straight at the face.
   *  Default {y: 1.66, z: 0.62} fills a square canvas with the head; upstream default is {y: 1.8, z: 1}. */
  camera?: { y: number; z: number };
  /** Called with 0..1 while the zip downloads/loads. */
  onProgress?: (p: number) => void;
};

export type LamHead = {
  /** Swap the expression track (e.g. a new voice line). */
  setExpr: (expr: ExprData | null) => void;
  /** Point at a different audio element. */
  setAudio: (audio: HTMLAudioElement | null) => void;
  /** "Idle" | "Responding" — what the renderer is currently being told. */
  state: () => string;
  /** underlying upstream GaussianSplatRenderer (debugging) */
  _renderer: unknown;
  dispose: () => void;
};

const ZERO = (names: string[]) => Object.fromEntries(names.map((n) => [n, 0]));
const DEFAULT_NAMES = [
  "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight", "cheekPuff",
  "cheekSquintLeft", "cheekSquintRight", "eyeBlinkLeft", "eyeBlinkRight", "eyeLookDownLeft", "eyeLookDownRight",
  "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft", "eyeLookOutRight", "eyeLookUpLeft", "eyeLookUpRight",
  "eyeSquintLeft", "eyeSquintRight", "eyeWideLeft", "eyeWideRight", "jawForward", "jawLeft", "jawOpen",
  "jawRight", "mouthClose", "mouthDimpleLeft", "mouthDimpleRight", "mouthFrownLeft", "mouthFrownRight",
  "mouthFunnel", "mouthLeft", "mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft", "mouthPressRight",
  "mouthPucker", "mouthRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper",
  "mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight", "mouthUpperUpLeft",
  "mouthUpperUpRight", "noseSneerLeft", "noseSneerRight", "tongueOut",
];

/** Fetch with headers and return parsed JSON. */
export async function fetchJson<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return (await r.json()) as T;
}

/** Fetch an authenticated asset (e.g. an mp3 behind /api/assets) and return an object URL for <audio src>. */
export async function fetchObjectUrl(url: string, headers?: Record<string, string>): Promise<string> {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return URL.createObjectURL(await r.blob());
}

/** Inject headers into XHRs whose URL matches `url` (upstream renderer uses its own bundled axios/XHR). */
function withXhrHeaders<T>(url: string, headers: Record<string, string> | undefined, fn: () => Promise<T>) {
  if (!headers || !Object.keys(headers).length) return fn();
  const proto = XMLHttpRequest.prototype;
  const open = proto.open;
  const send = proto.send;
  const target = new URL(url, location.href).href;
  proto.open = function (this: XMLHttpRequest & { __lamAuth?: boolean }, ...args: any[]) {
    this.__lamAuth = new URL(String(args[1]), location.href).href === target;
    return (open as any).apply(this, args);
  } as any;
  proto.send = function (this: XMLHttpRequest & { __lamAuth?: boolean }, body?: any) {
    if (this.__lamAuth) for (const [k, v] of Object.entries(headers)) this.setRequestHeader(k, v);
    return send.call(this, body);
  };
  return fn().finally(() => {
    proto.open = open;
    proto.send = send;
  });
}

/** Procedural idle face: blinks every 2.5–5 s, slight brow/smile drift, gentle eye wander. */
function idleFrame(t: number, names: string[], blink: { next: number; start: number }) {
  const out: Record<string, number> = ZERO(names);
  if (t > blink.next) {
    blink.start = t;
    blink.next = t + 2.5 + Math.random() * 2.5;
  }
  const bt = (t - blink.start) / 0.16; // 160 ms blink
  const b = bt >= 0 && bt <= 1 ? Math.sin(Math.PI * bt) : 0;
  out.eyeBlinkLeft = out.eyeBlinkRight = b;
  out.mouthSmileLeft = out.mouthSmileRight = 0.08 + 0.04 * Math.sin(t * 0.35);
  out.browInnerUp = 0.05 + 0.05 * Math.sin(t * 0.21 + 1);
  const look = Math.sin(t * 0.17) * 0.15;
  out.eyeLookOutLeft = out.eyeLookInRight = Math.max(0, look);
  out.eyeLookInLeft = out.eyeLookOutRight = Math.max(0, -look);
  return out;
}

export async function mountLamHead(container: HTMLElement, opts: MountOptions): Promise<LamHead> {
  let expr: ExprData | null = opts.expr ?? null;
  if (!expr && opts.exprUrl) expr = await fetchJson<ExprData>(opts.exprUrl, opts.headers);
  let audio: HTMLAudioElement | null = opts.audio ?? null;
  const blink = { next: 1.5, start: -1 };
  const t0 = performance.now() / 1000;
  let state = "Idle";

  const speaking = () => !!audio && !audio.paused && !audio.ended && audio.currentTime > 0;

  const getChatState = () => (state = speaking() ? "Responding" : "Idle");
  const getExpressionData = () => {
    const names = expr?.names ?? DEFAULT_NAMES;
    if (expr && speaking()) {
      const fps = expr.metadata?.fps ?? 30;
      const i = Math.min(expr.frames.length - 1, Math.floor(audio!.currentTime * fps));
      const w = expr.frames[i]?.weights ?? [];
      const out: Record<string, number> = {};
      names.forEach((n, k) => (out[n] = w[k] ?? 0));
      out.mouthCheekPuff = out.cheekPuff ?? 0; // upstream key name
      return out;
    }
    return idleFrame(performance.now() / 1000 - t0, names, blink);
  };

  // Upstream sizes from root.offsetWidth/Height + a ResizeObserver and appends an inline canvas. In
  // content-sized layouts (aspect-ratio, height:auto) that feeds back (canvas grows the box, box resizes the
  // canvas, ...) and nothing renders. Give it a fixed-size absolutely-positioned host instead.
  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;inset:0;overflow:hidden;";
  container.appendChild(host);
  const style = document.createElement("style");
  style.textContent = "[data-lam-host] canvas{display:block}";
  host.dataset.lamHost = "";
  host.appendChild(style);

  const renderer: any = await withXhrHeaders(opts.packageUrl, opts.headers, () =>
    (GS as any).GaussianSplatRenderer.getInstance(host, opts.packageUrl, {
      getChatState,
      getExpressionData,
      backgroundColor: opts.backgroundColor ?? "0xffffff",
      alpha: opts.alpha ?? 1,
      downloadProgress: (p: number) => opts.onProgress?.(p * 0.8),
      loadProgress: (p: number) => opts.onProgress?.(0.8 + p * 0.2),
    }),
  );
  if (!renderer) throw new Error("LAM renderer failed to load the avatar package (see console)");
  const cam = opts.camera ?? { y: 1.66, z: 0.62 };
  const v = renderer.viewer;
  if (v?.camera) {
    v.camera.position.set(0, cam.y, cam.z);
    v.camera.lookAt(0, cam.y, 0);
    v.controls?.target?.set(0, cam.y, 0);
    v.controls?.update?.();
  }

  return {
    setExpr: (e) => (expr = e),
    setAudio: (a) => (audio = a),
    state: () => state,
    _renderer: renderer,
    dispose: () => {
      renderer.dispose?.();
      (GS as any).GaussianSplatRenderer.instance = undefined;
      host.remove();
    },
  };
}
