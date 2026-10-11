import { townLive } from '../api/townLive';
import { barks } from '../sound/VoiceBarks';
import { actionBark, type BarkTrigger } from '../sound/barks';
import { locateBark } from './barkSpatial';
import { WalkingFocus } from './WalkingFocus';
import { avatarScreenBounds } from './avatarFocusGeometry';
import { LocationCloseup } from '../components/LocationCloseup';
import { LocationContext, useLocationClick, type LocationSpot, type LocationPerson } from './locationCloseup';
import { LocationPresence } from './LocationPresence';
import { assignCafeSeats, cafeTime, CAFE_SEATS, cafeSeat } from './layout/cafeSeats';
import { assignBenchSeats, BENCH_SEATS } from './layout/benchSeats';
import { ActivityStatus, VillageIcon } from '../components/VillageIcon';
import { MayorSpeaking } from './CinematicContext';
import type { SceneKind, SceneReward } from '../components/CinematicScene';
import { emotePose } from './emotes';
import { EmoteWheel } from './EmoteWheel';
import { gamingLight } from './gamingLight';
import { workoutPose } from './workout';
import { DropHighlights } from './DropHighlights';
import { usePlayerController } from './usePlayerController';
import { playerState, dropTargets, groundRoute, TOWN_SCALE, type PlayerState, type DropTarget } from './playerControl';
import { PhotoObject } from '../components/PhotoObject';
import { activityPhase, assignStudySeats, STUDY_SEATS } from './layout/studySeats';
import { selectHouse, houseAttachment } from './houseStyles';
import {HousePaddock} from './FarmAnimals';
import {paddockLayout} from './paddock';
import { idleActivities } from '../api/idleActivity';
import { LabelSpacing } from './LabelSpacing';
import { CrowdDetail } from './CrowdDetail';
import { Portrait } from '../components/shared';
import { api } from '../api/client';
import type { HeadKind } from './headAssets';
import { GridTown, BuildingFallback } from './GridTown';
import { registry, entryFor, modelName, homeEntry } from './registry';
import { createTown, destination, entrance, type Town } from './layout/town';
import { sidewalkGraph, type Graph } from './layout/navigation';
import { TownCamera, PerformanceGovernor } from './TownCamera';
import { seededRandom, readWorld, isNight, type Activity, type WorldState } from './worldTypes';
export { seededRandom } from './worldTypes';
import { Component, Suspense, memo, useEffect, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, createPortal } from '@react-three/fiber';
import { TownLabel as Html } from './TownLabel';
import * as THREE from 'three';
import { OptionalModel } from './OptionalModel';
import { TownRenderer } from './TownRenderer';
import { lowQuality } from './quality';
import type { Village, Villager } from '../api/types';

