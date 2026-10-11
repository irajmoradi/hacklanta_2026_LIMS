import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { fitnessAsset } from './fitnessAsset';
import { OptionalModel } from './OptionalModel';

export function FitnessCorner() {
  const fallback = useMemo(fitnessAsset, []);
  return <group><OptionalModel name="fitness_corner" size={1} authored><primitive object={fallback}/></OptionalModel>
    <Html position={[0,3.9,-2]} center zIndexRange={[5,0]} style={{pointerEvents:'none'}}><span className="scene-label" data-testid="fitness-corner">Fitness Corner</span></Html>
  </group>;
}
