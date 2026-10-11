import { PhotoObject } from "../components/PhotoObject";
import type { EquippedItem } from "../api/types";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Text } from "@react-three/drei";
import { Group } from "three";
import {
  furniture,
  interpolate,
  interpolateRotation,
  type Item,
} from "./interior";
function Box({
  p = [0, 0, 0],
  s = [1, 1, 1],
  c = "#a27857",
  glow = false,
}: {
  p?: [number, number, number];
  s?: [number, number, number];
  c?: string;
  glow?: boolean;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={c}
        emissive={glow ? c : "#000"}
        emissiveIntensity={glow ? 0.6 : 0}
      />
    </mesh>
  );
}
export function Furniture({
  item,
  ghost = false,
  rewards = 0,
  photo,
  ...events
}: {
  item: Item;
  ghost?: boolean;
  rewards?: number;
  photo?: string;
  onPointerDown?: any;
  onPointerOver?: any;
  onPointerOut?: any;
}) {
  const ref = useRef<Group>(null);
  const origin = useRef<[number, number, number]>([item.x, 0, item.z]);
  const facing = useRef<[number, number, number]>([
    0,
    (item.rot * Math.PI) / 180,
    0,
  ]);
  const c = furniture.find((c) => c.id === item.kind) ?? {width:1, depth:1, shape:"object", color:"#809485"};
  const [w, d] = [c.width, c.depth];
  useFrame((state, dt) => {
    if (!ref.current) return;
    const g = ref.current;
    g.position.x = interpolate(g.position.x, item.x, dt);
    g.position.z = interpolate(g.position.z, item.z, dt);
    g.rotation.y =
      (interpolateRotation((g.rotation.y * 180) / Math.PI, item.rot, dt) *
        Math.PI) /
      180;
    const animated = g.getObjectByName("animated");
    if (animated) {
      animated.rotation.y = state.clock.elapsedTime;
      animated.position.x = Math.sin(state.clock.elapsedTime * 1.5) * 0.2;
    }
  });
  return (
    <group
      ref={ref}
      position={origin.current}
      rotation={facing.current}
      {...events}
    >
      {item.model_url && <PhotoObject item={{glb_url:item.model_url} as EquippedItem}/>}
      {ghost && <Box p={[0, 0.03, 0]} s={[w, 0.04, d]} c="#72e0d0" />}
      {c.shape === "seat" && (
        <>
          {[-1,1].flatMap(x=>[-1,1].map(z=><Box key={`${x}:${z}`} p={[x*(w/2-.15),.09,z*(d/2-.12)]} s={[.09,.18,.09]} c="#6e5e4b"/>))}
          <Box p={[0, 0.4, 0]} s={[w, 0.45, d]} c={c.color} />
          <Box p={[0, 0.85, -d * 0.4]} s={[w, 0.6, 0.2]} c={c.color} />
          {[-1, 1].map((n) => (
            <Box
              key={n}
              p={[n * (w / 2 - 0.1), 0.65, 0]}
              s={[0.2, 0.4, d]}
              c={c.color}
            />
          ))}
        </>
      )}
      {["table", "counter", "record", "tv"].includes(c.shape) && (
        <>
          <Box p={[0, 0.72, 0]} s={[w, 0.15, d]} c={c.color} />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Box
                key={`${x}${z}`}
                p={[x * (w / 2 - 0.1), 0.35, z * (d / 2 - 0.1)]}
                s={[0.1, 0.7, 0.1]}
              />
            )),
          )}
          {c.shape === "tv" && (
            <Box p={[0, 1.3, -0.15]} s={[1.35, 0.85, 0.1]} c="#263b47" />
          )}
          {c.shape === "record" && (
            <mesh position={[0, 0.84, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.025, 16]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          )}
        </>
      )}
      {c.shape === "bed" && (
        <>
          <Box p={[0, 0.25, 0]} s={[w, 0.5, d]} />
          <Box p={[0, 0.55, 0.1]} s={[w, 0.2, d - 0.2]} c={c.color} />
          <Box p={[0, 0.7, -0.65]} s={[w - 0.2, 0.2, 0.45]} c="#fff1da" />
        </>
      )}
      {c.shape === "rug" &&
        (item.kind === "rug_round" ? (
          <mesh position={[0, 0.012, 0]}>
            <cylinderGeometry args={[w / 2, w / 2, 0.02, 24]} />
            <meshStandardMaterial color={c.color} />
          </mesh>
        ) : (
          <group>
            <Box p={[0, 0.012, 0]} s={[w, 0.02, d]} c={c.color} />
            {[-0.5, 0, 0.5].map((x) => (
              <Box key={x} p={[x, 0.024, 0]} s={[0.1, 0.005, d]} c="#f4dfb4" />
            ))}
          </group>
        ))}
      {c.shape === "plant" && (
        <>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.22, 0.15, 0.4, 8]} />
            <meshStandardMaterial color="#c37852" />
          </mesh>
          <mesh position={[0, 0.65, 0]}>
            <icosahedronGeometry
              args={[item.kind === "plant_palm" ? 0.48 : 0.3, 0]}
            />
            <meshStandardMaterial color="#54866b" />
          </mesh>
        </>
      )}
      {["shelf", "fridge", "arcade"].includes(c.shape) && (
        <>
          <Box p={[0, 0.85, 0]} s={[w, 1.7, d]} c={c.color} />
          {c.shape === "shelf" ? (
            [0.3, 0.8, 1.3].map((y) => (
              <Box
                key={y}
                p={[0, y, d / 2]}
                s={[w - 0.1, 0.3, 0.08]}
                c="#eadcc3"
              />
            ))
          ) : (
            <Box
              p={[0, 1.15, d / 2 + 0.01]}
              s={[w - 0.15, 0.6, 0.025]}
              c={c.shape === "arcade" ? "#7fc9ce" : "#eae4d9"}
              glow={c.shape === "arcade"}
            />
          )}
        </>
      )}
      {["lamp", "lava"].includes(c.shape) && (
        <>
          <Box p={[0, 0.6, 0]} s={[0.06, 1.2, 0.06]} c="#d6b779" />
          <mesh position={[0, 1.3, 0]}>
            <coneGeometry args={[0.25, 0.4, 12]} />
            <meshStandardMaterial
              color={c.shape === "lava" ? "#f685a2" : "#ffe6a6"}
              emissive="#ff9562"
              emissiveIntensity={0.6}
            />
          </mesh>
        </>
      )}
      {c.shape === "fish" && (
        <>
          <Box p={[0, 0.3, 0]} s={[w, 0.6, d]} c={c.color} />
          <mesh position={[0, 0.95, 0]}>
            <boxGeometry args={[w, 0.7, d]} />
            <meshStandardMaterial color="#70d5de" transparent opacity={0.3} />
          </mesh>
          <mesh name="animated" position={[0, 0.95, 0]}>
            <coneGeometry args={[0.1, 0.25, 6]} />
            <meshStandardMaterial color="#ffbb68" />
          </mesh>
        </>
      )}
      {c.shape === "disco" && (
        <mesh name="animated" position={[0, 2.7, 0]}>
          <icosahedronGeometry args={[0.3, 1]} />
          <meshStandardMaterial
            color="#d4d0fa"
            metalness={0.85}
            roughness={0.15}
          />
        </mesh>
      )}
      {c.shape === "pet" && (
        <>
          <Box p={[0, 0.12, 0]} s={[w, 0.24, d]} c={c.color} />
          <Box p={[0, 0.25, 0]} s={[w - 0.2, 0.1, d - 0.2]} c="#e7daca" />
        </>
      )}
      {c.shape === "wall" && (
        <>
          <Box p={[0, 1.8, 0]} s={[w, 0.65, 0.12]} c={c.color} />
          <Box
            p={[0, 1.8, 0.075]}
            s={[w - 0.12, 0.5, 0.025]}
            c={item.kind === "neon_sign" ? "#f380c6" : "#f4deaf"}
            glow={item.kind === "neon_sign"}
          />
          {item.kind === "photo_frame" && photo && (
            <Html transform position={[0, 1.8, 0.1]} scale={0.09}>
              <img
                src={photo}
                alt="Your photo item"
                style={{ width: 150, height: 110, objectFit: "cover" }}
              />
            </Html>
          )}
          {item.kind === "trophy_shelf" && (
            <Text
              position={[0, 1.8, 0.1]}
              fontSize={0.13}
              color="#493625"
            >{`${rewards} rewards`}</Text>
          )}
          {item.kind === "neon_sign" && (
            <Text position={[0, 1.8, 0.1]} fontSize={0.13} color="#fff">
              VILLAGE
            </Text>
          )}
        </>
      )}
    </group>
  );
}
