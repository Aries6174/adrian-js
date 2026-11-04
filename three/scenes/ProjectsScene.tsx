"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Project } from "@/lib/content";
import { getStage, PROJECTS_IN_VIEW, setStage, useStage } from "@/lib/stage";
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
import { projectPanelTexture } from "../panelTexture";
import {
  diskBasis,
  fbm,
  makeWorld,
  type Pose,
  ridged,
  smoothstep,
  uTime,
} from "../shared";
import { Console, Railing, Rotunda } from "./architecture";

const EYE: [number, number, number] = [0, 1.5, 15.5];
const HOLE: [number, number, number] = [10, 13, -24];
const TILT = 0.5;
const ROLL = 0.3;

export const PROJECTS_POSE: Pose = {
  position: EYE,
  target: [0, 2.7, -6],
  fov: 38,
  parallax: [0.5, 0.14],
  hole: HOLE,
  portraitTarget: [0.6, 3.8, -6],
};

const SKY: SkyOptions = {
  zenith: "#040302",
  horizon: "#1d1209",
  sunDir: [-0.5, 0.03, -1],
  sun: "#ffbb6e",
  sunPower: 0.7,
  glow: "#c9792a",
  glowPower: 0.45,
  nebula: 0.6,
  nebulaDir: [0.3, 0.5, -1],
  nebulaFocus: 3,
  stars: 1.2,
};

const LAYOUT: {
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
}[] = [
  { position: [-2.9, 6.25, -1.6], rotation: [0.03, 0.34, -0.08], width: 4 },
  { position: [2.05, 5.55, -3.2], rotation: [0.02, -0.08, -0.05], width: 3.4 },
  { position: [-3.7, 3.1, -0.4], rotation: [0.02, 0.36, -0.06], width: 3.5 },
  { position: [1.2, 2.75, -1.8], rotation: [0.03, 0.05, -0.03], width: 3.7 },
  { position: [4.75, 2.85, -3], rotation: [0.03, -0.24, 0.03], width: 2.3 },
];

