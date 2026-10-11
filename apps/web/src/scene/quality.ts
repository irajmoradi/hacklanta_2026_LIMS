/** Explicit low tier also lets performance tests avoid relying on core detection. */
export function lowQuality(cores: number, search: string) {
  return cores <= 4 || new URLSearchParams(search).get('quality') === 'low';
}

/** Ignore shader warm-up, then reduce quality after a two-second slow window. */
export function qualityWindow(reduced = false) {
  let warmup = 0, seconds = 0, frames = 0;
  return {
    get reduced() {return reduced;},
    sample(dt: number, hidden = false) {
      if (hidden || reduced) return false;
      warmup += dt;
      if (warmup < 8) return false;
      seconds += dt; frames++;
      if (seconds < 2) return false;
      reduced = frames / seconds < 45;
      seconds = 0; frames = 0;
      return reduced;
    },
  };
}
