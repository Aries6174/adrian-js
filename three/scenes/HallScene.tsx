"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getStage, prepareScene, sceneForPath, travel } from "@/lib/stage";
import {
  Asteroids,
  BlackHole,
  DustDisk,
  Figure,
  GlowRing,
  HoloPanel,
  LightShaft,
  Mountains,
  Planet,
  Sky,
  Staged,
  type SkyOptions,
  WetFloor,
} from "../parts";
import { navPanelTexture } from "../panelTexture";
import { diskBasis, glow, makeWorld, type Pose, surface } from "../shared";
import { Console, Railing, Rotunda } from "./architecture";

const EYE: [number, number, number] = [0, 1.05, 22];
const HOLE: [number, number, number] = [0, 6.5, -8];
const TILT = 0.2;
const ROLL = 0.07;

export const HALL_POSE: Pose = {
  position: EYE,
  target: [0, 1.25, -6],
  fov: 38,
  parallax: [0.75, 0.16],
  hole: HOLE,
};

const SKY: SkyOptions = {
  zenith: "#030303",
  horizon: "#2a1c10",
  sunDir: [0.05, 0.02, -1],
  sun: "#ffbb6e",
  sunPower: 0.7,
  glow: "#c9792a",
  glowPower: 0.75,
  nebula: 0.55,
  nebulaDir: [0, 0.3, -1],
  nebulaFocus: 3,
  stars: 1.1,
};

const PANELS: {
  no: string;
  title: string;
  href: string;
  position: [number, number, number];
  rotation: [number, number, number];
  seed: number;
}[] = [
  { no: "01", title: "Projects", href: "/projects", position: [-4.7, 6.5, -2], rotation: [0.02, 0.42, -0.05], seed: 11 },
  { no: "02", title: "About", href: "/about", position: [-4.6, 3.25, -1], rotation: [0.03, 0.42, 0.04], seed: 23 },
  { no: "03", title: "Skills", href: "/about#skills", position: [6.8, 7, -3], rotation: [0.02, -0.46, 0.06], seed: 31 },
  { no: "04", title: "Contact", href: "/contact", position: [5.8, 3.4, -1], rotation: [0.03, -0.44, -0.05], seed: 47 },
];

function Dais() {
  const { base, trim } = useMemo(
    () => ({
      base: new THREE.MeshBasicMaterial({ color: "#090705" }),
      trim: glow("#ffb45e", 5.5),
    }),
    [],
  );
  const steps: [number, number, number][] = [
    [6.6, 0.28, 0.14],
    [5.6, 0.32, 0.44],
    [4.5, 0.32, 0.76],
  ];
  return (
    <group position={[0, 0, HOLE[2]]}>
      {steps.map(([radius, height, y]) => (
        <group key={radius}>
          <mesh position={[0, y, 0]} material={base}>
            <cylinderGeometry args={[radius, radius, height, 96]} />
          </mesh>
          <GlowRing radius={radius + 0.01} position={[0, y + height / 2, 0]} tube={0.028} power={5} />
        </group>
      ))}
      <mesh position={[0, 0.94, 0]} rotation={[-Math.PI / 2, 0, 0]} material={trim}>
        <circleGeometry args={[1.25, 64]} />
      </mesh>
      <GlowRing radius={2.5} position={[0, 0.95, 0]} tube={0.02} power={4} />
      <GlowRing radius={3.5} position={[0, 0.95, 0]} tube={0.016} power={3} />
    </group>
  );
}

