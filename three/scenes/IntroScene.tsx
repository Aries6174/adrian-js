"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Asteroids, BlackHole, DustDisk, Figure, Sky, type SkyOptions } from "../parts";
import {
  diskBasis,
  fbm,
  makeWorld,
  NOISE_GLSL,
  noise3,
  noiseUniforms,
  type Pose,
  ridged,
  smoothstep,
  surface,
  uTime,
  type World,
} from "../shared";

const EYE: [number, number, number] = [0, 6, 24];
const HOLE: [number, number, number] = [62, 118, -367];
const SUN: [number, number, number] = [-0.2, 0.018, -1];
const TILT = 0.36;
const ROLL = 0.34;

export const INTRO_POSE: Pose = {
  position: EYE,
  target: [0, 13, -40],
  fov: 38,
  parallax: [0.55, 0.16],
  hole: HOLE,
  portraitTarget: [10, 15, -40],
};

const SKY: SkyOptions = {
  zenith: "#030303",
  horizon: "#1a120a",
  sunDir: SUN,
  sun: "#ffc06e",
  sunPower: 1.5,
  glow: "#d3812c",
  glowPower: .8,
  clouds: 1,
  cloudTop: 0.2,
  cloudScale: 3.6,
  cloudShade: "#060504",
  cloudLit: "#f2a650",
  nebulaA: "#6a4018",
  nebulaB: "#ffbb6a",
  nebula: 0.5,
  nebulaDir: [HOLE[0] - EYE[0], HOLE[1] - EYE[1], HOLE[2] - EYE[2]],
  nebulaFocus: 12,
  stars: 1,
};

const coastX = (z: number) => -14 - 0.15 * (15 - z);

/** Seaward rocks. x, z, radius for the foam around them. */
const STACKS: [number, number, number, number][] = [
  [-11.8, -40, 3, 11],
  [-9.5, -13, 2.2, 6.5],
  [-28, -112, 4, 15],
  [-17, -70, 2.4, 9],
];

function makeFlat(x: number, z: number) {
  const dx = x;
  const dz = z - 12;
  return smoothstep(2.4, 0.7, Math.sqrt(dx * dx + dz * dz));
}

