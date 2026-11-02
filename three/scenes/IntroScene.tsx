"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Asteroids, BlackHole, DustDisk, Figure, rockGeometry, Sky,
  Staged, type SkyOptions } from "../parts";
import {
  diskBasis,
  fbm,
  makeWorld,
  NOISE_GLSL,
  noise3,
  noiseUniforms,
  type Pose,
  ridged,
  seeded,
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
  zenith: "#010101",
  horizon: "#0e0a06",
  sunDir: SUN,
  sun: "#ffc06e",
  sunPower: 1.7,
  glow: "#d3812c",
  glowPower: .7,
  clouds: 1,
  cloudTop: 0.21,
  cloudScale: 3.6,
  cloudShade: "#0c0906",
  cloudLit: "#efa55a",
  nebulaA: "#6a4018",
  nebulaB: "#ffbb6a",
  nebula: 0.75,
  nebulaDir: [HOLE[0] - EYE[0], HOLE[1] - EYE[1], HOLE[2] - EYE[2]],
  nebulaFocus: 7,
  stars: 1.5,
};

const coastX = (z: number) => -14 - 0.15 * (15 - z);
const COAST_NEAR = -4;
const COAST_LENGTH = 420;

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

function headlandHeight(x: number, z: number) {
  const wobble = (fbm(x * 0.16, 0.5, z * 0.16, 3) - 0.5) * 9;
  const left = smoothstep(-5.5, -2.2, x + wobble * 0.4 + (z - 12) * 0.12);
  const back = smoothstep(3.5 - x * 0.38, 10 - x * 0.22, z + wobble * 0.6);
  const mass = left * back;
  const rise = 5.35 - Math.max(0, x) * 0.045;
  const crag =
    ridged(x * 0.26, 0, z * 0.26, 3) * 1.55 +
    ridged(x * 1.05, 3, z * 1.05, 2) * 0.5 +
    ridged(x * 3.2, 6, z * 3.2, 2) * 0.13 -
    1.02;
  const y = mass * (rise + crag * 0.85) - (1 - mass) * 1.2;
  return THREE.MathUtils.lerp(y, 5.42, makeFlat(x, z));
}

/** The headland the explorer stands on, filling the lower centre and right. */
function foregroundGeometry() {
  const columns = 400;
  const rows = 220;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const z = -8 + (r / rows) * 34;
    for (let c = 0; c <= columns; c++) {
      const x = -13 + (c / columns) * 66;
      vertices.push(x, headlandHeight(x, z), z);
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

/** Loose rocks scattered over the headland to break up its outline. */
function Boulders({ world }: { world: World }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geometry, material, placed } = useMemo(() => {
    const rand = seeded(77);
    const object = new THREE.Object3D();
    const placed: THREE.Matrix4[] = [];
    while (placed.length < 150) {
      const x = -4 + rand() * 30;
      const z = 3 + rand() * 18;
      if (Math.hypot(x, z - 12) < 1.4) continue;
      const y = headlandHeight(x, z);
      if (y < 2.4) continue;
      object.position.set(x, y - 0.05, z);
      const size = 0.08 + Math.pow(rand(), 4) * 0.72;
      object.scale.set(size * (0.8 + rand() * 0.8), size * (0.5 + rand() * 0.5), size * (0.8 + rand() * 0.8));
      object.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      object.updateMatrix();
      placed.push(object.matrix.clone());
    }
    return {
      geometry: rockGeometry(9),
      material: surface(world, {
        color: "#231d17",
        accent: "#2e2d13",
        flat: true,
        detail: 3.4,
        bump: 0.9,
        shine: 160,
        spec: 1.3,
        rim: 0.12,
      }),
      placed,
    };
  }, [world]);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placed.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
  }, [placed]);
  return <instancedMesh ref={ref} args={[geometry, material, placed.length]} frustumCulled={false} />;
}

/** x of the waterline along the coast. Shared with the water so the foam meets the cliffs. */
function coastEdge(z: number) {
  return coastX(z) + (fbm(z * 0.022, 1.2, 0.4, 2) - 0.5) * 18;
}

/** Long cliff line running out to the horizon, sinking into the sea at its near end. */
function coastGeometry() {
  const columns = 200;
  const rows = 300;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const z = COAST_NEAR - Math.pow(r / rows, 1.5) * COAST_LENGTH;
    const far = smoothstep(-20, -300, z);
    const edge = coastEdge(z);
    const headland = smoothstep(COAST_NEAR, COAST_NEAR - 30, z);
    const crest = (10 + (1 - far) * 6 + (fbm(z * 0.018, 4, 1, 2) - 0.5) * 7) * headland;
    for (let c = 0; c <= columns; c++) {
      const x = -2 - Math.pow(c / columns, 1.6) * 240;
      const inland = edge - x;
      const face = smoothstep(-1.5, 5, inland + (noise3(x * 0.12, z * 0.12, 3) - 0.5) * 2.2);
      const top = (ridged(x * 0.07, 2, z * 0.07, 3) - 0.35) * 4.5 * smoothstep(1, 12, inland);
      const y = face * (crest + top * headland) + (fbm(x * 0.22, z * 0.22, 8, 2) - 0.5) * 1.1 - 1.4;
      vertices.push(x, y, z);
    }
  }
  // x falls with each column and z with each row, so this order faces upward.
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

