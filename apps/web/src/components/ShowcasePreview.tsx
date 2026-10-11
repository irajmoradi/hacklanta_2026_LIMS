import { HousePaddock } from '../scene/FarmAnimals';
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import { paintOutfitPreview } from './previewColors';
import { PreviewMotion } from './previewMotion';
import { Box3, Box3Helper, Group, Mesh, Object3D, Color } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { EquippedItem, Villager } from '../api/types';
import { OptionalModel, cloneModel } from '../scene/OptionalModel';
import { selectHouse } from '../scene/houseStyles';
import { mediaUrl } from './shared';
import { PhotoObject } from './PhotoObject';

class Boundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <p>3D preview unavailable. Explore the item tiles below.</p> : this.props.children; }
}


function Selection({root, selected}: {root: React.RefObject<Group>; selected: string | null}) {
  const box = useRef<Box3Helper>(null);
  const scene = useThree(state => state.scene);
  useFrame(() => {
    if (!box.current) return;
    const target = selected && root.current?.getObjectByName(`cosmetic:${selected}`);
    box.current.visible = !!target;
    if (target) box.current.box.setFromObject(target);
  });
  return createPortal(<box3Helper ref={box} args={[new Box3(), new Color('#ffe3a1')]} visible={false}/>, scene);
}

