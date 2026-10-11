import { Html } from '@react-three/drei';
import { OptionalModel } from './OptionalModel';
import { STUDY_TABLES } from './layout/studySeats';

function Block({p, s, color = '#a47b59'}: {p: [number,number,number]; s: [number,number,number]; color?: string}) {
  return <mesh position={p} castShadow receiveShadow><boxGeometry args={s}/><meshStandardMaterial color={color}/></mesh>;
}

export function StudyNook({night}: {night: boolean}) {
  return <group name="study-nook">
    <OptionalModel batchStatic name="study_nook" size={1} authored animate={model => model.traverse(node => {
      if ('material' in node) {
        const materials = (node as import('three').Mesh).material;
        for (const m of Array.isArray(materials) ? materials : [materials])
          if (m.name === 'light' && 'emissiveIntensity' in m) m.emissiveIntensity = night ? 2.5 : .3;
      }
    })}>
      <Block p={[0,.025,0]} s={[8.5,.05,4.4]} color="#91a58a"/>
      {STUDY_TABLES.map(x => <group key={x} position={[x,0,0]}>
        <Block p={[0,1.65,0]} s={[2.3,.16,1.2]}/>
        {[-.85,.85].map(dx => <Block key={dx} p={[dx,.81,0]} s={[.16,1.62,.9]}/>)}
        {[-1,1].map(z => <group key={z}><Block p={[0,.95,z]} s={[2.3,.16,.46]}/>{[-.85,.85].map(dx => <Block key={dx} p={[dx,.46,z]} s={[.14,.92,.35]}/>)}</group>)}
        <Block p={[-.6,1.78,0]} s={[.7,.07,.48]} color="#f1e6cd"/>
        <Block p={[.48,1.77,0]} s={[.65,.07,.45]} color="#384852"/>
        <Block p={[.48,1.98,-.23]} s={[.65,.45,.04]} color="#91cdd1"/>
        <mesh position={[0,1.88,.26]}><cylinderGeometry args={[.11,.1,.23,8]}/><meshStandardMaterial color="#f1e6cd"/></mesh>
      </group>)}
      {[-4.45,4.45].flatMap(x => [-2.6,2.6].map(z => <Block key={`${x}:${z}`} p={[x,1.9,z]} s={[.18,3.8,.18]}/>))}
      {[-2.6,2.6].map(z => <Block key={z} p={[0,3.8,z]} s={[9.2,.22,.2]}/>)}
      {[-4,-2,0,2,4].map(x => <Block key={x} p={[x,3.97,0]} s={[.18,.16,5.6]} color="#f1e6cd"/>)}
      {[-3.4,3.4].map(x => <group key={x}>
        <mesh position={[x,.3,-3.6]} scale={[.7,.3,.55]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#f1e6cd"/></mesh>
        <Block p={[x,.28,3.4]} s={[.5,.56,.5]}/><mesh position={[x,.8,3.4]}><icosahedronGeometry args={[.4,0]}/><meshStandardMaterial color="#91a58a"/></mesh>
      </group>)}
      <Block p={[0,.6,-3.7]} s={[.18,1.2,.18]}/><Block p={[0,1.65,-3.7]} s={[1.8,1.3,.6]} color="#f1e6cd"/>
      <Block p={[0,1.05,3.55]} s={[2.15,1.3,.15]} color="#344b43"/>
      {Array.from({length:13},(_,i) => <mesh key={i} position={[-4.4+i*8.8/12,3.6-.38*Math.sin(i/12*Math.PI),2.6]}><sphereGeometry args={[.1,6,4]}/><meshStandardMaterial color="#ffe4a1" emissive="#ffcc73" emissiveIntensity={night?2.5:.3}/></mesh>)}
    </OptionalModel>
    {night && <pointLight position={[0,2.9,1]} color="#ffd49a" intensity={16} distance={12} decay={2}/>}
    <Html position={[0,1.25,3.7]} center zIndexRange={[5,0]} style={{pointerEvents:'none'}}><span className="scene-label" data-testid="study-spot">Study Spot</span></Html>
  </group>;
}