type Point = [number, number, number];
const labelProjection = new THREE.Vector3();
function labelPosition(object: THREE.Object3D, camera: THREE.Camera, size: {width: number; height: number}): [number,number] {
  labelProjection.setFromMatrixPosition(object.matrixWorld).project(camera);
  return [Math.round((labelProjection.x+1)*size.width/2), Math.round((1-labelProjection.y)*size.height/2)];
}
function Box({ position = [0, 0, 0], size, color, rotation = [0, 0, 0] }: { position?: Point; size: Point; color: string; rotation?: Point }) {
  return <mesh position={position} rotation={rotation} receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>;
}
function Ball({ position, size, color, detail = 1 }: { position: Point; size: number; color: string; detail?: number }) {
  return <mesh position={position} castShadow><icosahedronGeometry args={[size, detail]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>;
}
const House = memo(function House({ quietLabels=false, blackout=false, gaming, yaw, person, position, inspected, onInspect, onSelect, selected }: { quietLabels?:boolean; blackout?:boolean; gaming: boolean; yaw: number; selected: boolean; onSelect: (id: string, section?: 'house') => void; person: Villager; position: [number, number]; inspected: string|null; onInspect: (id:string|null)=>void }) {
  const locationClick = useLocationClick();
  const spot:LocationSpot={id:`home:${person.user_id}`,name:`${person.display_name}'s home`,center:position};
  const house = selectHouse(person);
  const paddock = person.equipped_ids.includes('house_paddock');
  const yard = paddockLayout(house.style);
  const entry = homeEntry(person.house_level, person.house_slot, person.equipped.map(i => i.asset_key ?? i.item_id));
  return <group position={[position[0], .1, position[1]]} rotation={[0,yaw,0]} name={`home:${person.user_id}`} onClick={e => { e.stopPropagation(); locationClick(spot,()=>onSelect(person.user_id, 'house'),false,e.nativeEvent.detail>=2); }} onPointerOver={e=>{e.stopPropagation();onInspect(person.user_id);}} onPointerOut={()=>onInspect(null)}>
    {(!quietLabels || selected || inspected === person.user_id) && <Html position={[0, 4.4, 3.8]} center zIndexRange={[5, 0]} style={{pointerEvents:'none'}}><button data-photo-items={person.equipped.filter(i => i.custom && i.slot === 'decoration').map(i => i.item_id).join(',')} data-house-colors={JSON.stringify(house.colors)} data-house-model={house.model} data-house-palette={house.paletteIndex} className={`scene-label house-nameplate ${selected || inspected === person.user_id ? 'revealed' : ''}`}  style={{pointerEvents:'auto'}} aria-label={`Open ${person.display_name}'s house profile`} onClick={e => {e.stopPropagation();locationClick(spot,()=>onSelect(person.user_id, 'house'),e.detail===0,e.detail>=2);}}><Portrait person={person}/><span>{person.display_name}'s</span></button></Html>}
    {inspected===person.user_id && <Html position={[0,11,0]} center zIndexRange={[5,0]} style={{pointerEvents:'none'}}><span className="scene-label" data-testid="building-label">{person.display_name}'s home</span></Html>}
    <group position={[paddock ? yard.houseX : 0,0,0]} scale={(house.level > 3 ? 10/(entry.placement?.size??5.5) : 2.2)*(paddock ? yard.houseScale : 1)}>
    <OptionalModel batchStatic shareStaticMaterials={quietLabels} animate={(model,time) => gamingLight(model,time,gaming,blackout,matchMedia('(prefers-reduced-motion: reduce)').matches)} name={house.model} size={house.level > 3 ? entry.placement?.size??5.5 : 1} authored={house.level <= 3} colors={house.colors} surfaces={house.materials}><BuildingFallback entry={{...entry, placement:{...entry.placement,size:house.level > 3 ? entry.placement?.size : 2.8}}}/>{[-1,1].map(side => { const size = house.level > 3 ? entry.placement?.size ?? 5 : 2.8; return <mesh key={side} position={[side*size*.3,size*.3,size*.36+.08]}><boxGeometry args={[size*.22,size*.2,.02]}/><meshStandardMaterial name="glass" color="#b1d2ce"/></mesh>; })}</OptionalModel>
    {person.equipped.map(item => {
      if (item.custom && item.slot === 'decoration') return <group key={item.item_id} name={`photo-item:${item.item_id}`} position={[1.6,0,1]}><PhotoObject item={item}/></group>;
      const upgrade = entryFor(item.asset_key ?? item.item_id);
      if (!upgrade || upgrade.placement?.role !== 'attachment') return null;
      const attach = houseAttachment(house, upgrade, entry.placement?.size);
      return <group key={item.item_id} position={attach?.offset ?? [0,0,0]} rotation={attach?.rotation ?? [0,0,0]} scale={upgrade.asset?.attach?.scale ?? 1}>
        <OptionalModel name={modelName(upgrade)} size={attach.size}><BuildingFallback entry={upgrade}/></OptionalModel>
      </group>;
    })}</group>
    {gaming && !blackout && <pointLight position={[0,1.8,3]} color="#77bcff" intensity={4} distance={7}/>}
    {person.equipped.filter(i => i.slot === 'pet' && entryFor(i.item_id)?.tags?.includes('non_followable')).map(i => <group key={i.item_id} position={[2.4,0,3]}><OptionalModel name={i.asset_key??modelName(entryFor(i.item_id)!)} size={.8}><Ball position={[0,.3,0]} size={.25} color="#d3b389"/></OptionalModel></group>)}
    {paddock && <HousePaddock person={person} style={house.style}/>}
  </group>;
});
const Character = memo(function Character({ sandbox = false, quietLabels = false, closeupPriority, crowded, cinematic, sceneReward, owned, blocked, player: sharedPlayer, targets, person, selected, seed, onSelect, town, graph, world, event, studySeat, cafeIndex, benchIndex, onGaming, onShop }: { sandbox?: boolean; quietLabels?: boolean; closeupPriority: boolean; crowded: boolean; cinematic?: boolean; sceneReward?: SceneReward | null; onShop: (section?: 'farm') => void; onGaming: (id: string, active: boolean) => void; owned: boolean; blocked: boolean; player: PlayerState; targets: DropTarget[]; studySeat?: number; cafeIndex: number | null; benchIndex: number | null; town: Town; graph: Graph; world: WorldState; event: boolean; person: Villager; selected: boolean; seed: number; onSelect: (id: string) => void }) {
  const live = !sandbox && townLive.live;
  const remotePlayer = useMemo(playerState, []);
  const player = owned ? sharedPlayer : remotePlayer;
  const sending = useRef(false);
  const lastBark = useRef<BarkTrigger | null>(null);
  useEffect(() => () => barks.forget(person.user_id), [person.user_id]);
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const hipHeight = useRef(.34);
  const leftKnee = useRef<THREE.Group>(null), rightKnee = useRef<THREE.Group>(null);
  const cup = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLButtonElement>(null);
  const leftLeg = useRef<THREE.Group>(null), rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null), rightArm = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [status, setStatus] = useState(idleActivities.home);
  const lastStatus = useRef(status);
  useEffect(() => { onGaming(person.user_id, status === idleActivities.gaming); return () => onGaming(person.user_id, false); }, [person.user_id, status, onGaming]);
  const motion = useMemo(() => {
    const random = seededRandom(seed + person.house_slot * 1297);
    const home = town.homes.get(person.house_slot) ?? town.lots[0];
    const [x,z] = entrance(home);
    return { activity: 'wander' as Activity, random, x, z, tx:x, tz:z, path: [] as [number,number][], phase: random() * 10 };
  }, [seed, person.house_slot, town]);
  const control = usePlayerController(owned, blocked, motion, player, town, graph, targets, group, onShop);
  const wasControlled = useRef(false);
  const scenePoint = useRef<[number,number] | null>(null);
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useEffect(() => {
    const home = entrance(town.homes.get(person.house_slot) ?? town.lots[0]);
    scenePoint.current = cinematic ? (motion.activity === 'gaming' || Math.hypot(motion.x-home[0],motion.z-home[1]) < 1 ? home : [motion.x,motion.z]) : null;
  }, [cinematic, town, motion, person.house_slot]);
  const target = destination(town, person.house_slot, [], world, event, Date.now() / 1000, person.idle_activity ?? 'home', person.equipped.some(i => i.slot === 'pet' && entryFor(i.item_id)?.tags?.includes('followable')), studySeat, cafeIndex, benchIndex);
  useEffect(() => {
    if (live || owned && player.active) return;
    motion.activity = target.activity;
    motion.path = groundRoute(town, graph, [motion.x, motion.z], target.target);
    const next = motion.path.shift(); if (next) [motion.tx, motion.tz] = next;
  }, [graph, target.target[0], target.target[1], target.activity, motion]);
  useFrame(({ clock, camera }, rawDelta) => {
    if (cinematic && group.current && body.current) {
      const point = scenePoint.current ?? [motion.x,motion.z];
      group.current.position.set(point[0]*TOWN_SCALE,.06,point[1]*TOWN_SCALE); group.current.scale.setScalar(1);
      body.current.visible = true; body.current.scale.setScalar(1); body.current.rotation.set(0,.6,0);
      const pose = sceneReward && !reducedMotion ? emotePose('cheer',performance.now()/1000-sceneReward.start) : null;
      body.current.position.y = pose?.hop ?? 0;
      leftLeg.current?.rotation.set(0,0,0); rightLeg.current?.rotation.set(0,0,0);
      leftKnee.current?.rotation.set(0,0,0); rightKnee.current?.rotation.set(0,0,0);
      leftArm.current?.rotation.set(0,0,-(pose?.left ?? .12));
      rightArm.current?.rotation.set(reducedMotion ? 0 : -.5 + Math.sin(clock.elapsedTime*3)*.08,0,pose?.right ?? .35);
      locateBark(person.user_id, group.current, camera);
      return;
    }
    const dt = Math.min(rawDelta, 0.05), renderTime=Date.now()/1000;
    if(live && owned && !player.dragging){
      const local=townLive.world.sample(person.user_id,renderTime);
      if(local){motion.x=local.x;motion.z=local.z;}
    }
    let controlled = control.frame(dt);
    const now = performance.now();
    if(live && owned && !player.moving){
      const local=townLive.world.sample(person.user_id,renderTime);
      if(local && !['walking','idle'].includes(local.mode))sending.current=false;
    }
    if(live && owned && controlled && !player.dragging && !player.activity && !player.ride && (player.moving || sending.current)) {
      const previous=townLive.world.sample(person.user_id,renderTime);
      if(previous)townLive.world.predict({user_id:person.user_id,seq:previous.seq,since:previous.since,
        mode:player.moving?'walking':'idle',x:motion.x,z:motion.z,heading:group.current?.userData.heading??0,
        running:player.running,activity:'wander',until:townLive.world.now()+20});
    }
    if (owned) {
      const active = controlled && !player.dragging && !player.ride && !player.activity;
      const activity = player.ride || player.activity?.activity === 'dance' ? 'attraction' : player.activity?.activity === 'cafe' ? 'cafe' : null;
      if (active && player.moving) sending.current = true;
      if (sending.current) {
        const sent = townLive.publish({x: motion.x, z: motion.z, heading: group.current?.userData.heading ?? 0,
          moving: active && player.moving, running: active && !!player.running, emote: active ? player.emote?.kind ?? null : null, activity}, now);
        if (sent && !activity && (!active || (!player.moving && !player.emote))) sending.current=false;
      }
    } else if (!live) {
      const remote = sandbox ? undefined : townLive.buffer.sample(person.user_id, now);
      controlled = !!remote;
      player.active = controlled; player.moving = !!remote?.moving; player.running = !!remote?.running;
      player.emote = remote?.emote ? {kind: remote.emote, start: (remote.emoteStart+100)/1000} : null;
      player.label = remote?.moving ? 'Walking' : remote?.emote ? 'Emoting' : null;
      if (remote) {
        // Blend initial acquisition; thereafter the 100ms buffer supplies motion.
        const weight = 1-Math.exp(-dt*18);
        motion.x += (remote.x-motion.x)*weight; motion.z += (remote.z-motion.z)*weight;
        motion.tx=motion.x; motion.tz=motion.z; motion.path=[]; motion.activity='wander';
        if (group.current) group.current.userData.heading=remote.heading;
      }
    }
    const shared = live ? townLive.world.sample(person.user_id,renderTime) : undefined;
    if (live) {
      control.syncAvatar(shared);
      controlled = true; // Freeze until snapshot/reconnect; never run local autopilot in live mode.
      if (shared && !player.dragging) {
        // Prediction and the remote interpolation buffer already supply render positions.
        motion.x=shared.x;motion.z=shared.z;
        motion.tx=motion.x; motion.tz=motion.z; motion.path=[];
        motion.activity=(shared.activity ?? 'wander') as Activity;
        player.moving=shared.mode==='walking' || shared.mode==='following';
        player.active=!owned || !!shared.until; player.running=shared.running;
        player.emote=shared.emote ? {kind:shared.emote,start:performance.now()/1000-(townLive.world.now()-shared.since)} : null;
        player.label=shared.mode==='attraction' && shared.attraction_id==='ferris_wheel' ? 'Riding Ferris wheel' : null;
        player.activity=shared.attraction_id ? {id:shared.attraction_id,label:'',center:[shared.x,shared.z],point:[shared.x,shared.z],activity:motion.activity,yaw:shared.heading,elevation:shared.elevation} : null;
        if(group.current)group.current.userData.heading=shared.heading;
      } else if (!shared) { player.moving=false; motion.path=[]; motion.tx=motion.x; motion.tz=motion.z; }
    }
    if (wasControlled.current && !controlled) {
      motion.activity = target.activity;
      motion.path = groundRoute(town, graph, [motion.x,motion.z], target.target);
      const next=motion.path.shift(); if(next) [motion.tx,motion.tz]=next;
    }
    wasControlled.current = controlled;
    let dx = motion.tx - motion.x, dz = motion.tz - motion.z, distance = Math.hypot(dx, dz);
    if (!controlled && distance < .08 && motion.path.length) { [motion.tx,motion.tz] = motion.path.shift()!; dx=motion.tx-motion.x; dz=motion.tz-motion.z; distance=Math.hypot(dx,dz); }
    const enRoute = controlled ? player.moving : distance > .08 || motion.path.length > 0;
    const label = controlled && player.label ? player.label : enRoute ? 'Walking' : motion.activity === 'cafe' ? 'Caf\u00e9 - sit and sip' : motion.activity === 'gaming' ? idleActivities.gaming : motion.activity === 'workout' ? idleActivities.working_out : motion.activity === 'study' ? idleActivities.studying : motion.activity === 'dance' ? idleActivities.dancing : motion.activity === 'sit' ? idleActivities.reading : motion.activity === 'kneel' ? idleActivities.gardening : motion.activity === 'eat' ? idleActivities.food : motion.activity === 'walk_pet' ? idleActivities.walk_pet : motion.activity === 'gather' ? 'Gathering with Mayor' : idleActivities.home;
    if (lastStatus.current !== label) { lastStatus.current = label; setStatus(label); }
    const walking = controlled ? player.moving : distance > 0.08 && !hovered && !selected;
    if (walking && !controlled) { const step=Math.min(distance,dt*2.8); motion.x += dx/distance*step; motion.z += dz/distance*step; }
    if (!group.current || !body.current) return;
    if (control.anchor) { group.current.position.set(0,.1,0); group.current.scale.setScalar(1/TOWN_SCALE); }
    else { group.current.position.set(motion.x*TOWN_SCALE, 0.06+(controlled ? player.activity?.elevation ?? 0 : 0)*TOWN_SCALE, motion.z*TOWN_SCALE); group.current.scale.setScalar(1); }
    {
      const label=labelRef.current;
      if(label){ label.dataset.parent=group.current.parent?.name ?? ""; label.dataset.x=motion.x.toFixed(3); label.dataset.z=motion.z.toFixed(3); label.dataset.controlled=String(controlled); label.dataset.remote=String(!owned && controlled); label.dataset.follow=String(player.follow); if(shared){label.dataset.mode=shared.mode;label.dataset.slot=String(shared.slot??'');label.dataset.seat=shared.seat_id??'';label.dataset.since=String(shared.since);label.dataset.attraction=shared.attraction_id??'';label.dataset.seq=String(shared.seq);} }
    }
    const animationSeconds=shared ? townLive.world.now()-shared.since : clock.elapsedTime;
    const phase=animationSeconds*(controlled && player.running ? 15 : 9)+(shared ? 0 : motion.phase);
    body.current.position.y = walking ? Math.abs(Math.sin(phase)) * 0.06 : Math.sin(animationSeconds * 2 + motion.phase) * 0.018;
    if (walking) { const desired = controlled ? group.current.userData.heading ?? 0 : Math.atan2(dx, dz); const difference = Math.atan2(Math.sin(desired - body.current.rotation.y), Math.cos(desired - body.current.rotation.y)); body.current.rotation.y += difference * Math.min(1, dt * 5); }
    body.current.visible = shared ? shared.activity !== 'gaming' : controlled || enRoute || motion.activity !== 'gaming';
    if(shared && !walking)body.current.rotation.y=shared.heading;
    const studying = !enRoute && motion.activity === 'study';
    const sipping = !enRoute && !(controlled && player.dragging) && motion.activity === 'cafe';
    if (cup.current) { cup.current.visible = sipping; cup.current.position.y = .95 + Math.sin(animationSeconds * 1.3) * .1; }
    const sitting = !enRoute && !(controlled && player.dragging) && (motion.activity === 'sit' || studying || sipping);
    const kneeling = !enRoute && motion.activity === 'kneel';
    const emote = controlled && !player.dragging && player.emote ? emotePose(player.emote.kind, performance.now()/1000-player.emote.start) : null;
    body.current.rotation.x = kneeling ? .3 : !enRoute && motion.activity === 'eat' ? -.08 + Math.sin(phase * .2) * .05 : 0;
    body.current.scale.setScalar(sitting ? .7 : kneeling ? .65 : 1);
    if (kneeling) body.current.position.y = -.08;
    locateBark(person.user_id, group.current, camera, body.current.visible);
    const bark = actionBark(walking, controlled ? player.emote?.kind ?? null : null, enRoute ? '' : motion.activity, !!player.ride);
    if (bark !== lastBark.current) { lastBark.current = bark; if (bark && !sandbox) void barks.trigger(person.user_id, bark); }
    const dancing = !enRoute && motion.activity === 'dance';
    if (sitting) {
      const seatHeight = studying ? STUDY_SEATS[0].height : sipping ? CAFE_SEATS[0].height : BENCH_SEATS[0].height;
      const surface = control.anchor ? -.125*TOWN_SCALE : (.1 + seatHeight)*TOWN_SCALE - .06;
      body.current.position.y = surface - hipHeight.current*.7;
      body.current.rotation.y = (controlled ? player.activity?.yaw : target.yaw) ?? 0;
      body.current.rotation.x = 0;
      if (!controlled) { motion.x=target.target[0]; motion.z=target.target[1]; group.current.position.x=motion.x*TOWN_SCALE; group.current.position.z=motion.z*TOWN_SCALE; }
    }
    group.current.userData.activity = label;
    group.current.userData.seated = sitting;
    leftKnee.current?.rotation.set(sitting ? Math.PI/2 : 0,0,0);
    rightKnee.current?.rotation.set(sitting ? Math.PI/2 : 0,0,0);
    if (dancing) { body.current.position.y = Math.abs(Math.sin(phase * .7)) * .18; body.current.rotation.z = Math.sin(phase * .35) * .12; }
    else body.current.rotation.z = 0;
    if (controlled && player.dragging) body.current.position.y = 1.3 + Math.sin(phase)*.08;

    const swing = walking || dancing ? Math.sin(phase) * 0.5 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = sitting ? -Math.PI / 2 : swing;
    if (rightLeg.current) rightLeg.current.rotation.x = sitting ? -Math.PI / 2 : -swing;
    if (leftArm.current) leftArm.current.rotation.x = studying ? -1 + Math.sin(phase * .65) * .08 : kneeling ? -.9 : motion.activity === 'eat' && !enRoute ? -1.1 + Math.sin(phase * .2) * .15 : -swing;
    if (rightArm.current) rightArm.current.rotation.x = sipping ? -1.2 + Math.sin(animationSeconds * 1.3) * .15 : studying ? -.9 + Math.sin(phase * .3) * .13 : kneeling ? -.9 : sitting ? -.7 : swing;
    const exercise = !enRoute && motion.activity === 'workout' ? workoutPose(animationSeconds, person.house_slot) : null;
    for (const [limb, side] of [[leftArm.current,-1],[rightArm.current,1],[leftLeg.current,-1],[rightLeg.current,1]] as const) if (limb) limb.rotation.z = exercise ? side*exercise.spread*(limb === leftLeg.current || limb === rightLeg.current ? .2 : 1) : 0;
    if (emote && leftArm.current && rightArm.current) {
      leftArm.current.rotation.set(0,0,-emote.left); rightArm.current.rotation.set(0,0,emote.right);
      body.current.rotation.z = emote.lean; body.current.position.y += emote.hop;
      body.current.rotation.y = (group.current.userData.heading ?? 0) + emote.spin;
    }
    if (exercise) {
      body.current.rotation.x = exercise.tilt; body.current.position.y = exercise.y; body.current.scale.y = exercise.height;
      if (leftArm.current) leftArm.current.rotation.x = exercise.arm;
      if (rightArm.current) rightArm.current.rotation.x = exercise.arm;
      if (leftLeg.current) leftLeg.current.rotation.x = exercise.leg;
      if (rightLeg.current) rightLeg.current.rotation.x = exercise.leg;
    }
  });
  const [cosmetics, setCosmetics] = useState<string[]>([]);
  const [avatar, setAvatar] = useState(person.avatar);
  const [headKind, setHeadKind] = useState<HeadKind>('preset');
  const pollAvatar = !sandbox && (!crowded || owned || selected);
  useEffect(() => { setAvatar(current => person.avatar.revision >= current.revision ? person.avatar : current); }, [person.avatar]);
  useEffect(() => {
    if (!pollAvatar) return; // The normal village refresh supplies all other manifests.
    let active = true, busy = false;
    const poll = async () => {
      if (busy) return; busy = true;
      try { const manifest = await api.avatar(person.user_id); if (active) setAvatar(current => manifest.revision >= current.revision ? manifest : current); }
      catch { /* A temporarily unavailable manifest keeps the last working face. */ }
      finally { busy = false; }
    };
    void poll(); const timer = setInterval(() => void poll(), 30000);
    return () => { active = false; clearInterval(timer); };
  }, [person.user_id, pollAvatar]);
  const c = avatar.body.colors;
  // Geometry and material elements are intentionally per character, never shared mutable materials.
  const character = <group name={`villager:${person.user_id}`} ref={group} position={[motion.x*TOWN_SCALE, 0.06, motion.z*TOWN_SCALE]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[0.4, hovered || selected ? 0.57 : 0.44, 32]} /><meshBasicMaterial color={hovered || selected ? '#fff5c9' : '#71966c'} transparent opacity={hovered || selected ? 0.9 : 0.25} /></mesh>
    <group ref={body} onClick={e => { e.stopPropagation(); if (!control.suppressClick.current) onSelect(person.user_id); }} onPointerOver={e => { e.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}><CrowdDetail enabled={crowded} priority={closeupPriority || owned || selected || hovered || !!cinematic} shirt={c.shirt} skin={c.skin}><OptionalModel animationTime={()=>{const s=live && !cinematic ? townLive.world.avatars.get(person.user_id) : undefined;return s ? townLive.world.now()-s.since : undefined;}} emote={() => cinematic ? (sceneReward && !reducedMotion ? {kind: 'cheer', start: sceneReward.start} : null) : player.active && !player.dragging ? player.emote : null} animate={(model,time) => {
      const hips = model.getObjectByName('hips');
      if (hips && body.current && model.userData.seatHipHeight === undefined) {
        model.updateWorldMatrix(true,true);
        const box = new THREE.Box3().setFromObject(hips);
        const point = body.current.worldToLocal(new THREE.Vector3((box.min.x+box.max.x)/2,box.min.y,(box.min.z+box.max.z)/2));
        model.userData.seatHipHeight = point.y;
      }
      hipHeight.current = model.userData.seatHipHeight ?? .34;
      // Idle clips don't necessarily key every arm. Restore the talking offset
      // before each frame so it cannot accumulate or corrupt the cheer bind pose.
      for (const name of ['Arm_L','Arm_R']) {
        const arm = model.getObjectByName(name); if (!arm) continue;
        if (cinematic && !arm.userData.sceneRest) arm.userData.sceneRest = arm.quaternion.clone();
        if (arm.userData.sceneRest) arm.quaternion.copy(arm.userData.sceneRest);
        if (!cinematic) delete arm.userData.sceneRest;
      }
      if (cinematic) { if (!sceneReward) { const arm = model.getObjectByName('Arm_R'); arm?.rotateX(reducedMotion ? -.3 : -.3 + Math.sin(time*3)*.1); } return; }
      if (player.active && player.running) {
        for (const [name,side] of [['Arm_L',-1],['Arm_R',1],['Leg_L',1],['Leg_R',-1]] as const) model.getObjectByName(name)?.rotateX(Math.sin(time*15)*.35*side);
      }
      const exercise = motion.activity === 'workout' && Math.hypot(motion.tx-motion.x,motion.tz-motion.z) <= .08 && !motion.path.length ? workoutPose(time,person.house_slot) : null;
      for (const [name,side] of [['Arm_L',-1],['Arm_R',1],['Leg_L',-1],['Leg_R',1]] as const) {
        const limb = model.getObjectByName(name); if (!limb) continue;
        // Preserve the GLB bind pose (these bones point downward via a half turn).
        // The mixer resets them each frame before this procedural offset.
        if (motion.activity === 'cafe' && name === 'Arm_R' && !motion.path.length && Math.hypot(motion.tx-motion.x,motion.tz-motion.z)<.08) limb.rotation.x = Math.PI - 1.2 + Math.sin(time*1.3)*.15;
        if (exercise) {
          limb.rotateX(name.startsWith('Arm') ? exercise.arm : exercise.leg);
          limb.rotateZ(side*exercise.spread*(name.startsWith('Leg') ? .2 : 1));
        }
      }
    }} name="villager_base" size={1.8} colors={c} equipment={person.equipped} crown={person.has_crown} onCosmetics={setCosmetics} head={avatar.body} onHeadKind={setHeadKind} animation={() => cinematic ? 'idle' : (live || player.active) ? player.moving ? 'walk' : motion.activity === 'kneel' ? 'kneel' : motion.activity === 'eat' ? 'eat' : (motion.activity === 'sit' || motion.activity === 'cafe') ? 'sit' : motion.activity === 'dance' ? 'dance' : motion.activity === 'study' ? 'study' : 'idle' : Math.hypot(motion.tx - motion.x, motion.tz - motion.z) > 0.08 || motion.path.length > 0 ? (!hovered && !selected ? 'walk' : 'idle') : motion.activity === 'study' ? 'study' : (motion.activity === 'sit' || motion.activity === 'cafe') ? 'sit' : motion.activity === 'dance' ? 'dance' : 'idle'}>
      <Box position={[0, 0.68, 0]} size={[0.48, 0.55, 0.31]} color={c.shirt} />
      <group ref={leftLeg} position={[-0.14, 0.43, 0]}><Box position={[0, -.1, 0]} size={[.18,.2,.2]} color={c.pants}/><group ref={leftKnee} position={[0,-.2,0]}><Box position={[0,-.07,0]} size={[.18,.14,.2]} color={c.pants}/><Box position={[0,-.16,.045]} size={[.2,.13,.3]} color={c.shoes}/></group></group>
      <group ref={rightLeg} position={[0.14, 0.43, 0]}><Box position={[0, -.1, 0]} size={[.18,.2,.2]} color={c.pants}/><group ref={rightKnee} position={[0,-.2,0]}><Box position={[0,-.07,0]} size={[.18,.14,.2]} color={c.pants}/><Box position={[0,-.16,.045]} size={[.2,.13,.3]} color={c.shoes}/></group></group>
      <group ref={leftArm} position={[-0.32, 0.87, 0]}><Box position={[0, -0.12, 0]} size={[0.16, 0.3, 0.2]} color={c.shirt} /><Ball position={[0, -0.31, 0]} size={0.11} color={c.skin} /></group>
      <group ref={rightArm} position={[0.32, 0.87, 0]}><Box position={[0, -0.12, 0]} size={[0.16, 0.3, 0.2]} color={c.shirt} /><Ball position={[0, -0.31, 0]} size={0.11} color={c.skin} /></group>
      <Ball position={[0, 1.25, 0]} size={0.42} color={c.skin} detail={2} />
      <mesh position={[0, 1.4, -0.04]} castShadow><sphereGeometry args={[0.435, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={c.hair} /></mesh>
      <Box position={[-0.3, 1.36, 0.12]} size={[0.15, 0.25, 0.28]} color={c.hair} />
      {[-0.14, 0.14].map(x => <Ball key={x} position={[x, 1.26, 0.37]} size={0.034} color="#352d29" />)}
      <Box position={[0, 1.1, 0.4]} size={[0.08, 0.025, 0.01]} color="#835546" />
      </OptionalModel></CrowdDetail>
      <group ref={cup} name="cafe-sipping-cup" visible={false} position={[.3,.95,.4]}><mesh><cylinderGeometry args={[.105,.08,.19,10]}/><meshStandardMaterial color="#fff5e6"/></mesh><mesh position={[0,.098,0]}><cylinderGeometry args={[.087,.087,.005,10]}/><meshStandardMaterial color="#633a24"/></mesh><mesh position={[.115,0,0]}><torusGeometry args={[.06,.018,4,8]}/><meshStandardMaterial color="#fff5e6"/></mesh></group>
    </group>
    {owned && player.active && ['sit','study'].includes(motion.activity) && !player.ride && <group position={[0,.8,.45]} rotation={[-.6,0,0]}><Box size={[.48,.04,.32]} color="#f8ebcb"/><Box position={[0,.025,0]} size={[.02,.01,.32]} color="#a18162"/></group>}
    {owned && player.active && motion.activity==='eat' && <Ball position={[.22,.95,.4]} size={.12} color="#dfb269"/>}
    {owned && <WalkingFocus body={body} player={player} disabled={cinematic}/>}
    {(!quietLabels && (!sandbox || !crowded) || selected || hovered) && <Html calculatePosition={(object,camera,size) => {
      const label = labelRef.current;
      const focused = owned && player.active && !cinematic;
      if (label) { label.dataset.walkFocus = String(focused); label.dataset.moving = String(focused && player.moving); }
      const rect = focused && body.current ? avatarScreenBounds(body.current,camera,size) : null;
      if (label) { if (rect) label.dataset.avatarBounds = JSON.stringify(rect); else delete label.dataset.avatarBounds; }
      if (rect) return [(rect.left+rect.right)/2, rect.top-24];
      const [x,y]=labelPosition(object,camera,size); const home = entrance(town.homes.get(person.house_slot) ?? town.lots[0]); const atHome = !control.anchor && Math.hypot(motion.x-home[0], motion.z-home[1]) < 1; return [x,y-(control.anchor ? 80 : atHome ? 52 : (person.house_slot%5)*40)]; }} position={[0, person.has_crown ? 2.85 : 2.55, 0]} center zIndexRange={[20, 0]} style={{pointerEvents:'none'}}><button ref={labelRef} data-player={owned ? 'true' : undefined} style={{pointerEvents:'auto', touchAction: owned ? 'none' : undefined}} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} data-testid={`villager-${person.display_name}`} data-avatar-hidden={status === idleActivities.gaming} data-study-seat={status === idleActivities.studying ? (live ? townLive.world.avatars.get(person.user_id)?.slot : studySeat) : undefined} data-head-kind={headKind} data-cosmetics={cosmetics.join(" ")} title={avatar.portrait.placeholder ? 'placeholder face (CC0)' : undefined} className={`scene-label villager-label ${selected ? 'selected' : ''}`} onClick={() => { if (!control.suppressClick.current) onSelect(person.user_id); }} aria-label={`Open ${person.display_name}'s profile`}><Portrait person={person} /><span className="villager-label-text">{person.display_name}<small className="activity-badge" data-testid="activity-badge"><ActivityStatus status={status}/></small></span>{person.has_crown && <span aria-label="Weekly crown"> <VillageIcon name="crown" size={14}/></span>}{!!person.star_badges?.length && <span aria-label="Completion star"> <VillageIcon name="star" size={14}/></span>}{person.auditor && <span className="scene-auditor">Auditor &#183; sits out</span>}{person.celebrated && <span className="scene-winner">&#10022; Winner &#10022;</span>}</button></Html>}
    {cinematic && sceneReward && <Html position={[0,3,0]} center zIndexRange={[25,24]} style={{pointerEvents:'none'}}><div className="scene-reward" data-testid="scene-reward">+{sceneReward.xp} XP &middot; +{sceneReward.xp} coins</div></Html>}
    {person.goalBurst && <Html key={person.goalBurst} position={[0, 3.6, 0]} center style={{pointerEvents: 'none'}} zIndexRange={[21, 0]}><div className="goal-burst" role="status" aria-label={`${person.display_name} completed a goal`}><span>&#127881; Goal complete!</span>{Array.from({length: 10}, (_, i) => <i key={i} style={{'--angle': `${i * 36}deg`} as React.CSSProperties}>&#10022;</i>)}</div></Html>}
    {hovered && avatar.portrait.placeholder && <Html position={[0, 3.15, 0]} center style={{pointerEvents:'none'}}><span className="scene-label" role="tooltip">placeholder face (CC0)</span></Html>}
    {person.equipped.filter(item => item.slot === 'pet' && entryFor(item.item_id)?.tags?.includes('followable')).map(item => <group key={item.item_id} name={`following-pet:${item.item_id}`} position={[0.65, 0.05, -0.35]}><OptionalModel name={item.asset_key ?? modelName(entryFor(item.item_id)!)} size={0.65} animate={(model,time)=>{const bob=model.getObjectByName('idle_bob');if(bob)bob.position.y=Math.sin(time*2)*.025;}}><Box size={[0.25, 0.23, 0.45]} color="#bf9665"/><Ball position={[0, 0.17, 0.24]} size={0.18} color="#bf9665"/></OptionalModel></group>)}
    {(owned && player.active && player.activity?.activity === 'pet' && !person.equipped.some(item => item.slot === 'pet' && entryFor(item.item_id)?.tags?.includes('followable'))) && <group position={[0.65, 0.05, -0.35]}><OptionalModel name={person.equipped_ids.includes('pet_dog_b') ? 'pet_dog_b' : 'pet_dog'} size={0.65}><Box size={[0.25, 0.23, 0.45]} color="#bf9665" /><Ball position={[0, 0.17, 0.24]} size={0.18} color="#bf9665" /></OptionalModel></group>}
  </group>;
  return control.anchor && !cinematic ? createPortal(character, control.anchor) : character;
});
function World({ sandbox = false, townShape, onFps, closeup, people, onPeople, cinematic, sceneReward, village, selected, onSelect, onShop, onMayor, onGazette, onReading, onZoomChange, resetView, onReducedQuality, currentUser, controlsBlocked }: Props & {closeup:LocationSpot|null;people:LocationPerson[];onPeople:(people:LocationPerson[])=>void;resetView: number; onReducedQuality: () => void}) {
  const live = !sandbox && townLive.live;
  const [gamers, setGamers] = useState<Set<string>>(() => new Set());
  const onGaming = useCallback((id: string, active: boolean) => setGamers(previous => { if (previous.has(id) === active) return previous; const next = new Set(previous); if (active) next.add(id); else next.delete(id); return next; }), []);
  const [inspected, onInspect] = useState<string|null>(null);
  const slotKey = village.villagers.map(p => p.house_slot).sort((a,b)=>a-b).join(',');
  const town = useMemo(() => createTown(village.seed, registry, slotKey ? slotKey.split(',').map(Number) : [], sandbox ? townShape : undefined), [village.seed, slotKey, sandbox, townShape]);
  const graph = useMemo(() => sidewalkGraph(town), [town]);
  const world = useMemo(() => readWorld(village), [village.world]);
  const player = useMemo(playerState, [currentUser, village.id]);
  const own = village.villagers.find(p=>p.user_id===currentUser);
  const baseTargets = useMemo(() => own ? dropTargets(town,own.house_slot,world) : [], [town, own?.house_slot, world]);
  const targets = baseTargets.map(target=>({...target}));
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(v => v + 1), 5000); return () => clearInterval(timer); }, []);
  const now = Date.now() / 1000;
  const reserved=(activity:string,seats:readonly {offset:[number,number]}[])=>{
    if(!own || !player.active || player.activity?.activity!==activity)return;
    const target=player.activity;
    const seat=seats.findIndex(s=>Math.hypot(target.point[0]-target.center[0]-s.offset[0],target.point[1]-target.center[1]-s.offset[1])<.01);
    return seat<0?undefined:{slot:own.house_slot,seat};
  };
  const cafeSeats = assignCafeSeats(village.villagers.filter(p => cafeTime(now,p.house_slot) || p.user_id === own?.user_id).map(p=>p.house_slot),reserved('cafe',CAFE_SEATS));
  const benchSeats = assignBenchSeats(village.villagers.filter(p=>p.idle_activity==='reading' || p.user_id===own?.user_id).map(p=>p.house_slot),reserved('sit',BENCH_SEATS));
  const cafeTarget = targets.find(t=>t.id==='storefront_cafe');
  if(!live && cafeTarget && own) { const i=cafeSeats.get(own.house_slot); if(i===undefined) targets.splice(targets.indexOf(cafeTarget),1); else { const seat=cafeSeat(cafeTarget.center,i); cafeTarget.point=seat.target; cafeTarget.yaw=seat.yaw; } }
  const benchTarget = targets.find(t=>t.id==='fountain');
  if(!live && benchTarget && own) { const i=benchSeats.get(own.house_slot); if(i===undefined) targets.splice(targets.indexOf(benchTarget),1); else { const seat=BENCH_SEATS[i]; benchTarget.point=[benchTarget.center[0]+seat.offset[0],benchTarget.center[1]+seat.offset[1]]; benchTarget.yaw=seat.yaw; } }
  const studySeats = assignStudySeats(village.villagers.filter(p => p.user_id === own?.user_id || p.idle_activity === 'studying' && activityPhase(now, p.house_slot) < 510).map(p => p.house_slot),reserved('study',STUDY_SEATS));
  const studyTarget=targets.find(t=>t.id==='study_nook');
  if(!live && studyTarget && own){
    const index=studySeats.get(own.house_slot),seat=index===undefined?undefined:STUDY_SEATS[index];
    if(seat){studyTarget.point=[studyTarget.center[0]+seat.offset[0],studyTarget.center[1]+seat.offset[1]];studyTarget.yaw=seat.yaw;}
    else targets.splice(targets.indexOf(studyTarget),1);
  }
  const gate=targets.find(t=>t.id==='colosseum');
  const night = isNight(world);
  const [reduced, setReduced] = useState(() => lowQuality(navigator.hardwareConcurrency, window.location.search));
  const reduce = useCallback(() => { setReduced(true); onReducedQuality(); }, [onReducedQuality]);
  const event = village.active_events.some(e => e.status === 'active' && (!e.ends_at || Date.parse(e.ends_at) > Date.now()));
  const sky = world.disaster?.kind === 'blackout' ? '#59677e' : night ? '#a3afc6' : world.weather === 'fog' ? '#bdc9c4' : '#c5cfca';
  return <>
    <FrameRate onFps={onFps}/><TownRenderer low={reduced}/><LabelSpacing/><LocationPresence spot={closeup} onPeople={onPeople}/>
    {gate && <group scale={TOWN_SCALE} position={[gate.center[0]*TOWN_SCALE,0,gate.center[1]*TOWN_SCALE]} name="colosseum-entrance">
      <Box position={[-2,1.7,0]} size={[.7,3.4,.8]} color="#d7c4a6"/><Box position={[2,1.7,0]} size={[.7,3.4,.8]} color="#d7c4a6"/><Box position={[0,3.4,0]} size={[4.7,.6,.8]} color="#d7c4a6"/>
      <Html position={[0,4,0]} center style={{pointerEvents:'none'}}><span className="scene-label">Colosseum entrance</span></Html>
    </group>}
    <DropHighlights targets={targets} player={player}/><TownCamera overview={sandbox && townShape === 'lab-square'} closeup={closeup} cinematic={cinematic} onZoomChange={onZoomChange} player={player} currentUser={currentUser} resetView={resetView} selected={selected} width={town.width*TOWN_SCALE} depth={town.depth*TOWN_SCALE} centerZ={(town.roadsZ[0]+town.roadsZ.at(-1)!)/2*TOWN_SCALE}/><PerformanceGovernor closeup={!!closeup} onReduced={reduce}/>
    <color attach="background" args={[sky]}/><fog attach="fog" args={[sky, world.weather === 'fog' ? 85 : 130, 280]}/>
    <ambientLight intensity={night ? .7 : 1.35}/><hemisphereLight args={[night ? '#9eb5e1' : '#fff5df', '#829279', night ? .85 : 1.7]}/>
    <directionalLight position={[-35,80,40]} intensity={night ? .8 : 2.4} color={night ? '#a5bdf5' : '#fff0d2'} castShadow={!reduced} shadow-mapSize={[1024,1024]} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-normalBias={.08}/>
    <group scale={TOWN_SCALE}><MayorSpeaking.Provider value={cinematic === 'mayor'}><GridTown onReading={onReading} petCount={village.villagers.reduce((n,p)=>n+p.equipped.filter(i=>i.slot==='pet').length,0)} inspected={inspected} onInspect={onInspect} town={town} world={world} night={night} reduced={reduced} onMayor={onMayor} onGazette={onGazette} onShop={onShop}/></MayorSpeaking.Provider>
    {village.villagers.map(person => <House quietLabels={sandbox} blackout={world.disaster?.kind==='blackout'} gaming={gamers.has(person.user_id)} selected={selected === person.user_id} onSelect={onSelect} inspected={inspected} onInspect={onInspect} key={person.user_id} person={person} position={town.homes.get(person.house_slot)!.center} yaw={town.homes.get(person.house_slot)!.yaw}/>)}</group>
    {village.villagers.map(person => <Character sandbox={sandbox} quietLabels={sandbox && townShape === 'lab-square'} closeupPriority={!!closeup && people.some(p=>p.id===person.user_id)} crowded={village.villagers.length > 25} cinematic={cinematic === 'checkin' && person.user_id === currentUser} sceneReward={sceneReward} onShop={onShop} owned={person.user_id === currentUser} blocked={!!controlsBlocked} player={player} targets={targets} onGaming={onGaming} cafeIndex={cafeSeats.get(person.house_slot) ?? null} benchIndex={benchSeats.get(person.house_slot) ?? null} studySeat={studySeats.get(person.house_slot)} key={person.user_id} person={person} selected={selected === person.user_id} seed={village.seed} town={town} graph={graph} world={world} event={event} onSelect={onSelect}/>)}
  </>;
}

type Props = { townShape?: 'lab-square'; sandbox?: boolean; onFps?: (fps: number) => void; onLocationOpen?:()=>void; cinematic?: SceneKind | null; sceneReward?: SceneReward | null; currentUser?: string; controlsBlocked?: boolean; onZoomChange?: (zoomed: boolean) => void; paused?: boolean; village: Village; selected: string | null; onSelect: (id: string, section?: 'house') => void; onShop: (section?: 'farm') => void; onMayor: () => void; onGazette: () => void; onReading: () => void };
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-fallback">The 3D view needs WebGL. You can still visit profiles and check in using the village controls.</div> : this.props.children; }
}
function FrameRate({onFps}: {onFps?: (fps: number) => void}) {
  const sample = useRef({start: 0, frames: 0});
  useFrame(({clock}) => {
    if (!onFps) return;
    const s = sample.current; s.frames++;
    if (clock.elapsedTime - s.start >= 1) {
      onFps(Math.round(s.frames / (clock.elapsedTime - s.start)));
      s.start = clock.elapsedTime; s.frames = 0;
    }
  });
  return null;
}
export function VillageScene(props: Props) {
  const [closeup,setCloseup] = useState<LocationSpot|null>(null);
  const [people,setPeople] = useState<LocationPerson[]>([]);
  const back = useCallback(()=>setCloseup(null),[]);
  const location = useMemo(()=>({active:closeup?.id??null,close:back,open:(spot:LocationSpot)=>{props.onLocationOpen?.();setPeople([]);setCloseup(spot);}}),[closeup?.id,back,props.onLocationOpen]);
  useEffect(()=>{setCloseup(null);},[props.village.id,props.cinematic,props.paused]);
  useEffect(()=>{if(!closeup)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();back();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[closeup,back]);
  const [reset, setReset] = useState(0);
  const [qualityReduced, setQualityReduced] = useState(() => lowQuality(navigator.hardwareConcurrency, window.location.search));
  const reduceQuality = useCallback(() => setQualityReduced(true), []);
  const [hint, setHint] = useState(() => { try { return !localStorage.getItem('village:walk-hint'); } catch { return true; } });
  useEffect(() => {
    const select=()=>{if(props.currentUser)props.onSelect(props.currentUser);};
    const canvas=document.querySelector('.scene canvas');canvas?.addEventListener('village-player-select',select);
    return ()=>canvas?.removeEventListener('village-player-select',select);
  },[props.currentUser,props.onSelect]);
  const [ready, setReady] = useState(false);
  const gesture = useRef({x: 0, y: 0, dragged: false, pointers: new Set<number>()});
  useEffect(() => { const timer = setTimeout(() => setReady(true), 100); return () => clearTimeout(timer); }, []);
  return <LocationContext.Provider value={location}><div className="scene" data-testid="village-scene" data-ready={ready} data-quality={qualityReduced ? 'low' : 'normal'} data-dense-labels={props.village.villagers.length > 10}
    onPointerDownCapture={e => { const g = gesture.current; if (!g.pointers.size) { g.x = e.clientX; g.y = e.clientY; g.dragged = false; } g.pointers.add(e.pointerId); if (g.pointers.size > 1) g.dragged = true; }}
    onPointerMoveCapture={e => { const g = gesture.current; if (g.pointers.size && Math.hypot(e.clientX-g.x, e.clientY-g.y) > 5) g.dragged = true; }}
    onPointerUpCapture={e => gesture.current.pointers.delete(e.pointerId)}
    onPointerCancelCapture={e => gesture.current.pointers.delete(e.pointerId)}
    onClickCapture={e => { if (gesture.current.dragged && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); } }}>
    <SceneBoundary><Canvas onPointerMissed={e=>{if(e.type==='click' && e.target instanceof HTMLCanvasElement && !gesture.current.dragged)back();}} frameloop={props.paused ? 'never' : 'always'} shadows={qualityReduced ? false : "soft"} orthographic camera={{ position: [52, 64, 76], zoom: 7, near: 0.1, far: 600 }} dpr={closeup ? 2 : qualityReduced ? 1 : [1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}><Suspense fallback={null}><World {...props} closeup={closeup} people={people} onPeople={setPeople} resetView={reset} onReducedQuality={reduceQuality} /></Suspense></Canvas></SceneBoundary>
    {closeup && <LocationCloseup spot={closeup} people={people} villagers={props.village.villagers} onBack={back} onSelect={props.onSelect}/>}
    {props.currentUser && <EmoteWheel disabled={!!props.cinematic} villagers={props.village.villagers.filter(p=>p.user_id!==props.currentUser).map(p=>({id:p.user_id,name:p.display_name}))} />}
    {hint && !props.sandbox && <div className="player-hint" role="status"><span>WASD to walk &middot; Shift to run &middot; Space / 1 wave &middot; 2 cheer &middot; 3 spin &middot; Shift+C to follow &middot; C to check in<br/>Hold your villager and drop onto an attraction</span><button aria-label="Dismiss walking hint" onClick={()=>{setHint(false);try{localStorage.setItem('village:walk-hint','1');}catch{}}}>&times;</button></div>}
    <div className="camera-hint"><span>Drag to pan &middot; Right-drag to rotate · Scroll to zoom</span><button onClick={() => {back();setReset(v => v + 1);}} aria-label="Reset camera" title="Reset view">↺</button></div>
  </div></LocationContext.Provider>;
}