function Model({person, house, selected, liveColors}: {person: Villager; house: boolean; selected: string | null; liveColors?: React.MutableRefObject<EquippedItem[]>}) {
  const root = useRef<Group>(null);
  const frames = useRef(0);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  useFrame(({gl, clock}) => {
    if (liveColors && root.current) paintOutfitPreview(root.current, liveColors.current);
    if (++frames.current > 2) gl.domElement.dataset.rendered = 'true';
    if (root.current && !house && !reduced) root.current.position.y = -.9 + Math.sin(clock.elapsedTime * 1.8) * .012;
  });
  const home = selectHouse(person);
  const decorations = person.equipped.filter(i => i.slot === 'decoration' || (i.slot === 'house' && i.item_id === 'house_backyard'));
  return <>
    <group ref={root} position={[0,-.9,0]}>
      {house ? <>
        <group name={`cosmetic:${person.equipped.find(i => i.slot === 'house' && i.item_id !== 'house_backyard')?.item_id ?? 'home'}`}>
          <OptionalModel name={home.model} size={2.1} colors={home.colors}>
            <mesh position={[0,.6,0]}><boxGeometry args={[1.4,1.2,1.3]}/><meshStandardMaterial color="#e8cbb0"/></mesh>
            <mesh position={[0,1.4,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[1.15,.75,4]}/><meshStandardMaterial color="#758e83"/></mesh>
          </OptionalModel>
        </group>
        {decorations.map((item, index) => <group name={`cosmetic:${item.item_id}`} key={item.item_id} position={[index % 2 ? 1.05 : -1.05,0,.6 + Math.floor(index/2)*.5]}>
          {item.custom ? <PhotoObject item={item}/> : <OptionalModel name={item.asset_key ?? item.item_id} size={.65}><mesh position={[0,.2,0]}><boxGeometry args={[.5,.4,.5]}/><meshStandardMaterial color={(typeof item.tint === 'string' ? item.tint : item.tint?.primary) ?? '#8fb38c'}/></mesh></OptionalModel>}
        </group>)}
        {(person.equipped_ids.includes('house_paddock') || person.equipped.some(i=>i.slot==='farm_animal')) && <group scale={.32} position={[-.2,0,0]} name="cosmetic:house_paddock"><HousePaddock person={person} style={home.style}/></group>}
      </> : <>
        <OptionalModel name="villager_base" size={1.8} colors={person.avatar.body.colors} head={person.avatar.body} equipment={person.equipped} crown={person.has_crown} animation={() => 'idle'}>
          <mesh position={[0,.65,0]}><boxGeometry args={[.5,.8,.35]}/><meshStandardMaterial color={person.avatar.body.colors.shirt}/></mesh>
          <mesh position={[0,1.35,0]}><sphereGeometry args={[.38,16,12]}/><meshStandardMaterial color={person.avatar.body.colors.skin}/></mesh>
          {[-.15,.15].map(x => <mesh key={x} position={[x,.15,0]}><boxGeometry args={[.18,.3,.25]}/><meshStandardMaterial color="#455563"/></mesh>)}
          {[-.35,.35].map(x => <mesh key={x} position={[x,.64,0]}><boxGeometry args={[.15,.58,.2]}/><meshStandardMaterial color={person.avatar.body.colors.skin}/></mesh>)}
        </OptionalModel>
        {person.equipped.filter(i => i.slot === 'pet').map(item => <group name={`cosmetic:${item.item_id}`} key={item.item_id} position={[.7,0,0]}><OptionalModel name={item.asset_key ?? 'pet_dog'} size={.5}><mesh position={[0,.2,0]}><boxGeometry args={[.2,.3,.4]}/><meshStandardMaterial color="#bf9665"/></mesh></OptionalModel></group>)}
      </>}
      <mesh position={[0,-.06,0]}><cylinderGeometry args={[house ? 1.8 : 1.1,house ? 1.8 : 1.1,.1,48]}/><meshStandardMaterial color="#53675b"/></mesh>
    </group>
    <Selection root={root} selected={selected}/>
  </>;
}

function Rotation({motion, children}: {motion: PreviewMotion; children: ReactNode}) {
  const group = useRef<Group>(null);
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useFrame(({camera}, delta) => {
    motion.frame(delta, performance.now(), reduced);
    if (group.current) group.current.rotation.set(motion.pitch, motion.yaw, 0);
    camera.zoom = motion.zoom; camera.updateProjectionMatrix();
  });
  return <group ref={group} name="outfit-rotation">{children}</group>;
}

export function ShowcasePreview({person, house = false, selected, wardrobe = false, editor = false}: {person: Villager; house?: boolean; selected: string | null; wardrobe?: boolean; editor?: boolean}) {
  const [motion] = useState(() => new PreviewMotion());
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Object3D>();
  const liveColors = useRef(person.equipped); liveColors.current = person.equipped;
  // Keep cosmetic attachment signatures stable for color-only edits.
  const equipmentKey = JSON.stringify(person.equipped.map(({colors: _colors, ...item}) => item));
  const equipment = useMemo(() => person.equipped, [equipmentKey]);
  const renderedPerson = editor ? {...person, equipped:equipment} : person;
  useLayoutEffect(() => { if (editor && scene.current) paintOutfitPreview(scene.current, person.equipped); }, [editor, person.equipped]);
  useEffect(() => {
    const element = host.current!;
    const wheel = (event: WheelEvent) => { event.preventDefault(); motion.wheel(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1), performance.now()); };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [motion]);
  return <div ref={host} className={wardrobe ? "wardrobe-preview" : "showcase-preview"} role="img" tabIndex={0} aria-label={`${house ? 'House' : wardrobe ? 'Interactive outfit' : 'Villager'} ${wardrobe ? 'preview' : 'turntable'} for ${person.display_name}. Drag to rotate, scroll or pinch to zoom, double-click to reset.`}
    style={{ touchAction: 'none', cursor: 'grab' }}
    onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); motion.down(event.pointerId, event.clientX, event.clientY, performance.now()); }}
    onPointerMove={event => motion.move(event.pointerId, event.clientX, event.clientY, performance.now())}
    onPointerUp={event => motion.up(event.pointerId, performance.now())}
    onPointerCancel={event => { motion.up(event.pointerId, performance.now()); motion.vx = motion.vy = 0; }}
    onLostPointerCapture={event => motion.up(event.pointerId, performance.now())}
    onDoubleClick={() => motion.reset(performance.now())}
    onKeyDown={event => { if (event.key === 'Home') motion.reset(performance.now()); else if (event.key.startsWith('Arrow')) { event.preventDefault(); motion.yaw += event.key === 'ArrowLeft' ? -0.15 : event.key === 'ArrowRight' ? 0.15 : 0; motion.wheel(event.key === 'ArrowUp' ? -100 : event.key === 'ArrowDown' ? 100 : 0, performance.now()); } }}>
    <Boundary><Canvas onCreated={state => {scene.current = state.scene;}} camera={{position:[0,house ? 1.5 : .4,house ? 5.6 : 4.2],fov:40}} dpr={editor ? 1 : [1,1.5]}>
      <ambientLight intensity={1.8}/><directionalLight position={[3,5,4]} intensity={2.5}/>
      <Rotation motion={motion}><Model person={renderedPerson} house={house} selected={selected} liveColors={editor ? liveColors : undefined}/></Rotation>
    </Canvas></Boundary>
    <span className="turntable-hint">Drag to rotate &middot; Scroll or pinch to zoom &middot; Double-click to reset</span>
  </div>;
}
