"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getStage } from "@/lib/stage";
import {
  Asteroids,
  BlackHole,
  DustDisk,
  Figure,
  GlowRing,
  HoloPanel,
  Mountains,
  Sky,
  type SkyOptions,
  WetFloor,
} from "../parts";
import { worldMapTexture } from "../panelTexture";
import { diskBasis, glow, makeWorld, type Pose, surface, uTime, type World } from "../shared";
import { Boxes, Railing } from "./architecture";

const EYE: [number, number, number] = [0, 1.2, 14.5];
const HOLE: [number, number, number] = [-11, 13.5, -54];
const TILT = 0.32;
const ROLL = -0.2;

export const CONTACT_POSE: Pose = {
  position: EYE,
  target: [0, 2.75, -10],
  fov: 38,
  parallax: [0.5, 0.14],
  hole: HOLE,
  portraitTarget: [-3, 3.4, -10],
};

const SKY: SkyOptions = {
  zenith: "#040302",
  horizon: "#2c1a0d",
  sunDir: [0.15, 0.015, -1],
  sun: "#ffbc70",
  sunPower: 1.4,
  glow: "#de8a33",
  glowPower: 0.9,
  nebula: 0.55,
  nebulaDir: [-0.2, 0.25, -1],
  nebulaFocus: 5,
  stars: 1.1,
};

