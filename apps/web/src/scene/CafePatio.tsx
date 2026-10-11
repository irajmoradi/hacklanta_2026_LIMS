import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { OptionalModel } from './OptionalModel';
import { CAFE_OFFSET, CAFE_TABLES } from './layout/cafeSeats';

export function cafeLights(model: Object3D, night: boolean) {
  model.traverse(node => {
    if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material instanceof MeshStandardMaterial && material.name === 'patio_bulb') material.emissiveIntensity = night ? 3 : .05;
    }
  });
}
function Block({p,s,color='#8eaa91'}: {p:[number,number,number];s:[number,number,number];color?:string}) {
  return <mesh position={p} castShadow receiveShadow><boxGeometry args={s}/><meshStandardMaterial color={color}/></mesh>;
}
export function CafePatio({night}: {night:boolean}) {
  return <group name="cafe-patio" position={CAFE_OFFSET}>
    <OptionalModel name="cafe_patio" size={1} authored batchStatic animate={model => cafeLights(model,night)}>
      <Block p={[0,.025,0]} s={[9.5,.05,3.7]} color="#ddd4be"/>
      {CAFE_TABLES.map(x => <group key={x} position={[x,0,0]}>
        <mesh position={[0,1.45,0]}><cylinderGeometry args={[.62,.62,.1,16]}/><meshStandardMaterial color="#fff5e6"/></mesh>
        <Block p={[0,.7,0]} s={[.12,1.4,.12]} color="#b47750"/>
        {[-1,1].map(z => <group key={z}>
          <Block p={[0,.85,z]} s={[.7,.12,.65]}/><Block p={[0,1.23,z+Math.sign(z)*.3]} s={[.7,.65,.1]}/>
          {[-.25,.25].map(dx => <Block key={dx} p={[dx,.4,z]} s={[.08,.8,.5]} color="#b47750"/>)}
        </group>)}
        <Block p={[0,1.6,0]} s={[.05,3.2,.05]} color="#b47750"/>
        <mesh position={[0,3.05,0]}><coneGeometry args={[1.3,.55,12,1,true]}/><meshStandardMaterial color="#8eaa91" side={2}/></mesh>
      </group>)}
      {[-4.55,4.55].map(x => <Block key={x} p={[x,.3,0]} s={[.35,.6,3.5]} color="#a47b59"/>)}
      {[-4.4,0,4.4].map(x => <Block key={x} p={[x,1.9,-1.65]} s={[.09,3.8,.09]} color="#b47750"/>)}
      {Array.from({length:17},(_,i)=><mesh key={i} position={[-4.4+i*.55,3.55-.25*Math.sin((i%8)/8*Math.PI),-1.65]}><icosahedronGeometry args={[.08,0]}/><meshStandardMaterial name="patio_bulb" color="#ffe8b5" emissive="#ffd08a" emissiveIntensity={night?3:.05}/></mesh>)}
    </OptionalModel>
    {night && <pointLight position={[0,2.8,0]} color="#ffd29a" intensity={9} distance={10} decay={2}/>}
  </group>;
}