/** The headland the explorer stands on, filling the lower centre and right. */
function foregroundGeometry() {
  const columns = 420;
  const rows = 230;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const z = -8 + (r / rows) * 34;
    for (let c = 0; c <= columns; c++) {
      const x = -13 + (c / columns) * 66;
      const wobble = (fbm(x * 0.16, 0.5, z * 0.16, 3) - 0.5) * 9;
      const left = smoothstep(-5.5, -2.2, x + wobble * 0.4 + (z - 12) * 0.12);
      const back = smoothstep(3.5 - x * 0.38, 10 - x * 0.22, z + wobble * 0.6);
      const mass = left * back;
      const rise = 5.35 - Math.max(0, x) * 0.045;
      const crag = ridged(x * 0.42, 0, z * 0.42, 5) * 1.25 + fbm(x * 1.6, 2, z * 1.6, 3) * 0.65 - 0.9;
      let y = mass * (rise + crag * 0.8) - (1 - mass) * 1.2;
      y = THREE.MathUtils.lerp(y, 5.42, makeFlat(x, z));
      vertices.push(x, y, z);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Long cliff line running from the near left out to the horizon. */
function coastGeometry() {
  const columns = 240;
  const rows = 360;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const z = -6 - Math.pow(r / rows, 1.5) * 410;
    const far = smoothstep(-20, -300, z);
    const edge = coastX(z) + (fbm(z * 0.022, 1.2, 0.4, 2) - 0.5) * 18;
    const crest = 10 + (1 - far) * 6 + (fbm(z * 0.018, 4, 1, 2) - 0.5) * 7;
    for (let c = 0; c <= columns; c++) {
      const x = -2 - Math.pow(c / columns, 1.6) * 240;
      const inland = edge - x;
      const face = smoothstep(-1.5, 5, inland + (noise3(x * 0.12, z * 0.12, 3) - 0.5) * 2.2);
      const top = (ridged(x * 0.07, 2, z * 0.07, 4) - 0.35) * 4.5 * smoothstep(1, 12, inland);
      const y = face * (crest + top) + (fbm(x * 0.5, z * 0.5, 8, 2) - 0.5) * 1.2 - 1.4;
      vertices.push(x, y, z);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c;
      const b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function stackGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(1, 16);
  const position = geometry.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const taper = 1 - smoothstep(-0.3, 1, v.y) * 0.72;
    const k = 0.55 + fbm(v.x * 2.4 + seed, v.y * 3, v.z * 2.4, 4) * 0.9;
    position.setXYZ(i, v.x * k * taper, v.y, v.z * k * taper);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir,uSun,uDeep,uSky,uGlow;
uniform vec4 uRocks[4];
varying vec3 vW;
${NOISE_GLSL}
float H(vec2 p){
  float t=uTime;
  float s=vnoise(p*.11+vec2(t*.12,t*.05))*1.5;
  s+=vnoise(p*.37+vec2(-t*.2,t*.14))*.6;
  s+=vnoise(p*1.15+vec2(t*.45,-t*.3))*.22;
  s+=vnoise(p*3.3+vec2(-t*.7,t*.6))*.07;
  return s;
}
float coast(float z){ return -14.-.15*(15.-z); }
void main(){
  vec3 toCam=cameraPosition-vW;
  float dist=length(toCam);
  vec3 V=toCam/dist;
  vec2 p=vW.xz;
  float e=.12+dist*.006;
  float h0=H(p);
  vec3 N=normalize(vec3((h0-H(p+vec2(e,0.)))/e,1.25,(h0-H(p+vec2(0.,e)))/e));
  vec3 R=reflect(-V,N);
  R.y=abs(R.y);
  float F=.03+.97*pow(1.-max(dot(N,V),0.),5.);
  float s=max(dot(R,uSunDir),0.);
  vec3 sky=mix(uGlow*(.08+pow(s,5.)*1.1),uSky,smoothstep(0.,.3,R.y));
  vec3 col=mix(uDeep,sky,F);
  float col_spec=pow(s,300.)*9.+pow(s,60.)*.32;
  col+=uSun*col_spec*.45;
  // Foam: broken white water against the cliffs and around each stack.
  float near=(coast(p.y)-p.x)*-1.;
  float shore=near+(fbm2(vec2(p.y*.05,1.2))-.5)*-16.;
  float reach=smoothstep(9.,0.,abs(shore));
  for(int i=0;i<4;i++){
    float d=length((p-uRocks[i].xy)/vec2(1.,1.5))-uRocks[i].z;
    reach=max(reach,smoothstep(uRocks[i].w,0.,d));
  }
  float headland=smoothstep(11.,0.,length((p-vec2(-1.,7.))/vec2(1.,.7))-11.);
  reach=max(reach,headland);
  float f1=fbm2(p*.42+vec2(uTime*.11,-uTime*.08));
  float f2=fbm2(p*1.45-vec2(uTime*.16,uTime*.05));
  float foam=smoothstep(.62-reach*.4,.82-reach*.3,f1*.65+f2*.45)*reach;
  foam+=smoothstep(.56,.74,f2)*smoothstep(.2,1.,reach)*.45;
  float crests=smoothstep(.72,.95,vnoise(p*vec2(.16,.5)+vec2(uTime*.1,0.)))*.025;
  col=mix(col,vec3(.34,.31,.27),clamp(foam,0.,1.));
  col+=crests*vec3(.8,.72,.6);
  float far=1.-exp(-dist*dist*.0000065);
  gl_FragColor=vec4(mix(col,uSky*.6+uGlow*.2,far),1.);
}`;

function Water() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vW;
          void main(){
            vec4 w=modelMatrix*vec4(position,1.);
            vW=w.xyz;
            gl_Position=projectionMatrix*viewMatrix*w;
          }`,
        fragmentShader: WATER_FRAG,
        uniforms: {
          ...noiseUniforms,
          uTime,
          uSunDir: { value: new THREE.Vector3(...SUN).normalize() },
          uSun: { value: new THREE.Color("#ffb868").multiplyScalar(1.5) },
          uDeep: { value: new THREE.Color("#050608") },
          uSky: { value: new THREE.Color("#14100b") },
          uGlow: { value: new THREE.Color("#c67a30") },
          uRocks: { value: STACKS.map((s) => new THREE.Vector4(s[0], s[1], s[2], s[3])) },
        },
      }),
    [],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[6000, 6000]} />
    </mesh>
  );
}