/** Parabolic radio dish with gold-traced ribs, sweeping slowly across the sky. */
function Dish({ world, position }: { world: World; position: [number, number, number] }) {
  const head = useRef<THREE.Group>(null);
  const { bowl, frame, trace, bowlGeometry, ribs } = useMemo(() => {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const r = (i / 40) * 5;
      points.push(new THREE.Vector2(r, (r * r) / 13));
    }
    const ribs: number[][] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      for (let k = 0; k < 8; k++) {
        const r0 = 0.5 + (k / 8) * 4.5;
        const r1 = r0 + 4.5 / 8;
        const y0 = (r0 * r0) / 13;
        const y1 = (r1 * r1) / 13;
        const mid = (r0 + r1) / 2;
        ribs.push([
          Math.cos(a) * mid,
          (y0 + y1) / 2 + 0.02,
          Math.sin(a) * mid,
          Math.hypot(r1 - r0, y1 - y0),
          0.018,
          0.018,
          -a,
          0,
          Math.atan2(y1 - y0, r1 - r0),
        ]);
      }
    }
    const bowlMaterial = surface(world, { color: "#2a1d10", shine: 24, spec: 0.8, rim: 1.1 });
    bowlMaterial.side = THREE.DoubleSide;
    return {
      bowl: bowlMaterial,
      frame: surface(world, { color: "#1a130b", shine: 50, spec: 1.1, rim: 0.9 }),
      trace: glow("#ffba69", 1.8),
      bowlGeometry: new THREE.LatheGeometry(points, 72),
      ribs,
    };
  }, [world]);

  useFrame(() => {
    if (!head.current || getStage().scene !== "contact") return;
    head.current.rotation.y = 0.5 + Math.sin(uTime.value * 0.11) * 0.15;
  });

  return (
    <group position={position}>
      <mesh position={[0, -5, 0]} material={frame}>
        <cylinderGeometry args={[0.65, 1.2, 10, 12]} />
      </mesh>
      <group ref={head}>
        <group rotation={[1.02, 0, -0.26]}>
          <mesh geometry={bowlGeometry} material={bowl} />
          <Boxes items={ribs} material={trace} />
          {[1.6, 2.8, 4, 5].map((radius) => (
            <GlowRing
              key={radius}
              radius={radius}
              position={[0, (radius * radius) / 13 + 0.02, 0]}
              tube={radius === 5 ? 0.04 : 0.016}
              power={radius === 5 ? 3.4 : 1.5}
            />
          ))}
          {[0, 2.09, 4.19].map((a) => (
            <mesh
              key={a}
              position={[Math.cos(a) * 1.6, 2.1, Math.sin(a) * 1.6]}
              rotation={[Math.sin(a) * 0.72, 0, -Math.cos(a) * 0.72]}
              material={frame}
            >
              <cylinderGeometry args={[0.03, 0.04, 4.2, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 3.9, 0]} material={trace}>
            <sphereGeometry args={[0.18, 16, 12]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Lit gantry around the base of the dish, with stacked decks and windows. */
function Tower({ world }: { world: World }) {
  const { dark, trim, windowGlow, decks, lights } = useMemo(() => {
    const decks: number[][] = [];
    const lights: number[][] = [];
    [0.7, 2.4, 4.2].forEach((y, level) => {
      decks.push([7.4, y, -7.5, 8.5 - level, 0.25, 6 - level, 0]);
      lights.push([7.4, y + 0.14, -4.5 + level * 0.5, 8.5 - level, 0.03, 0.03, 0]);
      for (let i = 0; i < 8; i++) {
        lights.push([3.6 + i * 1 + level * 0.3, y + 0.78, -4.6 + level * 0.5, 0.03, 1.2, 0.03, 0]);
      }
    });
    return {
      dark: surface(world, { color: "#17110a", shine: 40, spec: 0.8, rim: 0.7 }),
      trim: glow("#ffb45e", 3.6),
      windowGlow: glow("#ffb45e", 2),
      decks,
      lights,
    };
  }, [world]);
  return (
    <group>
      <Boxes items={decks} material={dark} />
      <Boxes items={lights} material={trim} />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[7.4 + side * 2.8, 2.7, -7.6]} material={dark}>
          <boxGeometry args={[0.45, 5.4, 0.45]} />
        </mesh>
      ))}
      <mesh position={[7.4, 2.8, -8.3]} material={windowGlow}>
        <boxGeometry args={[1.8, 2.2, 0.05]} />
      </mesh>
    </group>
  );
}

function Interior({ world }: { world: World }) {
  const { dark, strip, soft, frames, strips, softStrips } = useMemo(() => {
    const frames: number[][] = [
      // Window columns.
      [-8.5, 9, -6, 1.3, 18, 1.6, 0.05],
      [1.2, 9, -7, 0.8, 18, 1.1, 0],
      [-16, 9, -3, 1.8, 18, 2, 0.1],
      [14, 9, -6, 1.3, 18, 1.6, -0.1],
      // Roof.
      [0, 16.5, -6, 44, 0.7, 1.3, 0],
      [0, 15, 3, 44, 0.8, 1.1, 0],
      [-3, 15.7, -1.6, 0.6, 0.5, 11, 0.1],
      [7, 15.7, -1.6, 0.6, 0.5, 11, -0.06],
      [-12, 15.7, -1.6, 0.6, 0.5, 11, 0.12],
      [0, 17.5, 10, 50, 1.4, 16, 0],
      // Deck edge.
      [-6, 0.22, -5.6, 26, 0.44, 0.9, 0],
    ];
    const strips: number[][] = [
      [0, 0.46, -5.2, 30, 0.03, 0.04, 0],
      [-7.82, 9, -5.2, 0.05, 17, 0.05, 0.05],
      [1.62, 9, -6.46, 0.03, 17, 0.03, 0],
      [-3.5, 15.3, -1.5, 16, 0.04, 0.04, 0],
      [-3, 15.32, 1.8, 16, 0.04, 0.04, 0],
    ];
    const softStrips: number[][] = [];
    for (let i = 0; i < 12; i++) {
      softStrips.push([-12 + i * 2.2, 15.42, -6.2, 1.4, 0.05, 0.06, 0]);
    }
    return {
      dark: surface(world, { color: "#14100a", shine: 60, spec: 1.1, rim: 0.55 }),
      strip: glow("#ffb45e", 2.6),
      soft: glow("#ffb45e", 1),
      frames,
      strips,
      softStrips,
    };
  }, [world]);
  return (
    <group>
      <Boxes items={frames} material={dark} />
      <Boxes items={strips} material={strip} />
      <Boxes items={softStrips} material={soft} />
      {/* Floor light seams running toward the viewer. */}
      {[-3, 5.2].map((x) => (
        <mesh key={x} position={[x, 0.02, 7]} rotation={[0, x < 0 ? 0.1 : -0.34, 0]} material={strip}>
          <boxGeometry args={[0.06, 0.02, 20]} />
        </mesh>
      ))}
    </group>
  );
}

export function ContactScene({ visible }: { visible: boolean }) {
  const hole = useRef<THREE.Group>(null);
  const { world, basis, map, consoleBody, consoleTrim } = useMemo(() => {
    const world = makeWorld({
      lights: [
        { pos: [-11, 16, -30], color: "#ffb25e", power: 5, falloff: 0.004 },
        { pos: [-7, 2.4, 7], color: "#ffa951", power: 0.8, falloff: 0.12 },
        { pos: [5, 5, -3], color: "#ffa951", power: 1.2, falloff: 0.05 },
        { pos: [0, 14, 2], color: "#ff9f48", power: 0.5, falloff: 0.03 },
      ],
      ambient: "#3d2d1c",
      ambientPower: 0.05,
      fog: "#1a0f07",
      fogDensity: 0.0042,
      rimDir: [0.05, 0.2, -1],
      rim: "#ffad58",
      rimPower: 0.6,
    });
    return {
      world,
      basis: diskBasis(new THREE.Vector3(...EYE), new THREE.Vector3(...HOLE), TILT, ROLL),
      map: worldMapTexture(),
      consoleBody: surface(world, { color: "#1a130b", shine: 40, spec: 0.9, rim: 0.8 }),
      consoleTrim: glow("#ffb45e", 4),
    };
  }, []);

  return (
    <group visible={visible}>
      <Sky options={SKY} />
      <Mountains world={world} radius={210} height={46} seed={21} color="#1e150e" />
      <Mountains world={world} radius={120} height={21} seed={14} color="#100b06" />
      <Mountains world={world} radius={62} height={8} seed={6} color="#0d0906" base={-3} />

      <group ref={hole}>
        <BlackHole position={HOLE} size={22} tilt={TILT} roll={ROLL} gain={1.15} bands={2.2} />
      </group>
      <DustDisk
        position={HOLE}
        quaternion={basis}
        count={7000}
        rMin={7.2}
        rMax={33}
        thickness={4}
        arms={2}
        twist={2.4}
        size={3}
        speed={3}
        intensity={1.2}
      />
      <Asteroids
        scene="contact"
        world={world}
        position={HOLE}
        quaternion={basis}
        count={56}
        rMin={10}
        rMax={30}
        thickness={8}
        size={0.8}
        speed={0.05}
      />

      <WetFloor size={120} tile={2.3} glowAt={[-2, 0, -4]} glowRange={8} strength={1.35} hide={hole} fade={60} />
      <Interior world={world} />
      <Railing world={world} radius={100} center={[-2, -106]} from={Math.PI / 2 - 0.15} arc={0.3} y={1.15} posts={32} />
      <Dish world={world} position={[3.8, 8.9, -11]} />
      <Tower world={world} />

      {/* Map console beside the viewer. */}
      <group position={[-7.1, 0, 7.4]} rotation={[0, 0.82, 0]}>
        <mesh position={[0, 0.55, 0]} material={consoleBody}>
          <boxGeometry args={[4.4, 1.1, 1.2]} />
        </mesh>
        <mesh position={[0, 1.45, -0.4]} rotation={[-0.36, 0, 0]} material={consoleBody}>
          <boxGeometry args={[4.6, 2.6, 0.12]} />
        </mesh>
        <mesh position={[0, 0.3, 0.62]} material={consoleTrim}>
          <boxGeometry args={[4.4, 0.03, 0.03]} />
        </mesh>
        <HoloPanel
          texture={map}
          position={[0, 1.47, -0.33]}
          rotation={[-0.36, 0, 0]}
          width={4.3}
          height={2.3}
          bob={0}
        />
      </group>

      <Figure kind="casual" position={[-1.75, 0, 8.1]} scale={1.03} rim={1.8} />
    </group>
  );
}