/** A weathered sea stack: chunky, layered and closed, with smooth shared normals. */
function stackGeometry(seed: number) {
  const icosahedron = new THREE.IcosahedronGeometry(1, 14);
  icosahedron.deleteAttribute("normal");
  icosahedron.deleteAttribute("uv");
  const geometry = mergeVertices(icosahedron, 1e-4);
  const position = geometry.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const taper = 1 - smoothstep(-0.2, 1, v.y) * 0.46;
    const strata = 1 + (noise3(seed, v.y * 7, seed * 2) - 0.5) * 0.3;
    const k = (0.62 + fbm(v.x * 1.9 + seed, v.y * 2.2, v.z * 1.9, 3) * 0.78) * strata;
    position.setXYZ(i, v.x * k * taper, v.y * (0.9 + k * 0.14), v.z * k * taper);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir,uSun,uDeep,uSky,uGlow;
uniform vec4 uRocks[4];
uniform sampler2D uCoast;
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
  vec3 sky=mix(uGlow*(.006+pow(s,70.)*1.3),uSky,smoothstep(0.,.3,R.y));
  vec3 col=mix(uDeep,sky,F);
  float col_spec=pow(s,400.)*9.+pow(s,110.)*.25;
  col+=uSun*col_spec*.45;
  // Foam: broken white water against the cliffs and around each stack.
  float along=clamp((${COAST_NEAR.toFixed(1)}-p.y)/${COAST_LENGTH.toFixed(1)},0.,1.);
  float shore=p.x-mix(-160.,0.,texture2D(uCoast,vec2(along,.5)).r);
  float reach=smoothstep(7.,0.,abs(shore))*smoothstep(${COAST_NEAR.toFixed(1)},${COAST_NEAR.toFixed(1)}-30.,p.y);
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
  col=mix(col,vec3(.66,.62,.56),clamp(foam,0.,1.));
  col+=crests*vec3(.8,.72,.6);
  float far=1.-exp(-dist*dist*.0000065);
  gl_FragColor=vec4(mix(col,uSky*.7+uGlow*.012,far),1.);
}`;

function coastTexture() {
  const samples = 512;
  const data = new Uint8Array(samples);
  for (let i = 0; i < samples; i++) {
    const z = COAST_NEAR - (i / (samples - 1)) * COAST_LENGTH;
    data[i] = Math.round(THREE.MathUtils.clamp(1 + coastEdge(z) / 160, 0, 1) * 255);
  }
  const texture = new THREE.DataTexture(data, samples, 1, THREE.RedFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

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
          uCoast: { value: coastTexture() },
          uTime,
          uSunDir: { value: new THREE.Vector3(...SUN).normalize() },
          uSun: { value: new THREE.Color("#ffb868").multiplyScalar(1.5) },
          uDeep: { value: new THREE.Color("#07090c") },
          uSky: { value: new THREE.Color("#2a2c2e") },
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

function Foreground({ world }: { world: World }) {
  const { geometry, material } = useMemo(
    () => ({
      geometry: foregroundGeometry(),
      material: surface(world, {
        color: "#262019",
        accent: "#35331a",
        flat: true,
        detail: 3.4,
        bump: 0.85,
        shine: 170,
        spec: 0.8,
        rim: 0.08,
      }),
    }),
    [world],
  );
  return <mesh geometry={geometry} material={material} />;
}

function useFarRock(world: World) {
  return useMemo(
    () =>
      surface(world, {
        color: "#1f1a15",
        accent: "#2a2613",
        detail: 1.7,
        bump: 1.2,
        shine: 30,
        spec: 0.2,
        rim: 0.1,
      }),
    [world],
  );
}

function Coast({ world }: { world: World }) {
  const geometry = useMemo(() => coastGeometry(), []);
  const material = useFarRock(world);
  return <mesh geometry={geometry} material={material} />;
}

function Stacks({ world }: { world: World }) {
  const stacks = useMemo(() => [stackGeometry(1), stackGeometry(4), stackGeometry(7), stackGeometry(11)], []);
  const material = useFarRock(world);
  return (
    <>
      <mesh geometry={stacks[2]} material={material} position={[-16.5, -1, 7]} scale={[9, 8.4, 10]} />
      <mesh geometry={stacks[3]} material={material} position={[-11.4, -1, 12]} scale={[4.6, 4.2, 5]} />
      {STACKS.map(([x, z, radius], index) => (
        <mesh
          key={index}
          geometry={stacks[index]}
          material={material}
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
          { pos: HOLE, color: "#ffb35e", power: 0.95, falloff: 0.000002 },
          { pos: [-200, 16, -1000], color: "#ff9d48", power: 0.24, falloff: 0 },
          { pos: [8, 40, 40], color: "#8d7a64", power: 0.05, falloff: 0 },
        ],
        ambient: "#3a2f24",
        ambientPower: 0.17,
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
      <Staged>
      <Sky options={SKY} />
      <BlackHole position={HOLE} size={176} tilt={TILT} roll={ROLL} gain={1.05} />
      <DustDisk
        position={HOLE}
        quaternion={basis}
        count={26000}
        rMin={96}
        rMax={300}
        thickness={20}
        arms={3}
        twist={3}
        size={9}
        speed={8}
        intensity={0.85}
      />
      <Asteroids
        scene="intro"
        world={world}
        position={HOLE}
        quaternion={basis}
        count={130}
        rMin={85}
        rMax={185}
        thickness={12}
        size={2.5}
      />
      <Water />
      <Foreground world={world} />
      <Coast world={world} />
      <Stacks world={world} />
      <Boulders world={world} />
      <Figure world={world} kind="hood" position={[0, 5.36, 12]} scale={1} rim={1.5} />
      </Staged>
    </group>
  );
}