function Land({ world }: { world: World }) {
  const { foreground, coast, stacks, rock, farRock } = useMemo(
    () => ({
      foreground: foregroundGeometry(),
      coast: coastGeometry(),
      stacks: [stackGeometry(1), stackGeometry(4), stackGeometry(7), stackGeometry(11)],
      rock: surface(world, {
        color: "#201a15",
        accent: "#2c2814",
        flat: true,
        detail: 2.3,
        bump: 0.8,
        shine: 120,
        spec: 1.1,
        rim: 0.16,
      }),
      farRock: surface(world, {
        color: "#1f1a15",
        accent: "#2a2613",
        detail: 0.9,
        bump: 0.6,
        shine: 30,
        spec: 0.25,
        rim: 0.45,
      }),
    }),
    [world],
  );
  return (
    <>
      <mesh geometry={foreground} material={rock} />
      <mesh geometry={coast} material={farRock} />
      <mesh geometry={stacks[2]} material={farRock} position={[-16.5, -1, 7]} scale={[9, 8.4, 10]} />
      <mesh geometry={stacks[3]} material={farRock} position={[-11.4, -1, 12]} scale={[4.6, 4.2, 5]} />
      {STACKS.map(([x, z, radius], index) => (
        <mesh
          key={index}
          geometry={stacks[index]}
          material={farRock}
          position={[x, 0, z]}
          scale={[radius, radius * 2.3, radius]}
        />
      ))}
    </>
  );
}

export function IntroScene({ visible }: { visible: boolean }) {
  const { world, basis } = useMemo(
    () => ({
      world: makeWorld({
        lights: [
          { pos: HOLE, color: "#ffb35e", power: 0.4, falloff: 0.000002 },
          { pos: [-200, 16, -1000], color: "#ff9d48", power: 0.24, falloff: 0 },
          { pos: [8, 40, 40], color: "#8d7a64", power: 0.05, falloff: 0 },
        ],
        ambient: "#3a2f24",
        ambientPower: 0.1,
        fog: "#1d150d",
        fogDensity: 0.0035,
        rimDir: SUN,
        rim: "#ffae58",
        rimPower: 0.45,
      }),
      basis: diskBasis(new THREE.Vector3(...EYE), new THREE.Vector3(...HOLE), TILT, ROLL),
    }),
    [],
  );

  return (
    <group visible={visible}>
      <Sky options={SKY} />
      <BlackHole position={HOLE} size={176} tilt={TILT} roll={ROLL} gain={1.05} />
      <DustDisk
        position={HOLE}
        quaternion={basis}
        count={9000}
        rMin={70}
        rMax={285}
        thickness={34}
        arms={3}
        twist={3}
        size={24}
        speed={8}
        intensity={1.2}
      />
      <Asteroids
        scene="intro"
        world={world}
        position={HOLE}
        quaternion={basis}
        count={70}
        rMin={72}
        rMax={205}
        thickness={30}
        size={4.6}
      />
      <Water />
      <Land world={world} />
      <Figure kind="hood" position={[0, 5.36, 12]} scale={1} rim={1.6} />
    </group>
  );
}
