import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OptionalModel } from './OptionalModel';
import { isUnlocked, seededRandom, townLayout, type WorldState } from './worldTypes';

type Point = [number, number, number];
function Block({ p = [0, 0, 0], s, color = '#bd9671' }: { p?: Point; s: Point; color?: string }) {
  return <mesh position={p}><boxGeometry args={s} /><meshStandardMaterial color={color} roughness={.85} /></mesh>;
}
function Prop({ name, p, size, children, animate }: { name: string; p: Point; size: number; children: ReactNode; animate?: (model: THREE.Object3D, time: number) => void }) {
  return <group position={p}><OptionalModel name={name} size={size} hero={false} animate={animate}>{children}</OptionalModel></group>;
}
function Bench() { return <><Block p={[0, .48, 0]} s={[1.8, .16, .65]} /><Block p={[0, .83, -.3]} s={[1.8, .55, .12]} />{[-.65, .65].map(x => <Block key={x} p={[x, .2, 0]} s={[.12, .4, .6]} color="#6a7463" />)}</>; }
export function Backyard() {
  return <Prop name="house_backyard" p={[0, 0, -2.3]} size={3}><Block p={[0, .35, -1]} s={[3, .65, .1]} color="#e3ce9d" />{[-1.5, 1.5].map(x => <Block key={x} p={[x, .35, 0]} s={[.1, .65, 2]} color="#e3ce9d" />)}<Block p={[.7, .4, -.4]} s={[.8, .8, .9]} color="#b47e5b" /></Prop>;
}
export function Wheel() {
  const wheel = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (wheel.current) wheel.current.rotation.z += Math.min(dt, .05) * .12; });
  return <><Block p={[0, 2.1, 0]} s={[.35, 4.2, .5]} color="#829d98" /><group ref={wheel} position={[0, 3.1, .3]}>
    <mesh><torusGeometry args={[2.5, .1, 5, 32]} /><meshStandardMaterial color="#e8c67d" /></mesh>
    {Array.from({length: 10}, (_, i) => <group key={i} rotation={[0, 0, i * Math.PI / 5]}><Block p={[0, 1.25, 0]} s={[.055, 2.5, .055]} color="#ebe1bd" /><mesh position={[0, 2.5, 0]}><sphereGeometry args={[.28, 8, 5]} /><meshStandardMaterial color={i % 2 ? '#ce887f' : '#9dbfb4'} /></mesh></group>)}
  </group></>;
}
const spinWheel = (model: THREE.Object3D, time: number) => { const wheel = model.getObjectByName('wheel'); if (wheel) wheel.rotation.z = time * .12; };
const pulseWater = (model: THREE.Object3D, time: number) => { const water = model.getObjectByName('water'); if (water) water.scale.y = 1 + Math.sin(time * 3) * .08; };
const pulseFire = (model: THREE.Object3D, time: number) => { const fire = model.getObjectByName('fire'); if (fire) fire.scale.y = 1 + Math.sin(time * 13) * .15; };
const moveLamps = (model: THREE.Object3D, time: number) => { for (let i = 0; i < 4; i++) { const lamp = model.getObjectByName(`lamp_${i}`); if (lamp) lamp.rotation.x = Math.sin(time * .7 + i) * .5; } };
export function Glow({ night, reduced }: { night: boolean; reduced: boolean }) {
  const lights = useRef<THREE.Group>(null);
  useFrame(({clock}) => { if (lights.current) lights.current.rotation.y = Math.sin(clock.elapsedTime * .3) * .18; });
  return <group ref={lights}>
    {Array.from({length: 12}, (_, i) => <mesh key={i} position={[-5 + i * .9, 3 - Math.sin(i / 11 * Math.PI) * .5, 2]}>
      <sphereGeometry args={[.09, 6, 4]} /><meshStandardMaterial color="#ffe7a1" emissive="#ffcc73" emissiveIntensity={night ? 3 : .2} toneMapped={false} />
    </mesh>)}
    {night && !reduced && [-2, 2].map((x, i) => <group key={x} position={[x, 2.4, 0]}>
      <pointLight color={i ? '#ed96ca' : '#89cfe5'} intensity={14} distance={9} decay={2} />
      <mesh position={[0, -.8, .8]} rotation={[.5, 0, 0]}><coneGeometry args={[1.1, 3, 16, 1, true]} /><meshBasicMaterial color={i ? '#ed96ca' : '#89cfe5'} transparent opacity={.08} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} /></mesh>
    </group>)}
  </group>;
}
export function Fountain() {
  const spray = useRef<THREE.Group>(null);
  useFrame(({clock}) => { if (spray.current) spray.current.scale.y = 1 + Math.sin(clock.elapsedTime * 3) * .12; });
  return <><mesh position={[0, .2, 0]}><cylinderGeometry args={[1.35, 1.45, .4, 16]} /><meshStandardMaterial color="#c8cbb5" /></mesh><mesh position={[0, .42, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.2, 24]} /><meshStandardMaterial color="#8ac6cf" metalness={.3} roughness={.25} /></mesh><group ref={spray}><mesh position={[0, 1, 0]}><cylinderGeometry args={[.05, .15, 1.3, 8]} /><meshStandardMaterial color="#c0e4df" emissive="#79b5bd" emissiveIntensity={.25} /></mesh></group></>;
}
function Fire() {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({clock}) => { if (flame.current) flame.current.scale.y = .9 + Math.sin(clock.elapsedTime * 12) * .13; });
  return <><Block p={[0, .12, 0]} s={[1.2, .22, .4]} color="#80694f" /><mesh ref={flame} position={[0, .55, 0]}><coneGeometry args={[.35, .85, 7]} /><meshStandardMaterial color="#ffc165" emissive="#ff8838" emissiveIntensity={2} toneMapped={false} /></mesh></>;
}
function Ambient({ seed, reduced, rain }: { seed: number; reduced: boolean; rain: boolean }) {
  const flock = useRef<THREE.Group>(null), drops = useRef<THREE.Points>(null);
  const positions = useMemo(() => { const r = seededRandom(seed); return new Float32Array(Array.from({length: 360}, (_, i) => i % 3 === 1 ? r() * 14 : (r() - .5) * 36)); }, [seed]);
  useFrame(({clock}, dt) => {
    if (flock.current) { flock.current.rotation.y += Math.min(dt, .05) * .06; flock.current.position.y = Math.sin(clock.elapsedTime) * .2; }
    if (drops.current) drops.current.position.y = -(clock.elapsedTime * 6 % 8);
  });
  return <><group ref={flock}>{Array.from({length: reduced ? 2 : 6}, (_, i) => <Prop key={i} name={i % 2 ? 'butterfly' : 'bird'} p={[Math.cos(i * 2.4) * 12, i % 2 ? 1.8 : 6, Math.sin(i * 2.4) * 10]} size={i % 2 ? .3 : .5}
    animate={(model, t) => { for (const side of ['l', 'r']) { const wing = model.getObjectByName(`wing_${side}`); if (wing) wing.rotation.z = Math.sin(t * 9) * .6 * (side === 'l' ? 1 : -1); } }}>
    <mesh rotation={[0, 0, .3]}><coneGeometry args={[.2, .5, 3]} /><meshStandardMaterial color={i % 2 ? '#efb67d' : '#ece4d3'} side={THREE.DoubleSide} /></mesh>
  </Prop>)}</group>{rain && !reduced && <points ref={drops}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#bcced4" size={.08} transparent opacity={.65} /></points>}</>;
}
export function TownDistricts({ seed, world, night, reduced }: { seed: number; world: WorldState; night: boolean; reduced: boolean }) {
  const layout = useMemo(() => townLayout(seed), [seed]);
  return <>
    <group position={[layout.festival[0], .06, layout.festival[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[5.2, 32]} /><meshStandardMaterial color="#c8b58b" /></mesh>
      <Prop name="festival_main_stage" p={[0, 0, -1]} size={3.5}><Block p={[0, .35, -1]} s={[4, .7, 2.6]} color="#9d7960" /></Prop>
      <Prop name="stage_lights" p={[0, 0, -2]} size={5} animate={moveLamps}><Block p={[0, 3, 0]} s={[4.8, .15, .15]} color="#616d69" />{[-2.3, 2.3].map(x => <Block key={x} p={[x, 1.5, 0]} s={[.12, 3, .12]} color="#616d69" />)}</Prop>
      {[-2.6, 2.6].map(x => <Prop key={x} name="speaker_stack" p={[x, 0, -1]} size={1.8}><Block p={[0, .9, 0]} s={[.7, 1.8, .65]} color="#4f5555" /></Prop>)}
      <Prop name="food_truck" p={[-3.5, 0, 2.8]} size={2.8}><Block p={[0, .9, 0]} s={[2.5, 1.4, 1.3]} color="#deae78" /><Block p={[0, 1.3, .68]} s={[1.5, .5, .05]} color="#779aa0" /></Prop>
      <Prop name="tent_merch" p={[3.2, 0, 2.8]} size={2.4}><mesh position={[0, 1.5, 0]}><coneGeometry args={[1.5, 1.4, 4]} /><meshStandardMaterial color="#b593b0" /></mesh><Block p={[0, .4, 0]} s={[1.8, .8, 1.3]} color="#eddbb5" /></Prop>
      {isUnlocked(world, 'ferris_wheel')
        ? <Prop name="ferris_wheel" p={[3, 0, -4]} size={5.8} animate={spinWheel}><Wheel /></Prop>
        : <group name="construction:ferris_wheel" position={[3, 0, -4]}><Prop name="fence" p={[0, 0, 0]} size={2.5}><Block p={[0, .4, 0]} s={[2.4, .8, .1]} color="#b38b5d" /></Prop><Block p={[0, .15, .6]} s={[1.6, .3, 1]} color="#c9a46a" /></group>}
      <Glow night={night} reduced={reduced} />
      <Prop name="banner_flag" p={[-4, 0, -2]} size={2.5}><Block p={[0, 1.2, 0]} s={[.07, 2.4, .07]} /><Block p={[.4, 2, 0]} s={[.8, .45, .03]} color="#d29991" /></Prop>
      <Prop name="hay_bale" p={[-3, 0, 4]} size={1}><Block p={[0, .3, 0]} s={[1, .6, .7]} color="#d7ba72" /></Prop>
    </group>
    <group position={[layout.park[0], .06, layout.park[1]]}>
      <Prop name="fountain" p={[0, 0, 0]} size={2.8} animate={pulseWater}><Fountain /></Prop>
      {[-1, 0, 1].map(i => <Prop key={i} name="bench" p={[-2, 0, i * 1.8]} size={1.8}><Bench /></Prop>)}
      <Prop name="picnic_table" p={[2.5, 0, 1]} size={2}><Block p={[0, .8, 0]} s={[2, .14, 1]} /><Block p={[0, .4, 0]} s={[.2, .8, .8]} /></Prop>
      {[0, 1, 2].map(i => <Prop key={i} name="garden_plot" p={[-1 + i * 1.5, 0, 3]} size={1.2}><Block p={[0, .1, 0]} s={[1.2, .2, 1]} color="#9b8060" />{[-.3, .3].map(x => <Block key={x} p={[x, .3, 0]} s={[.2, .25, .8]} color="#86a074" />)}</Prop>)}
      <Prop name="campfire" p={[2.5, 0, -2]} size={1.3} animate={pulseFire}><Fire /></Prop>
      <Prop name="well" p={[-3, 0, -3]} size={1.4}><mesh position={[0, .4, 0]}><cylinderGeometry args={[.6, .6, .8, 8, 1, true]} /><meshStandardMaterial color="#abae99" side={THREE.DoubleSide} /></mesh></Prop>
    </group>
    <group position={[layout.lake[0], .08, layout.lake[1]]}>
      <Prop name="lake_patch" p={[0, 0, 0]} size={7}><mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.3, .8, 1]}><circleGeometry args={[3, 32]} /><meshStandardMaterial color="#7cb8be" roughness={.22} metalness={.2} /></mesh></Prop>
      <Prop name="bridge" p={[0, .12, 0]} size={5}><Block p={[0, .2, 0]} s={[1.6, .3, 5]} />{[-.8, .8].map(x => <Block key={x} p={[x, .65, 0]} s={[.1, .1, 5]} color="#e7d7ab" />)}</Prop>
    </group>
    <group position={[layout.shelter[0], .06, layout.shelter[1]]} name={isUnlocked(world, 'pet_shelter') ? 'unlocked:pet_shelter' : 'construction:pet_shelter'}>
      {isUnlocked(world, 'pet_shelter') ? <Prop name="pet_shelter" p={[0, 0, 0]} size={3.5}><Block p={[0, 1, 0]} s={[3, 2, 2.4]} color="#dccca2" /><mesh position={[0, 2.3, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[2.3, 1.2, 4]} /><meshStandardMaterial color="#869f98" /></mesh></Prop> : <><Block p={[0, .08, 0]} s={[3.5, .15, 3]} color="#c6b291" />{[-1.7, 1.7].map(x => <Block key={x} p={[x, .6, 0]} s={[.12, 1.2, 3]} color="#d5af64" />)}<Block p={[0, .6, 1.5]} s={[3.5, .15, .12]} color="#d5af64" /></>}
    </group>
    <Prop name="mailbox" p={[-5, 0, -6]} size={1}><Block p={[0, .5, 0]} s={[.1, 1, .1]} /><Block p={[0, 1, 0]} s={[.5, .3, .4]} color="#99aaa0" /></Prop>
    <Prop name="signpost" p={[1.5, 0, 6]} size={1.7}><Block p={[0, .8, 0]} s={[.12, 1.6, .12]} /><Block p={[0, 1.4, 0]} s={[1.2, .3, .1]} /></Prop>
    <Ambient seed={seed} reduced={reduced} rain={world.weather === 'rain'} />
  </>;
}
