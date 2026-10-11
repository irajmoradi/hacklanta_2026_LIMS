import type { Villager } from '../api/types';
import { Portrait } from './shared';
import { VillageIcon } from './VillageIcon';

/** Reuse the head/photo fallback while giving the crown a named image role. */
export function MayorScenePortrait({ person, large, animate }: { person: Villager; large?: boolean; animate?: boolean }) {
  return <span className="mayor-portrait"><Portrait person={{ ...person, has_crown: false }} large={large} animate={animate}/>{person.has_crown && <span className="portrait-crown" role="img" aria-label="Weekly crown"><VillageIcon name="crown" size={14}/></span>}</span>;
}
