import type { LocationSpot } from './locationCloseup';
import { locationFraming } from './locationFraming';
import { TOWN_SCALE } from './playerControl';
import { sound } from '../sound/engine';
import {qualityWindow, lowQuality} from './quality';
import type { PlayerState } from './playerControl';
import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';

export function TownCamera({ overview = false, closeup, cinematic, player, currentUser, selected, width = 152, depth = 120, centerZ = 0, resetView = 0, onZoomChange }: { overview?: boolean; closeup?:LocationSpot|null; cinematic?: 'checkin' | 'mayor' | null; player?: PlayerState; currentUser?: string; onZoomChange?: (zoomed: boolean) => void; resetView?: number; selected: string | null; width?: number; depth?: number; centerZ?: number }) {
  const closeSaved=useRef<{position:THREE.Vector3;target:THREE.Vector3;zoom:number}|null>(null);
  const closeFlight=useRef<{start:number;from:THREE.Vector3;target:THREE.Vector3;zoom:number;to:THREE.Vector3;look:THREE.Vector3;endZoom:number;returning:boolean}|null>(null);
  const zoomed = useRef(false);
  const controls = useRef<Controls>(null);
  const { camera, size, scene } = useThree();
  const flight = useRef(0), interacting = useRef(false);
  const desired = useMemo(() => new THREE.Vector3(), []), shift = useMemo(() => new THREE.Vector3(), []);
  const saved = useRef<{position: THREE.Vector3; target: THREE.Vector3; zoom: number} | null>(null);
  const cinematicFlight = useRef<{start: number; from: THREE.Vector3; target: THREE.Vector3; zoom: number; returning: boolean} | null>(null);
  const endPosition = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const c = controls.current;
    if (!c || !(camera instanceof THREE.OrthographicCamera)) return;
    if (cinematic && !saved.current) {
      saved.current = closeSaved.current ?? {position: camera.position.clone(), target: c.target.clone(), zoom: camera.zoom};
      closeSaved.current=null; closeFlight.current=null;
    }
    if (!cinematic && !saved.current) return;
    cinematicFlight.current = {start: cinematic ? performance.getEntriesByName('scene-request').at(-1)?.startTime ?? performance.now() : performance.now(), from: camera.position.clone(), target: c.target.clone(), zoom: camera.zoom, returning: !cinematic};
    flight.current = 0;
    c.enableDamping = false; c.enabled = false;
  }, [cinematic, camera, size.width, size.height]);
  useEffect(()=>{
    const c=controls.current;if(!c || !(camera instanceof THREE.OrthographicCamera))return;
    if(closeup && !closeSaved.current) closeSaved.current={position:camera.position.clone(),target:c.target.clone(),zoom:camera.zoom};
    if(!closeup && !closeSaved.current)return;
    const look=closeup ? new THREE.Vector3(closeup.center[0]*TOWN_SCALE,1,closeup.center[1]*TOWN_SCALE) : closeSaved.current!.target.clone();
    const framing=locationFraming(size.width,size.height);
    const endZoom=closeup ? framing.zoom : closeSaved.current!.zoom;
    if(closeup){
      // Camera-right for the fixed (18,22,30) view; reserve the card's column.
      look.add(new THREE.Vector3(30,0,-18).normalize().multiplyScalar(framing.right));
      look.y+=framing.up;
    }
    closeFlight.current={start:performance.now(),from:camera.position.clone(),target:c.target.clone(),zoom:camera.zoom,to:closeup?look.clone().add(new THREE.Vector3(18,22,30)):closeSaved.current!.position.clone(),look,endZoom,returning:!closeup};
    c.enableDamping=false;c.enabled=false;flight.current=0;
  },[closeup,camera,size.width,size.height]);
  useEffect(() => { flight.current = selected ? 2.5 : 0; }, [selected]);
  const zoom = overview ? Math.min(size.height / (depth * .9 + width * .5), size.width / (width + depth * .65)) * 1.3 : Math.max(1.5, Math.min(size.height / Math.min(depth * .95, 115), size.width / (width * 1.16)));
  const resetZoom = useRef(zoom);
  resetZoom.current = zoom;
  useEffect(() => { if (camera instanceof THREE.OrthographicCamera) { camera.zoom = zoom; camera.updateProjectionMatrix(); } }, [camera, zoom]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    flight.current = 0;
    closeSaved.current=null; closeFlight.current=null; c.enabled=!cinematic;
    // Drain residual drag momentum before restoring the view.
    c.enableDamping = false;
    c.update();
    c.target.set(0, 0, overview ? centerZ : -3);
    camera.position.set(52, 64, overview ? centerZ + 76 : 73);
    if (camera instanceof THREE.OrthographicCamera) { camera.zoom = resetZoom.current; camera.updateProjectionMatrix(); }
    c.update();
    c.enableDamping = true;
  }, [resetView, camera, centerZ, overview]);
  useFrame((_, dt) => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const c = controls.current;
    if (!c) return;
    const detail=closeFlight.current;
    if(detail && !cinematic && camera instanceof THREE.OrthographicCamera){
      const t=matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,(performance.now()-detail.start)/450),ease=t*t*(3-2*t);
      camera.position.lerpVectors(detail.from,detail.to,ease);c.target.lerpVectors(detail.target,detail.look,ease);camera.zoom=THREE.MathUtils.lerp(detail.zoom,detail.endZoom,ease);camera.updateProjectionMatrix();c.update();
      if(t===1){closeFlight.current=null;c.enableDamping=true;c.enabled=true;if(detail.returning){closeSaved.current=null;c.maxZoom=40;}performance.mark(detail.returning?'location-returned':'location-ready');}
      return;
    }
    if(closeup && !cinematic){flight.current=0;c.update();return;}
    const transition = cinematicFlight.current;
    if ((cinematic || transition) && camera instanceof THREE.OrthographicCamera) {
      let targetZoom = camera.zoom;
      if (transition?.returning && saved.current) {
        desired.copy(saved.current.target); endPosition.copy(saved.current.position); targetZoom = saved.current.zoom;
      } else {
        const actor = scene.getObjectByName(cinematic === 'mayor' ? 'mayor_statue' : `villager:${currentUser}`);
        if (!actor) return;
        actor.getWorldPosition(desired); desired.y += cinematic === 'mayor' ? -1 : 1;
        targetZoom = cinematic === 'mayor'
          ? Math.min(100, size.height / (size.width < 700 ? 10 : 8))
          : Math.min(115, size.height / (size.width < 700 ? 8 : 5));
        // Put the character left of the desktop conversation, above the mobile sheet.
        if (size.width < 700) desired.y -= size.height / targetZoom * .20;
        else { desired.x += size.width / targetZoom * .15; desired.z -= size.width / targetZoom * .10; }
        endPosition.copy(desired).add(cinematic === 'mayor' ? shift.set(5,6,8) : shift.set(26,22,38));
      }
      const t = transition ? (reduced ? 1 : Math.min(1,(performance.now()-transition.start)/300)) : 1;
      const eased = t*t*(3-2*t);
      if (transition) {
        camera.position.lerpVectors(transition.from,endPosition,eased); c.target.lerpVectors(transition.target,desired,eased);
        camera.zoom = THREE.MathUtils.lerp(transition.zoom,targetZoom,eased);
      } else { camera.position.copy(endPosition); c.target.copy(desired); camera.zoom = targetZoom; }
      camera.updateProjectionMatrix(); c.update();
      if (transition && t === 1) {
        performance.mark(transition.returning ? 'scene-returned' : 'scene-ready');
        cinematicFlight.current = null;
        if (transition.returning) { saved.current = null; c.enableDamping = true; c.enabled = true; c.maxZoom = 40; }
      }
      return;
    }
    if (camera instanceof THREE.OrthographicCamera) {
      const next = camera.zoom / resetZoom.current > (zoomed.current ? 1.3 : 1.45);
      if (next !== zoomed.current) { zoomed.current = next; onZoomChange?.(next); }
    }
    const following = !!player?.active && player.follow && !player.dragging;
    if ((following || flight.current > 0) && !interacting.current) {
      const person = scene.getObjectByName(`villager:${following ? currentUser : selected}`);
      if (person) {
        person.getWorldPosition(desired); desired.y = 0;
        desired.x = THREE.MathUtils.clamp(desired.x, -width / 2, width / 2); desired.z = THREE.MathUtils.clamp(desired.z, centerZ-depth / 2, centerZ+depth / 2);
        shift.copy(desired).sub(c.target).multiplyScalar(reduced ? 1 : 1 - Math.exp(-dt * 3));
        c.target.add(shift); camera.position.add(shift);
      }
      flight.current -= dt;
    }
    c.autoRotate = false;
    c.update();
    desired.copy(c.target); desired.x = THREE.MathUtils.clamp(desired.x, -width/2 + 8, width/2 - 8); desired.z = THREE.MathUtils.clamp(desired.z, centerZ-depth/2 + 8, centerZ+depth/2 - 8);
    shift.copy(desired).sub(c.target); c.target.add(shift); camera.position.add(shift);
    const forward = desired.copy(c.target).sub(camera.position).setY(0).normalize();
    sound.ambience.setListener([c.target.x,c.target.y,c.target.z], camera instanceof THREE.OrthographicCamera ? camera.zoom/resetZoom.current : 1, [forward.x,0,forward.z]);
  });
  return <OrbitControls ref={controls} enabled={!cinematic} makeDefault enablePan screenSpacePanning={false} zoomToCursor mouseButtons={{LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE}} touches={{ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE}} enableDamping dampingFactor={.08} autoRotateSpeed={.12}
    minZoom={Math.min(size.height / (depth + 45), size.width / (width + 45)) * .7} maxZoom={cinematic || saved.current || closeup || closeSaved.current ? 140 : 40} zoomSpeed={.6} minPolarAngle={.4} maxPolarAngle={1.12}
    onStart={() => { interacting.current = true; flight.current = 0; }} onEnd={() => { interacting.current = false; }} />;
}

export function PerformanceGovernor({ closeup=false, onReduced }: { closeup?:boolean; onReduced: () => void }) {
  const { setDpr, gl } = useThree();
  const shadowElapsed = useRef(1);
  useEffect(() => {
    const previous = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    return () => { gl.shadowMap.autoUpdate = previous; };
  }, [gl]);
  const sample = useRef(qualityWindow(lowQuality(navigator.hardwareConcurrency, window.location.search)));
  useEffect(() => { if (sample.current.reduced && !closeup) { setDpr(1); gl.shadowMap.enabled = false; onReduced(); } }, [setDpr, gl, onReduced, closeup]);
  useFrame((_, dt) => {
    // Buildings are static and villagers move slowly: refresh their shadows at
    // 20 Hz while camera motion and character animation stay at display cadence.
    shadowElapsed.current += dt;
    if (shadowElapsed.current >= .05) {
      gl.shadowMap.needsUpdate = true;
      shadowElapsed.current = 0;
    }
    if (!closeup && sample.current.sample(dt, document.hidden)) {
      setDpr(1); gl.shadowMap.enabled = false; onReduced();
    }
  });
  return null;
}
