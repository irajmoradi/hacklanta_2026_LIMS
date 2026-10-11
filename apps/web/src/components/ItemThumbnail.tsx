import { Component, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OptionalModel } from '../scene/OptionalModel';

/** Key the image state by URL so a failed item never poisons the next selection. */
export function ThumbnailImage({ src, fallback }: { src: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState<string | null>(null);
  return failed === src ? <>{fallback}</> : <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />;
}

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function LiveItem({ model, fallback }: { model: string; fallback: ReactNode }) {
  return <ModelBoundary fallback={fallback}><Canvas frameloop="demand" dpr={1} camera={{ position: [2.2, 1.5, 3.5], fov: 36 }}>
    <ambientLight intensity={1.7} /><directionalLight position={[-3, 5, 4]} intensity={2.3} /><directionalLight position={[3, 2, -2]} intensity={1.2} />
    <group position={[0, -.65, 0]}><OptionalModel name={model} size={1.3}>
      <mesh position={[0, .55, 0]}><sphereGeometry args={[.4, 16, 12]} /><meshStandardMaterial color="#8fb7a5" /></mesh>
    </OptionalModel></group>
  </Canvas></ModelBoundary>;
}

// Keep the original live-model fallback pack; every item can request static art.
// Other items retain their supplied icon on failure without creating a canvas per card.
const authoredThumbnails = new Set(["auditor_badge", "champion_mantle", "competition_laurels", "decor_flowers", "decor_fountain", "decor_lamp", "festival_vip", "glasses_round", "hat_beanie", "hat_cap", "hat_cowboy", "hat_crown", "hat_festival", "hat_headphones", "house_backyard", "house_lv2", "house_lv3", "jacket_denim", "mayor_medal", "perfect_week_halo", "pet_dog", "pet_dog_b", "scarf", "shirt_hoodie", "shirt_stripes", "streak_flame_scarf", "voice_hype_coach", "voice_pirate", "voice_shakespearean"]);

/** Static art costs no WebGL contexts; load a live item only if its PNG is absent. */
export function ItemThumbnail({ id, assetKey, rarity = 'common', fallback, staticFallback = false }: {
  staticFallback?: boolean; id: string; assetKey?: string | null; rarity?: string | null; fallback: ReactNode;
}) {
  const model = assetKey && /^[a-z0-9_]+$/.test(assetKey) ? assetKey : id;
  return <span className="item-thumbnail" data-rarity={rarity ?? 'common'} aria-hidden="true">
    <ThumbnailImage key={id} src={`/thumbs/${encodeURIComponent(id)}.png`}
      fallback={staticFallback || !authoredThumbnails.has(id) ? fallback : <span className="item-live-fallback" data-model={model}><LiveItem key={model} model={model} fallback={fallback} /></span>} />
  </span>;
}
