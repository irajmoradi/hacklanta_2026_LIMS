import { valid, type Action, type Item } from '../scene/interior';
export type DecorMove = {item: Item; action: Action};
export function previewDecor(room: Item[], moves: DecorMove[]) {
  return moves.reduce((list, {item, action}) => [...list.filter(i => i.item_id !== item.item_id), {...item, stashed:action === 'stash_item'}], room);
}
export function validDecor(room: Item[], moves: DecorMove[]) {
  for (const move of moves) {
    if (move.action !== 'stash_item' && !valid(move.item, room)) return false;
    room = previewDecor(room, [move]);
  }
  return true;
}

/** Compare touched furniture to its first-edit baseline before replaying a draft. */
export function unchangedDecor(room: Item[], origins: Map<string, Item | undefined>) {
  return [...origins].every(([id, before]) => {
    const after = room.find(item => item.item_id === id);
    if (!before || !after) return before === after;
    return before.seq === after.seq && before.x === after.x && before.z === after.z &&
      before.rot === after.rot && before.stashed === after.stashed && (before.floor ?? 0) === (after.floor ?? 0);
  });
}
