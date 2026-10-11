import {OrbitControls} from "@react-three/drei";
import {Canvas} from "@react-three/fiber";
import {loadModel,cloneModel} from "../src/scene/OptionalModel";
import "../src/styles.css";
// Vite-only QA entry. Uses the real authenticated API and production room component.
import React from "react";
import { createRoot } from "react-dom/client";
import { HouseInterior } from "../src/components/HouseInterior";
import { api } from "../src/api/client";
const params = new URLSearchParams(location.search);
api.user = params.get("seat") || "13370000-0000-4000-8000-000000000001";
const uid = params.get("house") || "13370000-0000-4000-8000-000000000001";
const vid = "13370000-0000-4000-8000-000000000000";
const root = createRoot(document.getElementById("root")!);
if (params.get("asset") === "hall") {
  void loadModel("community_hall").then(model=>root.render(
    <div data-testid="hall-asset" data-ready={!!model} style={{width:640,height:640}}>
      <Canvas shadows camera={{position:[8,6,9],fov:38}}>
        <OrbitControls enableRotate={false} enableZoom={false} enablePan={false}/>
        <color attach="background" args={["#eeeee3"]}/>
        <ambientLight intensity={.9}/><hemisphereLight args={["#fff5dd","#849176",1.2]}/>
        <directionalLight position={[3,9,4]} intensity={2} castShadow/>
        {model && <group position={[0,-1.7,0]}><primitive object={cloneModel(model,6)}/></group>}
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.71,0]} receiveShadow><planeGeometry args={[30,30]}/><meshStandardMaterial color="#eeeee3"/></mesh>
      </Canvas>
    </div>
  ));
} else api
  .village(vid)
  .then((v) =>
    root.render(
      <HouseInterior
        hall={params.get("hall") === "1"}
        person={v.villagers.find((p) => p.user_id === uid)!}
        vid={vid}
        onClose={() => root.render(<p>Room closed.</p>)}
      />,
    ),
  )
  .catch((e) => root.render(<p role="alert">{e.message}</p>));
