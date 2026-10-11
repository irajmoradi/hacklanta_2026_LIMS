import catalog from "../../../../packages/catalog/furniture.json";
// Shared by the boutique meshes, entrance camera and shopper collision checks.
export const boutiqueLayout = {
  door: { x: -5, z: 2.35, width: 2 },
  spawn: [-4.55, 2.35] as [number, number],
  exit: [-5.6, 2.35] as [number, number],
  shelves: { x: -2.5, z: -3.3, width: 4.4, depth: .65 },
  rack: { x: 1.45, z: -2.2, width: 2.77, depth: .13 },
  counter: { x: -2.9, z: .05, width: 2.9, depth: 1.18 },
};
export function petPriceRange(items: { kind: string; price_coins: number }[]) {
  const prices = items.filter(i => i.kind === 'pet').map(i => i.price_coins);
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
}
export const furniture = catalog;
export type Item = {
  floor?: number;
  creator?: string;
  creator_name?: string;
  model_url?: string;
  item_id: string;
  kind: string;
  x: number;
  z: number;
  rot: number;
  stashed: boolean;
  seq: number;
};
export type Action = "place_item" | "move_item" | "rotate_item" | "stash_item";
export const snap = (n: number) => Math.round(n * 4) / 4;
export const rotate = (n: number) =>
  (((Math.round(n / 15) * 15) % 360) + 360) % 360;
export function bounds(i: Item) {
  const c = catalog.find((c) => c.id === i.kind) ?? {width:1, depth:1};
  const r = (i.rot * Math.PI) / 180;
  return [
    (Math.abs(Math.cos(r)) * c.width + Math.abs(Math.sin(r)) * c.depth) / 2,
    (Math.abs(Math.sin(r)) * c.width + Math.abs(Math.cos(r)) * c.depth) / 2,
  ];
}
export function snapped(i: Item): Item {
  const n = { ...i, x: snap(i.x), z: snap(i.z), rot: rotate(i.rot) };
  if (catalog.find((c) => c.id === i.kind)?.shape === "wall") {
    if (Math.abs(n.x) > Math.abs(n.z)) {
      n.x = n.x > 0 ? 3.75 : -3.75;
      n.rot = n.x > 0 ? 90 : 270;
    } else {
      n.z = n.z > 0 ? 3.75 : -3.75;
      n.rot = n.z < 0 ? 0 : 180;
    }
  }
  return n;
}
export function valid(i: Item, items: Item[]) {
  const [w, d] = bounds(i);
  if (Math.abs(i.x) + w > 4.001 || Math.abs(i.z) + d > 4.001) return false;
  const layer = (kind: string) => {
    const s = catalog.find((c) => c.id === kind)?.shape ?? "object";
    return ["rug", "wall", "disco"].includes(s) ? s : "floor";
  };
  return !items.some((o) => {
    if (o.item_id === i.item_id || o.stashed || (o.floor ?? 0) !== (i.floor ?? 0) || layer(o.kind) !== layer(i.kind))
      return false;
    const [ow, od] = bounds(o);
    return (
      Math.abs(i.x - o.x) < w + ow - 0.001 &&
      Math.abs(i.z - o.z) < d + od - 0.001
    );
  });
}
export function interpolate(a: number, b: number, dt: number) {
  return a + (b - a) * (1 - Math.exp(-dt * 24));
}
export function interpolateRotation(a: number, b: number, dt: number) {
  return a + (((((b - a) % 360) + 540) % 360) - 180) * (1 - Math.exp(-dt * 24));
}
export const starters: Item[] = [
  ["sofa", -2, -2],
  ["coffee_table", -2, 0],
  ["bed", 2, -2],
  ["plant_fern", 3, 2],
  ["rug_round", -2, 0],
].map(([kind, x, z]) => ({
  item_id: String(kind),
  kind: String(kind),
  x: Number(x),
  z: Number(z),
  rot: 0,
  stashed: false,
  seq: 0,
}));
export type Move = {
  seq: number;
  time: string;
  item_id: string;
  before_state: Item | null;
  after_state: Item;
};
export function replay(items: Item[], moves: Move[], time: number) {
  const map = new Map(items.map((i) => [i.item_id, i]));
  for (const m of [...moves].sort((a, b) => b.seq - a.seq)) {
    if (Date.parse(m.time) <= time) continue;
    if (m.before_state) map.set(m.item_id, m.before_state);
    else map.delete(m.item_id);
  }
  return [...map.values()];
}
