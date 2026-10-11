import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshBasicMaterial, Object3D } from 'three';
import type { AvatarManifest } from '../api/types';
import { acquireHead, attachHead, headFallback, type HeadKind } from './headAssets';

function poofSound() {
  // Autoplay policy is respected: initial page loading stays silent until user interaction.
  if (!navigator.userActivation?.hasBeenActive) return;
  try {
    const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.frequency.setValueAtTime(240, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(70, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.045, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
    oscillator.start(); oscillator.stop(context.currentTime + 0.2); oscillator.onended = () => void context.close();
  } catch { /* Sound is optional. */ }
}

export function GeneratedHead({rig, body, onKind}: {rig: Object3D; body: AvatarManifest['body']; onKind?: (kind: HeadKind) => void}) {
  const particles = useRef<Group>(null), age = useRef(1), appeared = useRef(false);
  useEffect(() => {
    let active = true, detach: (() => void) | null = null;
    const leases: ReturnType<typeof acquireHead>[] = [];
    onKind?.('preset');
    void headFallback(body, async (url, kind) => {
      if (!active) throw new Error('Unmounted');
      const lease = acquireHead(url, kind); leases.push(lease);
      try { return await lease.promise; } catch (error) { lease.release(); throw error; }
    }).then(result => {
      if (!active || !result.value) return;
      detach = attachHead(rig, result.value);
      if (!detach) return;
      onKind?.(result.kind);
      if (!appeared.current) { appeared.current = true; age.current = 0; poofSound(); }
    });
    return () => { active = false; detach?.(); leases.forEach(lease => lease.release()); };
  }, [rig, body.head_glb_url, body.head_card_url, onKind]);
  useFrame((_, delta) => {
    if (!particles.current) return;
    age.current += delta; particles.current.visible = age.current < 0.65;
    if (!particles.current.visible) return;
    particles.current.children.forEach((node, i) => {
      const angle = i * Math.PI / 4, radius = 0.12 + age.current * 0.6;
      node.position.set(Math.cos(angle) * radius, 1.4 + Math.sin(angle) * radius, Math.sin(i * 3) * radius);
      (node as Mesh).scale.setScalar(1 + age.current);
      ((node as Mesh).material as MeshBasicMaterial).opacity = (1 - age.current / 0.65) * 0.6;
    });
  });
  return <group ref={particles} visible={false}>{Array.from({length: 8}, (_, i) => <mesh key={i}><icosahedronGeometry args={[0.09, 0]} /><meshBasicMaterial color="#fff2d5" transparent depthWrite={false} /></mesh>)}</group>;
}