export function HallScene({ visible }: { visible: boolean }) {
  const hole = useRef<THREE.Group>(null);
  const { world, basis, textures, shelf } = useMemo(() => {
    const world = makeWorld({
      lights: [
        { pos: HOLE, color: "#ffb25e", power: 3.2, falloff: 0.022 },
        { pos: [0, 2.6, 4], color: "#ffa951", power: 0.5, falloff: 0.04 },
        { pos: [-18, 7, 2], color: "#ff9f48", power: 1.1, falloff: 0.05 },
        { pos: [18, 7, 2], color: "#ff9f48", power: 1.1, falloff: 0.05 },
      ],
      ambient: "#3d2d1c",
      ambientPower: 0.05,
      fog: "#0a0604",
      fogDensity: 0.004,
      rimDir: [0, 0.3, -1],
      rim: "#ffad58",
      rimPower: 0.5,
    });
    return {
      world,
      basis: diskBasis(new THREE.Vector3(...EYE), new THREE.Vector3(...HOLE), TILT, ROLL),
      textures: PANELS.map((p) => navPanelTexture(p.no, p.title.toUpperCase(), p.seed)),
      shelf: surface(world, { color: "#2a1d10", shine: 30, spec: 0.5, rim: 0.4 }),
    };
  }, []);

  return (
    <group visible={visible}>
      <Staged>
      <Sky options={SKY} />
      <Mountains world={world} radius={150} height={30} seed={3} color="#1d1610" />
      <Mountains world={world} radius={95} height={18} seed={8} />
      <Planet position={[-110, 42, -96]} radius={46} light={[0.9, 0.28, 0.42]} />
      <Rotunda world={world} radius={25} height={34} center={[0, HOLE[2]]} />
      <WetFloor size={140} glowAt={HOLE} glowRange={9} strength={0.8} hide={hole} />
      <Dais />
      <LightShaft position={[0, 18, HOLE[2]]} radiusTop={3.1} radiusBottom={3.9} height={34} power={0.045} />
      <Railing world={world} radius={8.3} center={[0, HOLE[2]]} from={0.32} arc={Math.PI * 2 - 0.64} />

      <group ref={hole}>
        <BlackHole resolution={768} position={HOLE} size={8.2} tilt={TILT} roll={ROLL} gain={1.5} bands={2.1} />
      </group>
      <DustDisk
        position={HOLE}
        quaternion={basis}
        count={5200}
        rMin={7.6}
        rMax={13.5}
        thickness={1.4}
        size={1.25}
        speed={1.1}
        intensity={1.1}
      />
      <Asteroids
        scene="hall"
        world={world}
        position={HOLE}
        quaternion={basis}
        count={46}
        rMin={3.8}
        rMax={11.5}
        thickness={2.5}
        size={0.27}
        speed={0.09}
      />
      {[8.8, 11.3, 14].map((radius) => (
        <GlowRing key={radius} radius={radius} position={HOLE} quaternion={rotateRing(basis)} tube={0.017} power={1.1} behindPanels />
      ))}

      {PANELS.map((panel, index) => (
        <HoloPanel
          key={panel.no}
          texture={textures[index]}
          position={panel.position}
          rotation={panel.rotation}
          width={3.3}
          height={2.58}
          phase={index * 1.4}
          onHover={(over) => {
            if (over) prepareScene(sceneForPath(panel.href.split("#")[0]));
          }}
          onSelect={() => {
            if (getStage().scene === "hall") travel(panel.href);
          }}
        />
      ))}

      <Console world={world} position={[-8.6, 0, 9]} rotationY={0.65} seed={2} />
      <Console world={world} position={[8.6, 0, 9]} rotationY={-0.65} seed={5} />

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 15, 2, -2]} rotation={[0, side * 0.5, 0]} material={shelf}>
            <boxGeometry args={[4, 4, 1]} />
          </mesh>
          {[0.8, 1.9, 3].map((y) => (
            <mesh key={y} position={[side * 14.95, y, -1.65]} rotation={[0, side * 0.5, 0]} material={shelfGlow}>
              <boxGeometry args={[3.7, 0.06, 0.06]} />
            </mesh>
          ))}
        </group>
      ))}

      <Figure world={world} kind="coat" position={[0, 0, 10]} rim={1.1} />
      </Staged>
    </group>
  );
}

const ringQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

/** Torus rings lie in their local XY plane, the disk in XZ. */
function rotateRing(basis: THREE.Quaternion) {
  return basis.clone().multiply(ringQuaternion);
}

const shelfGlow = glow("#ffb45e", 3.4);