/** Gold contour hologram of a mountain range, floating over the central table. */
function Hologram({ position }: { position: [number, number, number] }) {
  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(9.6, 9.6, 180, 180);
    geometry.rotateX(-Math.PI / 2);
    const attribute = geometry.getAttribute("position");
    for (let i = 0; i < attribute.count; i++) {
      const x = attribute.getX(i);
      const z = attribute.getZ(i);
      const edge = smoothstep(4.7, 1.2, Math.hypot(x, z));
      const peak = ridged(x * 0.34 + 3, 0, z * 0.34, 4) + fbm(x * 0.9, 2, z * 0.9, 2) * 0.22;
      attribute.setY(i, Math.pow(peak, 1.9) * 2.1 * edge);
    }
    geometry.computeVertexNormals();
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying float vH; varying vec2 vXZ;
        void main(){
          vH=position.y; vXZ=position.xz;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying float vH; varying vec2 vXZ;
        void main(){
          float r=length(vXZ);
          float mask=smoothstep(4.75,4.25,r);
          float lines=smoothstep(.1,0.,abs(fract(vH*6.-uTime*.05)-.5));
          float fill=smoothstep(0.,1.5,vH);
          vec3 c=vec3(1.,.6,.2)*(lines*.5+fill*.42+.012);
          c+=vec3(1.,.8,.5)*pow(fill,3.)*.3;
          gl_FragColor=vec4(c*mask,1.);
        }`,
      uniforms: { uTime },
    });
    return { geometry, material };
  }, []);
  return <mesh geometry={geometry} material={material} position={position} renderOrder={3} />;
}

/** Where a panel sits at any point along the row of slots, including just off either end. */
function placeSlot(t: number, group: THREE.Group) {
  const last = LAYOUT.length - 1;
  const clamped = THREE.MathUtils.clamp(t, 0, last);
  const from = LAYOUT[Math.floor(clamped)];
  const to = LAYOUT[Math.ceil(clamped)];
  const k = clamped - Math.floor(clamped);
  const overrun = t - clamped;
  group.position.set(
    THREE.MathUtils.lerp(from.position[0], to.position[0], k) + overrun * 3.2,
    THREE.MathUtils.lerp(from.position[1], to.position[1], k),
    THREE.MathUtils.lerp(from.position[2], to.position[2], k) - Math.abs(overrun) * 1.5,
  );
  group.rotation.set(
    THREE.MathUtils.lerp(from.rotation[0], to.rotation[0], k),
    THREE.MathUtils.lerp(from.rotation[1], to.rotation[1], k),
    THREE.MathUtils.lerp(from.rotation[2], to.rotation[2], k),
  );
  group.scale.setScalar(THREE.MathUtils.lerp(from.width, to.width, k));
}

function ProjectPanel({
  project,
  number,
  slot,
  selected,
}: {
  project: Project;
  number: number;
  slot: number;
  selected: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef({ t: slot, ready: false });
  const fade = useRef(0);
  const texture = useMemo(
    () =>
      projectPanelTexture(
        String(number).padStart(2, "0"),
        project.title,
        project.image,
        number * 7 + 3,
      ),
    [number, project.title, project.image],
  );

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const state = motion.current;
    state.t += (slot - state.t) * (1 - Math.exp(-delta * 6));
    const inView = slot > -0.5 && slot < PROJECTS_IN_VIEW - 0.5;
    fade.current += ((inView ? 1 : 0) - fade.current) * (1 - Math.exp(-delta * 8));
    node.visible = fade.current > 0.01;
    placeSlot(state.t, node);
  });

  return (
    <group ref={group}>
      <HoloPanel
        texture={texture}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        width={1}
        height={0.632}
        hover={selected ? 0.55 : 0}
        phase={number * 1.7}
        bob={0.012}
        fade={fade}
        onSelect={() => {
          if (getStage().scene === "projects") setStage({ projectId: project.id });
        }}
      />
    </group>
  );
}

export function ProjectsScene({ visible }: { visible: boolean }) {
  const hole = useRef<THREE.Group>(null);
  const projects = useStage((s) => s.projects);
  const selectedId = useStage((s) => s.projectId);
  const scroll = useStage((s) => s.projectScroll);
  const filter = useStage((s) => s.filter);
  const list = projects.filter(
    (project) => filter === "all" || project.categories.some((category) => category === filter),
  );
  const activeId = selectedId && list.some((project) => project.id === selectedId) ? selectedId : list[0]?.id;
  const start = Math.min(scroll, Math.max(0, list.length - PROJECTS_IN_VIEW));

  const { world, basis } = useMemo(() => {
    const world = makeWorld({
      lights: [
        { pos: HOLE, color: "#ffb25e", power: 3.5, falloff: 0.012 },
        { pos: [1.5, 2.5, 1.5], color: "#ffa951", power: 1.6, falloff: 0.09 },
        { pos: [-12, 6, 6], color: "#ff9f48", power: 1.2, falloff: 0.06 },
        { pos: [3, 3, 14], color: "#a37a4f", power: 0.1, falloff: 0.02 },
      ],
      ambient: "#3d2d1c",
      ambientPower: 0.05,
      fog: "#0a0604",
      fogDensity: 0.0045,
      rimDir: [0.35, 0.4, -1],
      rim: "#ffad58",
      rimPower: 0.6,
    });
    return {
      world,
      basis: diskBasis(new THREE.Vector3(...EYE), new THREE.Vector3(...HOLE), TILT, ROLL),
    };
  }, []);

  return (
    <group visible={visible}>
      <Staged>
      <Sky options={SKY} />
      <Mountains world={world} radius={150} height={26} seed={5} color="#1a140e" />
      <Mountains world={world} radius={90} height={14} seed={12} />
      <Planet position={[66, 30, -80]} radius={30} light={[-0.9, 0.5, 0.3]} />

      <Rotunda world={world} radius={24} height={38} center={[1.5, 0]} />
      <WetFloor size={120} tile={2.6} glowAt={[1.5, 0, 0]} glowRange={9} strength={0.7} hide={hole} />

      <group ref={hole}>
        <BlackHole position={HOLE} size={21} tilt={TILT} roll={ROLL} gain={1.4} bands={2.2} />
      </group>
      <DustDisk
        position={HOLE}
        quaternion={basis}
        count={8000}
        rMin={8.4}
        rMax={34}
        thickness={4}
        arms={2}
        twist={2.5}
        size={1.9}
        speed={3}
        intensity={1.3}
      />
      <Asteroids
        scene="projects"
        world={world}
        position={HOLE}
        quaternion={basis}
        count={70}
        rMin={9}
        rMax={28}
        thickness={9}
        size={0.55}
        speed={0.06}
      />
      <LightShaft position={[1.5, 19, 0]} radiusTop={4.6} radiusBottom={4.8} height={38} power={0.012} />

      {/* Holographic table */}
      <group position={[1.5, 0, 0]}>
        {[5.4, 4.9, 4.1, 3.2, 2.2].map((radius, index) => (
          <GlowRing key={radius} radius={radius} position={[0, 0.3 + index * 0.012, 0]} tube={index < 2 ? 0.04 : 0.018} power={index < 2 ? 1.5 : 0.9} />
        ))}
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[5.45, 5.6, 0.28, 96]} />
          <meshBasicMaterial color="#090705" />
        </mesh>
        <Hologram position={[0, 0.32, 0]} />
      </group>

      <Railing world={world} radius={8.7} center={[1.5, 0]} from={0.2} arc={Math.PI * 1.15} />
      <Railing world={world} radius={13.2} center={[1.5, 0]} from={1.9} arc={1.1} y={1.1} />
            <Console world={world} position={[-5.4, 0, 8.3]} rotationY={0.55} scale={0.72} seed={13} />

      {list.map((project, index) => {
        const slot = index - start;
        // Panels one step outside the view stay ready, so they can glide in and out.
        if (slot < -1 || slot > PROJECTS_IN_VIEW) return null;
        return (
          <ProjectPanel
            key={project.id}
            project={project}
            number={index + 1}
            slot={slot}
            selected={project.id === activeId}
          />
        );
      })}

      <Figure world={world} kind="casual" position={[-0.9, 0, 9.8]} rim={1.8} />
      </Staged>
    </group>
  );
}
