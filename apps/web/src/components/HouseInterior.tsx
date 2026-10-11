import { useHouseLeaveGuard } from './HouseLeaveGuard';
import { InteriorAvatars } from "./InteriorAvatars";
import { InteriorFloor, InteriorSlab, InteriorStaircase } from './HouseInteriorFloors';
import { FLOOR_HEIGHT, blocksStairwell } from '../scene/interiorWalk';
import type { InteriorPeer } from "../scene/interiorWalk";
import { useInteriorWalk } from "./interiorWalk/useInteriorWalk";
import { RotateCw, Copy, Archive, Armchair, Lamp, Shapes, Image as ImageIcon } from "lucide-react";
import { previewDecor, validDecor, unchangedDecor, type DecorMove } from "./decorDraft";
import { applyHouseSurface } from "../scene/surfaceMaterials";
import { mediaUrl } from "./shared";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Text } from "@react-three/drei";
import { Plane, Vector3 } from "three";
import { api } from "../api/client";
import type { Villager } from "../api/types";
import { selectHouse } from "../scene/houseStyles";
import { Furniture } from "../scene/Furniture";
import {
  furniture,
  snapped,
  valid,
  starters,
  replay,
  type Item,
  type Action,
  type Move,
} from "../scene/interior";
import "./HouseInterior.css";
type Snapshot = {
  items: Item[];
  seq: number;
  can_edit: boolean;
  owned?: string[];
  floors?: number;
  can_remove_any?: boolean;
  custom_items?: {id:string; glb_url:string; preview:string; display_name:string}[];
};
type Peer = InteriorPeer;
function PhotoThumbnail({source}: {source:string}) {
  const [url,setUrl] = useState<string>();
  useEffect(()=>{
    let active=true, local:string|undefined;
    void mediaUrl(source).then(value=>{local=value;if(active)setUrl(value);else if(value.startsWith("blob:"))URL.revokeObjectURL(value);}).catch(()=>{});
    return()=>{active=false;if(local?.startsWith("blob:"))URL.revokeObjectURL(local);};
  },[source]);
  return url ? <img src={url} alt=""/> : <ImageIcon size={28}/>;
}
function Dolly({height,floors}: {height:number;floors:number}) {
  const invalidate = useThree(state=>state.invalidate);
  useEffect(()=>{const timer=setInterval(invalidate,40);return()=>clearInterval(timer);},[invalidate]);
  const target = useRef(new Vector3(0,.3,0));
  useFrame(({ camera }, dt) => {
    camera.position.lerp(new Vector3(11 + Math.max(0,floors-2)*6, 11 + height + Math.max(0,floors-2)*6, 14 + Math.max(0,floors-2)*8), matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 1 - Math.exp(-dt * 2));
    target.current.lerp(new Vector3(0,.3+height,0),1-Math.exp(-dt*2));
    camera.lookAt(target.current);
  }, -1);
  return null;
}
const ground = new Plane(new Vector3(0, 1, 0), 0);
export function HouseInterior({
  person,
  vid,
  onClose,
  hall = false,
}: {
  hall?: boolean;
  person: Villager;
  vid: string;
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState<string>();
  useEffect(() => {
    let alive = true,
      url: string | undefined;
    const preview = !hall && person.equipped.find((i) => i.custom && i.preview)?.preview;
    if (preview)
      void mediaUrl(preview)
        .then((value) => {
          url = value;
          if (alive) setPhoto(value);
          else if (value.startsWith("blob:")) URL.revokeObjectURL(value);
        })
        .catch(() => {});
    return () => {
      alive = false;
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [person, hall]);
  const [savedItems, setItems] = useState<Item[]>([]),
    [editable, setEditable] = useState(false),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [ghost, setGhost] = useState<Item | null>(null),
    [status, setStatus] = useState("Connecting…"),
    [error, setError] = useState(""),
    [owned, setOwned] = useState<string[]>([]),
    [peers, setPeers] = useState<Record<string, Peer>>({}),
    [floor, setFloor] = useState(0),
    [floors, setFloors] = useState(hall ? 2 : person.house_level < 2 ? 1 : person.house_level < 4 ? 2 : 3),
    [removeAny, setRemoveAny] = useState(false),
    [customItems, setCustomItems] = useState<NonNullable<Snapshot["custom_items"]>>([]),
    [category, setCategory] = useState("Furniture"),
    [hovered, setHovered] = useState<string | null>(null),
    [members, setMembers] = useState<Villager[]>([]),
    [busy, setBusy] = useState<{ house_id: string; moves: number }[]>([]),
    [history, setHistory] = useState<{ items: Item[]; moves: Move[]; as_of:string } | null>(
      null,
    ),
    [scrub, setScrub] = useState(100);
  const socket = useRef<WebSocket | null>(null),
    clientId = useRef<string>(),
    seq = useRef(0),
    revision = useRef(-1),
    rejections = useRef(0),
    settlingRef = useRef(false),
    current = useRef<Item[]>([]),
    pending = useRef(new Map<string, number>()),
    drag = useRef<Item | null>(null),
    lastSend = useRef(0),
    undo = useRef<{ before: Item; after: Item }[]>([]),
    redo = useRef<{ before: Item; after: Item }[]>([]),
    channel = useRef<BroadcastChannel | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    undoStart = useRef<Item | null>(null),
    editSession = useRef(0);
  const [draftMoves, setDraftMoves] = useState<DecorMove[]>([]);
  const origins = useRef(new Map<string, Item | undefined>());
  const baseline = useRef(savedItems); baseline.current = savedItems;
  const draftRef = useRef<DecorMove[]>([]);
  const items = previewDecor(savedItems, draftMoves);
  current.current = items;
  const uid = hall ? vid : person.user_id,
    path = `/houses/${uid}`,
    query = `?vid=${vid}`,
    offline = api.mode === "mock",
    house = hall ? {...selectHouse(person), style:"cottage", colors:{wall:"#dbd9c7",roof:"#718579",trim:"#b59c79",door:"#75634e"}, materials:{wall:"wood" as const}} : selectHouse(person),
    key = `village-interior:${uid}`;
  const walking = useInteriorWalk({items, floor, floors, paused: editing || scrub < 100, onFloor: changeFloor, socket, broadcast: p => {if (offline) channel.current?.postMessage({type:"movement",user_id:api.user,name:members.find(m=>m.user_id===api.user)?.display_name ?? "Neighbor",...p});}});
  function apply(s: Snapshot) {
    revision.current = s.seq;
    current.current = s.items;
    setItems(s.items);
    setEditable(s.can_edit);
    if (!s.can_edit) {editSession.current++; setDraftMoves([]); draftRef.current = []; origins.current.clear(); clearHistory(); setEditing(false); drag.current = null; setGhost(null);}
    if (s.owned) setOwned(s.owned);
    if (s.floors) {setFloors(s.floors);setFloor(current=>Math.min(current,s.floors!-1));}
    if (s.custom_items) setCustomItems(s.custom_items);
    if (s.can_remove_any !== undefined) setRemoveAny(s.can_remove_any);
  }
  useEffect(() => {
    dialog.current?.showModal();
    window.dispatchEvent(
      new CustomEvent("village-interior-visible", { detail: true }),
    );
    return () => {
      dialog.current?.close();
      window.dispatchEvent(
        new CustomEvent("village-interior-visible", { detail: false }),
      );
    };
  }, []);
  useEffect(() => {
    let cancelled = false,
      retry: ReturnType<typeof setTimeout>,
      heartbeat: ReturnType<typeof setInterval>;
    void api.village(vid).then(v => {if (!cancelled) setMembers(v.villagers);}).catch(()=>{});
    if (offline) {
      let saved: Item[] = hall ? [] : starters;
      try {
        saved = JSON.parse(localStorage.getItem(key) || "null") || (hall ? [] : starters);
      } catch {}
      apply({
        items: saved,
        seq: Math.max(0, ...saved.map((i) => i.seq)),
        can_edit: hall || api.user === uid,
        can_remove_any: !hall && api.user === uid,
      });
      setStatus("Offline room · saved on this device");
      const bus = new BroadcastChannel(key);
      channel.current = bus;
      bus.onmessage = (e) => {
        if (e.data?.type === 'movement') {
          if(e.data.user_id!==api.user) setPeers(old=>({...old,[e.data.user_id]:e.data}));
          return;
        }
        setItems(e.data);
        current.current = e.data;
      };
      return () => bus.close();
    }
    void api
      .request<{ house_id: string; moves: number }[]>(
        "GET",
        `/villages/${vid}/busy-houses`,
      )
      .then(setBusy)
      .catch(() => {});
    async function connect() {
      clearInterval(heartbeat);
      try {
        const initial = await api.request<Snapshot>("GET", path + query);
        if (cancelled) return;
        apply(initial);
        const headers = await api.authHeaders();
        if (cancelled) return;
        const ws = new WebSocket(
          `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api${path}/live${query}`,
        );
        socket.current = ws;
        ws.onopen = () => {
          ws.send(JSON.stringify(headers));
          setStatus("Live · connecting");
        };
        ws.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.type === "snapshot") {
            clientId.current=data.client_id;
            pending.current.clear();
            apply(data);
            setStatus("Live · changes saved automatically");
          } else if (data.type === "delta" || data.type === "ack") {
            revision.current = Math.max(revision.current, data.seq);
            const p = pending.current.get(data.item.item_id);
            if (data.client_id === clientId.current && p && data.client_seq < p) return;
            if (data.client_id === clientId.current)
              pending.current.delete(data.item.item_id);
            setItems((old) => {
              const existing = old.find((i) => i.item_id === data.item.item_id);
              return existing && existing.seq > data.seq
                ? old
                : [
                    ...old.filter((i) => i.item_id !== data.item.item_id),
                    data.item,
                  ];
            });
            if (data.user_id !== api.user)
              setPeers((old) => ({
                ...old,
                [data.user_id]: {
                  ...old[data.user_id],
                  name:
                    old[data.user_id]?.name ||
                    members.find((m) => m.user_id === data.user_id)
                      ?.display_name ||
                    "A neighbor",
                  item: data.item.item_id,
                },
              }));
          } else if (data.type === "rejected") {
            rejections.current++;
            pending.current.clear();
            setDraftMoves([]); draftRef.current = []; origins.current.clear();
            undo.current = [];
            redo.current = [];
            apply(data.snapshot);
            setError(data.detail);
            setGhost(null);
            drag.current = null;
          } else if (data.type === "presence_list") {
            setPeers(old => Object.fromEntries(data.people.map((p: {user_id:string;name:string}) => [p.user_id,{...old[p.user_id],name:p.name}])));
          } else if (data.type === "movement") {
            if (data.user_id !== api.user) setPeers(old => ({...old,[data.user_id]:{...old[data.user_id],...data}}));
          } else if (data.type === "presence") {
            setPeers((old) => {
              const n = { ...old };
              if (data.active) n[data.user_id] = { ...n[data.user_id], name: data.name };
              else delete n[data.user_id];
              return n;
            });
          } else if (data.type === "permissions") {
            void api.request<Snapshot>("GET", path + query).then(apply);
          }
        };
        ws.onclose = () => {
          if (!cancelled) {
            setStatus("Reconnecting…");
            retry = setTimeout(() => void connect(), 1500);
          }
        };
        heartbeat = setInterval(() => {
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
        }, 20000);
      } catch {
        if (!cancelled) {
          setStatus("Connection unavailable · retrying");
          retry = setTimeout(() => void connect(), 3000);
        }
      }
    }
    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      socket.current?.close();
    };
  }, [uid, vid]);
  function send(item: Item, action: Action, persist = false) {
    if (settlingRef.current && !persist) return false;
    if (!editable || !editing || scrub < 100) return false;
    if (!offline && socket.current?.readyState !== 1) {
      setError("Reconnect before editing");
      return false;
    }
    if (hall && action === "stash_item" && item.creator !== api.user && !removeAny) {
      setError("Only the creator or village owner can remove this item.");
      return false;
    }
    const n = snapped(item);
    if (action !== "stash_item" && (!valid(n, current.current) || (floors>1 && blocksStairwell(n)))) {
      setError("That space is occupied, in the stairwell, or outside the room.");
      return false;
    }
    const prior = current.current.find((i) => i.item_id === n.item_id);
    if (
      action === "move_item" &&
      prior &&
      !prior.stashed &&
      prior.x === n.x &&
      prior.z === n.z &&
      prior.rot === n.rot && (prior.floor ?? 0) === (n.floor ?? 0)
    )
      return true;
    setError("");
    if (!persist) {
      if (!origins.current.has(n.item_id)) origins.current.set(n.item_id, baseline.current.find(i => i.item_id === n.item_id));
      draftRef.current = [...draftRef.current, {item:n, action}];
      setDraftMoves(draftRef.current);
      current.current = [...current.current.filter(i => i.item_id !== n.item_id), {...n, stashed:action === 'stash_item'}];
      return true;
    }
    const client_seq = ++seq.current;
    const next = {
      ...n,
      stashed: action === "stash_item",
      seq: revision.current + 1,
    };
    pending.current.set(n.item_id, client_seq);
    setItems((old) => [...old.filter((i) => i.item_id !== n.item_id), next]);
    current.current = [
      ...current.current.filter((i) => i.item_id !== n.item_id),
      next,
    ];
    if (offline) {
      pending.current.delete(n.item_id);
      revision.current++;
      localStorage.setItem(key, JSON.stringify(current.current));
      channel.current?.postMessage(current.current);
    } else
      socket.current?.send(
        JSON.stringify({
          action,
          item_id: n.item_id,
          kind: n.kind,
          floor: n.floor ?? 0,
          x: n.x,
          z: n.z,
          rot: n.rot,
          client_seq,
        }),
      );
    return true;
  }
  const [, renderHistory] = useState(0);
  const [settling, setSettling] = useState(false);
  function clearHistory() {undo.current = []; redo.current = []; renderHistory(n => n + 1);}
  async function waitForSync() {
    const rejected = rejections.current;
    for (let tries = 0; !offline && pending.current.size && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 50));
    if (pending.current.size || rejected !== rejections.current) {setError("Changes could not sync. Reconnect and try again."); return false;}
    return true;
  }
  function discardChanges() {
    if (settlingRef.current) return false;
    editSession.current++;
    setDraftMoves([]); draftRef.current = []; origins.current.clear(); current.current = savedItems;
    clearHistory(); drag.current = null; setGhost(null); setSelected(null); setScrub(100); setError('');
    return true;
  }
  function cancelDecorating() {
    if (discardChanges()) setEditing(false);
  }
  async function acceptChanges() {
    if (settlingRef.current) return false;
    finish();
    const session = ++editSession.current;
    settlingRef.current = true; setSettling(true);
    try {
      if (!await waitForSync() || session !== editSession.current) return false;
      const moves = draftRef.current;
      if (!unchangedDecor(baseline.current, origins.current) || !validDecor(baseline.current, moves)) {
        setError('The shared room changed. Cancel and try this arrangement again.'); return false;
      }
      current.current = baseline.current;
      setDraftMoves([]); draftRef.current = []; origins.current.clear();
      // Serialize acknowledgements so a rejected edit cannot silently accept later steps.
      for (const {item, action} of moves) {
        if (session !== editSession.current) return false;
        if (!send(item, action, true) || !await waitForSync()) {clearHistory(); return false;}
      }
      clearHistory(); return true;
    } finally {settlingRef.current = false; setSettling(false);}
  }
  async function saveDecorating() {if (await acceptChanges()) setEditing(false);}
  const guard = useHouseLeaveGuard({scope: dialog, dirty: draftMoves.length > 0 || !!drag.current, busy:settling, save: acceptChanges, discard: discardChanges, escape: cancelDecorating, cancelOnEscape: true});
  function record(before: Item, after: Item) {
    if (before.x === after.x && before.z === after.z && before.rot === after.rot && before.stashed === after.stashed && (before.floor ?? 0) === (after.floor ?? 0)) return;
    renderHistory(n => n + 1);
    undo.current.push({ before, after });
    redo.current = [];
  }
  function undoRedo(forward = false) {
    if (settlingRef.current || !editing || !editable || scrub < 100) return false;
    const stack = (forward ? redo : undo).current;
    const entry = stack.at(-1);
    if (!entry) return false;
    const expected = forward ? entry.before : entry.after;
    const latest = current.current.find(i=>i.item_id === expected.item_id);
    if (!latest || latest.x !== expected.x || latest.z !== expected.z || latest.rot !== expected.rot || latest.stashed !== expected.stashed || (latest.floor ?? 0) !== (expected.floor ?? 0)) {
      setError("This item changed since your edit. Keep the latest room state or try again after it syncs.");
      return false;
    }
    const target = forward ? entry.after : entry.before;
    if (send(target, target.stashed ? "stash_item" : expected.stashed ? "place_item" : "move_item")) {
      setFloor(target.floor ?? 0);
      stack.pop();
      (forward ? undo : redo).current.push(entry);
      renderHistory(n => n + 1);
      return true;
    }
    return false;
  }
  function turn(delta = 15) {
    const item =
      drag.current || current.current.find((i) => i.item_id === selected);
    if (!item || !editing) return;
    const n = snapped({ ...item, rot: item.rot + delta });
    if (drag.current) {
      drag.current = n;
      setGhost(n);
    } else {
      if (send(n, "rotate_item")) record(item, n);
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.querySelector(".house-leave-dialog") || (e.target as HTMLElement).closest("input,select,textarea,[contenteditable=true]")) return;
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        turn();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        ["z", "y"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        undoRedo(e.key.toLowerCase() === "y" || e.shiftKey);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  });
  function finish() {
    if (drag.current) {
      send(drag.current, "move_item");
      const accepted = current.current.find(i=>i.item_id === drag.current?.item_id);
      if (accepted && undoStart.current) record(undoStart.current, accepted);
    }
    drag.current = null;
    setGhost(null);
  }
  async function place(kind: string, duplicate = false) {
    if (settlingRef.current || !editing || !editable || scrub < 100) return;
    const session = editSession.current;
    const c = furniture.find((c) => c.id === kind);
    const custom = customItems.find(c => c.id === kind);
    if (!c && !custom) {setError("Only your own photo objects can be duplicated.");return;}
    if (c?.price && !owned.includes(kind)) {
      if (!offline) {
        try {
          await api.request("POST", path + "/buy" + query, { kind });
          setOwned((o) => [...o, kind]);
        } catch (e) {
          setError((e as Error).message);
          return;
        }
      } else {
        setError("Connect to the village to buy furniture with coins.");
        return;
      }
    }
    if (session !== editSession.current) return;
    const previous = duplicate ? undefined : current.current.find((i) => i.kind === kind && i.stashed && (!hall || i.creator === api.user));
    let n = snapped({
      ...previous,
      item_id: previous?.item_id ?? `${kind}_${crypto.randomUUID()}`,
      kind,
      floor,
      creator: previous?.creator ?? api.user,
      creator_name: custom?.display_name ?? members.find(m => m.user_id === api.user)?.display_name ?? person.display_name,
      model_url: custom?.glb_url,
      x: 0,
      z: 0,
      rot: 0,
      stashed: false,
      seq: 0,
    });
    let found = false;
    for (let z = -3.5; z <= 3.5 && !found; z += 0.25)
      for (let x = -3.5; x <= 3.5 && !found; x += 0.25) {
        const candidate = snapped({ ...n, x, z });
        if (valid(candidate, current.current) && (floors===1 || !blocksStairwell(candidate))) {
          n = candidate;
          found = true;
        }
      }
    if (!found) {
      setError("Stash an item to make room.");
      return;
    }
    if (send(n, "place_item")) record(previous || { ...n, stashed: true }, n);
    setSelected(n.item_id);
  }
  function changeFloor(next: number) {
    finish(); setFloor(next); setSelected(null); setHovered(null); setGhost(null);
  }
  const now = history ? Date.parse(history.as_of) : Date.now();
  const visible =
    history && scrub < 100
      ? replay(
          history.items,
          history.moves,
          now - 600000 + (scrub / 100) * 600000,
        )
      : items;
  const selectedItem = items.find(i=>i.item_id===selected && !i.stashed && (i.floor ?? 0)===floor);
  const hoveredItem = items.find(i=>i.item_id===hovered && !i.stashed && (i.floor ?? 0)===floor);
  return createPortal(
    <dialog
      ref={dialog}
      className={`interior-dialog ${editing ? "is-decorating" : ""}`}
      aria-label={hall ? "Community Hall interior" : `${person.display_name}'s house interior`}
      onKeyDown={(e) => e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (editing) cancelDecorating(); else onClose();
      }}
    >
      {guard.prompt}
      <header className="interior-head">
        <div>
          <small>{hall ? "VILLAGE COMMONS" : `PRIVATE HOME / ${house.style}`}</small>
          <h2>{hall ? "Community Hall" : `${person.display_name}'s home`}</h2>
          <span role="status">{editing ? "Previewing decor - Save to keep your arrangement" : status}</span>
        </div>
        <div>
          {editable && (
            <button disabled={settling} onClick={() => {if (editing) void saveDecorating(); else setEditing(true);}}>
              {editing ? "Finish decorating" : "Decorate"}
            </button>
          )}
          <button onClick={() => guard.leave(onClose)}>Back to village</button>
        </div>
      </header>
      {error && (
        <p role="alert" className="interior-error">
          {error}
        </p>
      )}
      <div className="interior-floors" role="tablist" aria-label="Floors" onKeyDown={e=>{
        if (!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
        e.preventDefault();
        const next=e.key==="Home" ? 0 : e.key==="End" ? floors-1 : (floor+(e.key==="ArrowRight" ? 1 : floors-1))%floors;
        walking.shortcut(next); changeFloor(next);
        e.currentTarget.querySelectorAll("button")[next]?.focus();
      }}>
        {Array.from({length:floors}, (_,i) => <button role="tab" tabIndex={floor === i ? 0 : -1} aria-selected={floor === i} key={i} onClick={() => {walking.shortcut(i);changeFloor(i);}}>{i === 0 ? "Ground floor" : `Floor ${i+1}`}</button>)}
        <span>{hall ? "Everyone can decorate / creators manage removal" : editable ? "Your private home" : "Visiting / live view"}</span>
      </div>
      <div className="interior-body">
        <div
          className="interior-canvas"
          data-interior-walk tabIndex={0} aria-label="Walk around the room"
          onPointerDown={e=>{if (!(e.target as HTMLElement).closest('button,input')) e.currentTarget.focus();}}
          onPointerUp={finish}
          onPointerCancel={finish}
          onWheel={(e) => {
            if (editing && selected) {
              e.stopPropagation();
              turn(e.deltaY > 0 ? 15 : -15);
            }
          }}
        >
          <Canvas
            shadows
            dpr={1}
            frameloop="demand"
            camera={{ position: [15, 17, 22], fov: 42 }}
            onPointerMissed={() => setSelected(null)}
          >
            <color attach="background" args={["#e8e3d8"]} />
            <ambientLight intensity={0.9} />
            <hemisphereLight args={["#f7f2df", "#8b937e", 1.2]}/>
            <directionalLight
              position={[1, 8, 4]}
              intensity={1.5}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <Dolly floors={floors} height={editing ? floor*FLOOR_HEIGHT : walking.position.y ?? floor*FLOOR_HEIGHT}/>
            {Array.from({length:floors},(_,level)=><InteriorFloor key={level} level={level} focus={floor}>
            {[0,1].map(axis => <mesh key={axis} position={axis ? [-3.88,.12,0] : [0,.12,-3.88]}><boxGeometry args={axis ? [.1,.24,8] : [8,.24,.1]}/><meshStandardMaterial color={house.colors.trim} roughness={.85}/></mesh>)}
            <mesh position={[-3.87,1.8,0]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[1.6,1,.08]}/><meshStandardMaterial color="#7c8776"/></mesh>
            <mesh position={[-3.81,1.8,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[1.35,.75]}/><meshStandardMaterial color="#d8c9ac"/></mesh>
            {hall && <group position={[0,0,-3.25]}><mesh position={[0,.12,0]}><boxGeometry args={[2.5,.24,1.2]}/><meshStandardMaterial color="#8b7056"/></mesh><mesh position={[0,1.6,-.65]}><boxGeometry args={[2.5,2.8,.08]}/><meshStandardMaterial color="#63796f"/></mesh></group>}
            <InteriorSlab level={level} color={house.colors.trim} onWalk={p=>{if(!editing && level===floor) walking.walkTo(p);}}/>
            <mesh position={[0, 1.5, -4]}>
              <boxGeometry args={[8, 3, 0.15]} />
              <meshStandardMaterial
                name="wall"
                color={house.colors.wall}
                onUpdate={(m) => applyHouseSurface(m, house.materials)}
              />
            </mesh>
            <mesh position={[-4, 1.5, 0]}>
              <boxGeometry args={[0.15, 3, 8]} />
              <meshStandardMaterial
                name="wall"
                color={house.colors.wall}
                onUpdate={(m) => applyHouseSurface(m, house.materials)}
              />
            </mesh>
            {level===floors-1 && ["aframe", "cottage"].includes(house.style) &&
              [-3, 0, 3].map((z) => (
                <group key={z} position={[0, 3, z]}>
                  {[-1, 1].map((n) => (
                    <mesh
                      key={n}
                      position={[n * 2, 0.35, 0]}
                      rotation={[0, 0, n * 0.2]}
                    >
                      <boxGeometry args={[4.1, 0.14, 0.14]} />
                      <meshStandardMaterial color={house.colors.door} />
                    </mesh>
                  ))}
                </group>
              ))}
            {house.style === "beach" &&
              [-3.9, 3.9].map((x) => (
                <mesh key={x} position={[x, 1.6, -3.9]}>
                  <cylinderGeometry args={[0.12, 0.12, 3.2, 8]} />
                  <meshStandardMaterial color={house.colors.trim} />
                </mesh>
              ))}
            {house.style === "tudor" &&
              [-3, 0, 3].map((x) => (
                <mesh key={x} position={[x, 1.5, -3.88]}>
                  <boxGeometry args={[0.15, 3, 0.15]} />
                  <meshStandardMaterial color={house.colors.door} />
                </mesh>
              ))}
            {[-2, 2].map((x) => (
              <group key={x} position={[x, 1.8, -3.88]}>
                <mesh>
                  <boxGeometry args={[1.5, 1.3, 0.1]} />
                  <meshStandardMaterial color={house.colors.trim} />
                </mesh>
                <mesh position={[0, 0, 0.06]}>
                  <planeGeometry args={[1.25, 1.05]} />
                  <meshBasicMaterial
                    color={
                      new Date().getHours() > 18 || new Date().getHours() < 6
                        ? "#293c66"
                        : "#9ed5df"
                    }
                  />
                </mesh>
                <mesh position={[0, 0, 0.08]}>
                  <boxGeometry args={[0.06, 1.05, 0.02]} />
                  <meshStandardMaterial color={house.colors.trim} />
                </mesh>
              </group>
            ))}
            {level===floor && editing && (ghost || selectedItem) && (
              <gridHelper
                args={[8, 32, "#aaa28e", "#aaa28e"]}
                onUpdate={helper=>{
                  const materials=Array.isArray(helper.material) ? helper.material : [helper.material];
                  materials.forEach(material=>{material.transparent=true;material.opacity=.2;material.depthWrite=false;});
                }}
                position={[0, 0.025, 0]}
              />
            )}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.045, 0]}
              onPointerMove={(e) => {
                if (!drag.current || level!==floor) return;
                e.stopPropagation();
                ground.constant = -floor * 3.4;
                const point = e.ray.intersectPlane(ground, new Vector3());
                if (!point) return;
                const n = snapped({ ...drag.current, x: point.x, z: point.z });
                drag.current = n;
                setGhost(n);
                if (
                  performance.now() - lastSend.current >= 50 &&
                  valid(n, current.current)
                ) {
                  lastSend.current = performance.now();
                  send(n, "move_item");
                }
              }}
            >
              <planeGeometry args={[30, 30]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {visible
              .filter((i) => !i.stashed && (i.floor ?? 0) === level)
              .map((i) => (
                <Furniture
                  key={i.item_id}
                  item={i}
                  photo={hall ? undefined : photo}
                  onPointerOver={(e:any)=>{e.stopPropagation();setHovered(i.item_id);}}
                  onPointerOut={()=>setHovered(null)}
                  rewards={
                    hall ? members.reduce((total,m)=>total+(m.star_badges?.length || 0)+(m.has_crown ? 1 : 0),0) :
                    (person.star_badges?.length || 0) + (person.has_crown ? 1 : 0)
                  }
                  onPointerDown={(e: any) => {
                    e.stopPropagation();
                    setSelected(i.item_id);
                    if (settlingRef.current || !editing || !editable || scrub < 100) return false;
                    drag.current = { ...i };
                    undoStart.current = { ...i };
                    setGhost(i);
                  }}
                />
              ))}
            {Object.entries(peers)
              .filter(([id, p]) => id !== api.user && p.item && (p.floor ?? 0) === level)
              .map(([id, p]) => {
                const i = items.find((i) => i.item_id === p.item);
                return i ? (
                  <Text
                    key={id}
                    position={[i.x, 1.8, i.z]}
                    fontSize={0.15}
                    color="#7655a5"
                  >
                    {p.name} is moving this
                  </Text>
                ) : null;
              })}
            {level===floor && ghost && (
              <mesh
                position={[ghost.x, 0.06, ghost.z]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry
                  args={[
                    (furniture.find((f) => f.id === ghost.kind)?.width ?? 1),
                    (furniture.find((f) => f.id === ghost.kind)?.depth ?? 1),
                  ]}
                />
                <meshBasicMaterial
                  color={valid(ghost, items) ? "#5cbda2" : "#df675f"}
                  transparent
                  opacity={0.22}
                />
              </mesh>
            )}

            {level===floor && hoveredItem && (
              <Html center position={[hoveredItem.x,1.7,hoveredItem.z]} style={{pointerEvents:"none"}}>
                <span className="interior-credit">Placed by {hoveredItem.creator_name || members.find(m=>m.user_id===hoveredItem.creator)?.display_name || "Home owner"}</span>
              </Html>
            )}
            {level===floor && editing && selectedItem && (
              <Html center position={[selectedItem.x,2.2,selectedItem.z]}>
                <div className="interior-context" onPointerDown={e=>e.stopPropagation()}>
                  <button aria-label="Rotate selected item" onClick={()=>turn()}><RotateCw size={15}/></button>
                  <button aria-label="Duplicate selected item"
                    disabled={!!selectedItem.model_url && selectedItem.creator!==api.user}
                    onClick={()=>void place(selectedItem.kind,true)}><Copy size={15}/></button>
                  <button aria-label="Stash selected item"
                    disabled={hall && selectedItem.creator!==api.user && !removeAny}
                    onClick={()=>{if(send(selectedItem,"stash_item"))record(selectedItem,{...selectedItem,stashed:true});}}>
                    <Archive size={15}/>
                  </button>
                </div>
              </Html>
            )}
            </InteriorFloor>)}
            {Array.from({length:floors-1},(_,lower)=><InteriorStaircase key={lower} lower={lower} focus={floor} onWalk={walking.walkTo}/>)}
            <InteriorAvatars user={api.user} members={members} peers={peers} position={walking.position} floors={floors}/>
          </Canvas>
          <div className="interior-hint">
            {editing
              ? "Drag furniture · R / scroll rotates 15° · Ctrl+Z / Y undo / redo"
              : "Click floor or focus room + WASD / arrows to walk · E near stairs"}
          </div>
        </div>
        <aside className="interior-sidebar"><div className="interior-scroll">
          <h3>{editing ? "Your furniture" : "In the room"}</h3>
          {Object.entries(peers).map(([id, p]) => (
            <p key={id} className="interior-peer">
              &#9679; {p.name}
              {` · Floor ${(id === api.user ? floor : p.floor ?? 0)+1}${p.item ? " · arranging an item" : ""}`}
            </p>
          ))}
          {!Object.keys(peers).length && <p>{hall ? "A shared room, ready to arrange." : "A peaceful moment at home."}</p>}
          {editing && (
            <>
              <p>Arrangement changes are previews until saved. Furniture purchases are kept even if you cancel.</p>
              <div className="interior-tools">
                <button disabled={settling || !undo.current.length || scrub < 100} onClick={() => undoRedo()} aria-keyshortcuts="Control+z Meta+z" title="Undo (Ctrl/Cmd+Z)">Undo</button>
                <button disabled={settling || !redo.current.length || scrub < 100} onClick={() => undoRedo(true)} aria-keyshortcuts="Control+Shift+z Meta+Shift+z Control+y" title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)">Redo</button>
                <button disabled={settling || !undo.current.length || scrub < 100} onClick={discardChanges}>Discard all</button>
                <button disabled={settling || !undo.current.length} onClick={acceptChanges}>Save changes</button>
                <p aria-live="polite">{undo.current.length ? `Unsaved changes (${undo.current.length})` : 'No unsaved changes'}</p>
                <small>Undo and redo update this preview. Save syncs the arrangement; Discard drops the draft.</small>
              </div>
              <nav className="interior-categories" aria-label="Inventory categories">{([["Furniture",Armchair],["Decor",Lamp],["Art",ImageIcon],["Photo objects",Shapes]] as const).map(([label,Icon])=><button key={String(label)} aria-pressed={category===label} onClick={()=>setCategory(String(label))}><Icon size={14}/>{String(label)}</button>)}</nav>
              <div className="interior-inventory">
                {furniture.filter(c => category === "Art" ? c.shape === "wall" : category === "Decor" ? ["rug","lamp","plant","lava","disco","fish"].includes(c.shape) : category === "Furniture" ? !["wall","rug","lamp","plant","lava","disco","fish"].includes(c.shape) : false).map((c) => (
                  <button
                    key={c.id}
                    aria-label={`Place ${c.name}`}
                    onClick={() => void place(c.id)}
                    disabled={
                      scrub < 100
                    }
                  >
                    <img src={c.thumbnail} alt="" />
                    <span>{c.name}</span>
                    <small>
                      {c.price && !owned.includes(c.id)
                        ? `${c.price} coins`
                        : "Owned · place"}
                    </small>
                  </button>
                ))}
                {category === "Photo objects" && customItems.map(c=><button key={c.id} onClick={()=>void place(c.id)}><PhotoThumbnail source={c.preview}/><span>Photo object</span><small>By {c.display_name}</small></button>)}
              </div>
              {category === "Photo objects" && !customItems.length && <p>Create an object with Make it real in the shop; it will appear here when ready.</p>}
              <button
                onClick={() => {
                  if (offline) {
                    setError("History is available in a connected village.");
                    return;
                  }
                  void api
                    .request<{ items: Item[]; moves: Move[]; as_of:string }>(
                      "GET",
                      path + "/history" + query,
                    )
                    .then((h) => {
                      setHistory(h);
                      setScrub(100);
                    })
                    .catch((e) => setError(e.message));
                }}
              >
                Load last 10 minutes
              </button>
              {history && (
                <label>
                  Room history{" "}
                  {scrub === 100 ? "· Live" : "· Preview (editing paused)"}
                  <input
                    aria-label="Room history"
                    type="range"
                    min="0"
                    max="100"
                    value={scrub}
                    onChange={(e) => setScrub(Number(e.target.value))}
                  />
                </label>
              )}

            </>
          )}
          <details>
            <summary>Room inventory</summary>
            {items.filter(i=>(i.floor ?? 0)===floor).map((i) => (
              <div
                key={i.item_id}
                data-testid={`position-${i.item_id}`}
                data-x={i.x}
                data-z={i.z}
                data-rotation={i.rot}
              >
                {furniture.find(c=>c.id===i.kind)?.name ?? "Photo object"} ·{" "}
                {i.stashed ? "stashed" : "placed"}{" "}
                {editing && (
                  <button
                    onClick={() => {
                      setSelected(i.item_id);
                      const n = snapped({ ...i, x: i.x + 0.25, stashed:false });
                      if (send(n, "move_item")) record(i, n);
                    }}
                    aria-label={`Move ${i.kind} right`}
                  >
                    &rarr;
                  </button>
                )}
              </div>
            ))}
          </details>
          {!!busy.length && (
            <section>
              <h3>Busy houses</h3>
              {busy.map((h) => (
                <p key={h.house_id}>
                  {members.find((m) => m.user_id === h.house_id)
                    ?.display_name || "Neighbor"}{" "}
                  · {h.moves} moves this hour
                </p>
              ))}
            </section>
          )}
        </div>{editing && <footer className="editor-actions">
          <button disabled={settling} onClick={() => void saveDecorating()}>Save decor</button><button disabled={settling} onClick={cancelDecorating}>Cancel decor</button>
        </footer>}</aside>
      </div>
    </dialog>,
    document.body,
  );
}
