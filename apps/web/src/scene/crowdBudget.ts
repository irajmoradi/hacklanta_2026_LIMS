/** Offscreen NPCs never take a detail slot; interaction always wins. */
export function crowdBudget<T extends {priority: boolean; distance: number}>(people: T[], limit = 20): Set<T> {
  const chosen = new Set<T>();
  for (const person of [...people].sort((a,b) => a.distance-b.distance)) {
    if (person.priority) chosen.add(person);
    else if (Number.isFinite(person.distance) && limit > 0) {chosen.add(person);limit--;}
  }
  return chosen;
}
