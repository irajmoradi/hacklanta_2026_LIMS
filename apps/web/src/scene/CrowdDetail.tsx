import {useEffect, useRef, useState, type ReactNode} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {Group, Vector3, type Scene} from 'three';
import {crowdBudget} from './crowdBudget';

type Candidate = {group: Group; priority: boolean; setDetail: (value: boolean) => void};
const crowds = new WeakMap<Scene, {members: Set<Candidate>; next: number}>();
const point = new Vector3();
/** Large towns keep at most twenty detailed bodies, plus the player/selection.
 * Other villagers retain a clickable, shirt-colored two-mesh silhouette.
 * Small towns never enter this path.
 */
export function CrowdDetail({enabled, priority, shirt, skin, children}: {
  enabled: boolean; priority: boolean; shirt: string; skin: string; children: ReactNode;
}) {
  const {scene} = useThree();
  const group = useRef<Group>(null), candidate = useRef<Candidate | null>(null);
  const [detail, setDetail] = useState(!enabled || priority);
  useEffect(() => {
    if (!enabled || !group.current) return;
    const crowd = crowds.get(scene) ?? {members: new Set<Candidate>(), next: 0};
    crowds.set(scene, crowd);
    const entry = {group: group.current, priority, setDetail};
    candidate.current = entry; crowd.members.add(entry);
    return () => {crowd.members.delete(entry);candidate.current=null;};
  }, [enabled, scene]);
  if (candidate.current) candidate.current.priority = priority;
  useFrame(({camera, clock}) => {
    if (!enabled) return;
    const crowd = crowds.get(scene);
    if (!crowd || clock.elapsedTime < crowd.next) return;
    crowd.next = clock.elapsedTime + .25;
    const ranked = [...crowd.members].map(entry => {
      entry.group.getWorldPosition(point);
      const distance = point.distanceToSquared(camera.position);
      point.project(camera);
      const visible = Math.abs(point.x)<1.1 && Math.abs(point.y)<1.1 && Math.abs(point.z)<=1;
      return {entry, priority: entry.priority, distance: visible ? distance : Infinity};
    });
    const chosen = crowdBudget(ranked);
    for (const item of ranked) item.entry.setDetail(chosen.has(item));
  });
  if (!enabled) return <>{children}</>;
  return <group ref={group} name={priority || detail ? 'crowd-detailed' : 'crowd-impostor'}>{priority || detail ? children : <>
    <mesh position={[0,.65,0]}><capsuleGeometry args={[.23,.65,2,5]}/><meshStandardMaterial color={shirt}/></mesh>
    <mesh position={[0,1.25,0]}><icosahedronGeometry args={[.39,0]}/><meshStandardMaterial color={skin}/></mesh>
  </>}</group>;
}
