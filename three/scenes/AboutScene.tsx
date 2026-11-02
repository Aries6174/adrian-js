"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Figure, Planet, Sky,
  Staged, type SkyOptions } from "../parts";
import {
  fbm,
  glow,
  HASH_GLSL,
  makeWorld,
  NOISE_GLSL,
  noiseUniforms,
  type Pose,
  ridged,
  seeded,
  smoothstep,
  surface,
  uTime,
  type World,
} from "../shared";
import { Boxes } from "./architecture";

const EYE: [number, number, number] = [0, 2.75, 13];
const NEBULA_HEART: [number, number, number] = [10, 34, -90];
const HAND = new THREE.Vector3(-1.2, 3.32, 4.2);

export const ABOUT_POSE: Pose = {
  position: EYE,
  target: [0, 4.3, -10],
  fov: 38,
  parallax: [0.55, 0.16],
  hole: NEBULA_HEART,
  portraitTarget: [-1, 4.8, -10],
};

const SKY: SkyOptions = {
  zenith: "#03040a",
  horizon: "#3d2616",
  sunDir: [-0.1, 0.012, -1],
  sun: "#ffbc70",
  sunPower: 1.2,
  glow: "#e08a38",
  glowPower: 1,
  clouds: 1,
  cloudTop: 0.17,
  cloudScale: 4.5,
  cloudShade: "#0b0a0e",
  cloudLit: "#f7a852",
  nebulaA: "#14326e",
  nebulaB: "#74aaff",
  nebula: 1.25,
  nebulaDir: [0.28, 0.36, -1],
  nebulaFocus: 3.5,
  stars: 1.5,
};

function terrainHeight(x: number, z: number) {
  const d = z + 6 - x * 0.45;
  const mass = smoothstep(-6, 4, d);
  const rise = smoothstep(9, -7, x) * 0.5;
  const bumps = (fbm(x * 0.28, 1, z * 0.28, 4) - 0.5) * 1.15 + (ridged(x * 0.8, 2, z * 0.8, 3) - 0.3) * 0.28;
  return (1.62 + rise + bumps) * mass - (1 - mass) * 15;
}

function Hill({ world }: { world: World }) {
  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(90, 70, 300, 240);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(5, 0, -18);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      position.setY(i, terrainHeight(position.getX(i), position.getZ(i)));
    }
    geometry.computeVertexNormals();
    return {
      geometry,
      material: surface(world, {
        color: "#0e0b08",
        accent: "#121208",
        detail: 2.4,
        bump: 0.7,
        shine: 20,
        spec: 0.02,
        rim: 0.04,
      }),
    };
  }, [world]);
  return <mesh geometry={geometry} material={material} />;
}

const GRASS_VERT = /* glsl */ `
uniform float uTime;
varying float vH;
varying vec3 vW;
void main(){
  vec3 p=position;
  vH=uv.y;
  vec4 w=instanceMatrix*vec4(p,1.);
  float sway=sin(uTime*.9+w.x*1.3+w.z*.9)*.1*uv.y*uv.y;
  w.x+=sway;
  w.z+=sway*.4;
  vW=(modelMatrix*w).xyz;
  gl_Position=projectionMatrix*viewMatrix*modelMatrix*w;
}`;

const GRASS_FRAG = /* glsl */ `
varying float vH;
varying vec3 vW;
void main(){
  vec3 col=mix(vec3(.003,.003,.002),vec3(.035,.028,.012),vH);
  col+=vec3(1.,.58,.2)*pow(vH,4.)*.16;
  gl_FragColor=vec4(col,1.);
}`;

function Grass() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 20000;
  const { geometry, material, transforms } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-0.03, 0, 0, 0.03, 0, 0, 0.015, 0.5, 0, -0.012, 0.55, 0, 0, 1, 0], 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 0.5, 0, 0.55, 0.5, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
    const material = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      side: THREE.DoubleSide,
      uniforms: { uTime },
    });
    const rand = seeded(5);
    const object = new THREE.Object3D();
    const transforms: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      const x = -11 + rand() * 20;
      const z = 2.5 + Math.pow(rand(), 0.7) * 6.5;
      const near = smoothstep(4, 9, z);
      object.position.set(x, terrainHeight(x, z) - 0.03, z);
      object.rotation.set((rand() - 0.5) * 0.7, rand() * Math.PI, (rand() - 0.5) * 0.7);
      const height = (0.1 + rand() * rand() * 0.3) * (0.8 + near * 0.4);
      object.scale.set(0.55 + near * 0.3, height, 1);
      object.updateMatrix();
      transforms.push(object.matrix.clone());
    }
    return { geometry, material, transforms };
  }, []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms]);

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
}

function Flowers() {
  const { geometry, material } = useMemo(() => {
    const rand = seeded(17);
    const positions: number[] = [];
    for (let i = 0; i < 90; i++) {
      const x = -11 + rand() * 8.5;
      const z = 6.5 + rand() * 5;
      positions.push(x, terrainHeight(x, z) + 0.28 + rand() * 0.3, z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(1.1, 0.95, 0.72),
      size: 0.022,
      sizeAttenuation: true,
    });
    return { geometry, material };
  }, []);
  return <points geometry={geometry} material={material} />;
}

function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) {
  const length = a.distanceTo(b);
  const geometry = new THREE.CylinderGeometry(r1, r0, length, 8, 1, true);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  geometry.applyQuaternion(quaternion);
  const middle = a.clone().add(b).multiplyScalar(0.5);
  geometry.translate(middle.x, middle.y, middle.z);
  return geometry;
}

function buildTree() {
  const rand = seeded(42);
  const parts: THREE.BufferGeometry[] = [];
  const tips: THREE.Vector3[] = [];

  const grow = (start: THREE.Vector3, heading: THREE.Vector3, length: number, radius: number, depth: number) => {
    const steps = depth > 3 ? 7 : 5;
    let point = start.clone();
    const direction = heading.clone().normalize();
    let thick = radius;
    for (let i = 0; i < steps; i++) {
      direction
        .add(new THREE.Vector3(rand() - 0.5, (rand() - 0.52) * 0.8, rand() - 0.5).multiplyScalar(0.3))
        .normalize();
      const next = point.clone().addScaledVector(direction, length / steps);
      const nextThick = thick * (depth > 4 ? 0.9 : 0.86);
      parts.push(cylinderBetween(point, next, thick, nextThick));
      if (depth < 3 || i > 2) tips.push(next.clone());
      // Keep side shoots coming off the long limbs.
      if (depth > 1 && i >= 1 && rand() < (depth > 3 ? 0.62 : 0.5)) {
        const out = new THREE.Vector3(rand() - 0.5, rand() * 0.5, rand() - 0.5).normalize().multiplyScalar(0.8).add(direction);
        grow(next, out, length * (0.62 + rand() * 0.18), nextThick * 0.72, depth - 1);
      }
      point = next;
      thick = nextThick;
    }
    if (depth > 0) {
      for (let k = 0; k < 2; k++) {
        const out = direction.clone().add(new THREE.Vector3(rand() - 0.5, rand() * 0.7 - 0.2, rand() - 0.5).multiplyScalar(1.15));
        grow(point, out, length * (0.64 + rand() * 0.15), thick * 0.74, depth - 1);
      }
    }
  };

  const base = new THREE.Vector3(-5.2, 0.2, 2.2);
  const crown = new THREE.Vector3(-5, 4.5, 2);
  parts.push(cylinderBetween(base, crown, 1.15, 0.72));
  // Exposed roots spreading from the base of the trunk.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand();
    const out = new THREE.Vector3(base.x + Math.cos(a) * 2.5, terrainHeight(base.x + Math.cos(a) * 2.5, base.z + Math.sin(a) * 2.5) - 0.2, base.z + Math.sin(a) * 2.5);
    parts.push(cylinderBetween(new THREE.Vector3(base.x, 2.1, base.z), out, 0.42, 0.1));
  }
  // Long limbs arch out toward the sky in the middle of the frame.
  const limbs: [number, number, number, number, number][] = [
    [1, 0.26, -0.1, 8.8, 0.36],
    [0.75, 0.42, -0.3, 7.4, 0.33],
    [-0.6, 0.45, 0.1, 6.2, 0.32],
    [0.85, 0.12, 0.5, 6.5, 0.28],
    [0.25, 0.5, -0.7, 6.4, 0.28],
  ];
  limbs.forEach(([x, y, z, length, radius]) => {
    grow(crown, new THREE.Vector3(x, y, z), length, radius, 4);
  });

  const wood = mergeGeometries(parts, false)!;
  wood.computeVertexNormals();
  parts.forEach((part) => part.dispose());
  return { wood, tips };
}

const LEAF_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vTint;
void main(){
  vUv=uv;
  vTint=instanceColor;
  vec3 p=position;
  vec4 w=instanceMatrix*vec4(p,1.);
  float t=uTime*1.1+w.x*1.4+w.y*.8;
  w.xyz+=vec3(sin(t),cos(t*.7),sin(t*1.3))*.03;
  gl_Position=projectionMatrix*viewMatrix*modelMatrix*w;
}`;

const LEAF_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
void main(){
  vec2 p=vUv-.5;
  // Five-lobed leaf.
  float a=atan(p.x,p.y+.28);
  float r=length(p+vec2(0.,.28));
  float lobe=.37+.22*abs(cos(a*2.5));
  if(r>lobe*(1.-smoothstep(.0,1.5,abs(a))*.6)) discard;
  gl_FragColor=vec4(vTint*(.7+.5*vUv.y),1.);
}`;

function Tree({ world }: { world: World }) {
  const leaves = useRef<THREE.InstancedMesh>(null);
  const leafCount = 30000;
  const { wood, bark, leafGeometry, leafMaterial, setup } = useMemo(() => {
    const { wood, tips } = buildTree();
    const leafGeometry = new THREE.PlaneGeometry(1, 1);
    const leafMaterial = new THREE.ShaderMaterial({
      vertexShader: LEAF_VERT,
      fragmentShader: LEAF_FRAG,
      side: THREE.DoubleSide,
      uniforms: { uTime },
    });
    const rand = seeded(8);
    const lantern = new THREE.Vector3(-4, 4.8, 3);
    const setup = (mesh: THREE.InstancedMesh) => {
      const object = new THREE.Object3D();
      const color = new THREE.Color();
      for (let i = 0; i < leafCount; i++) {
        const tip = tips[Math.floor(rand() * tips.length)];
        object.position.set(
          tip.x + (rand() - 0.5) * 1.5,
          tip.y + (rand() - 0.72) * 1.7,
          tip.z + (rand() - 0.5) * 1.5,
        );
        object.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
        object.scale.setScalar(0.11 + rand() * 0.17);
        object.updateMatrix();
        mesh.setMatrixAt(i, object.matrix);
        // Lit from the sunset side and from the lanterns; dark on top and behind.
        const low = smoothstep(10, 4, object.position.y);
        const glowNear = smoothstep(6, 0.5, object.position.distanceTo(lantern));
        const sunset = smoothstep(-8, 3, object.position.x) * low;
        const lit = rand() < 0.14 ? 0.16 + rand() * 0.34 : 0;
        const heat = 0.04 + Math.pow(rand(), 2) * 0.14 + sunset * 0.22 * rand() + glowNear * 0.65 + lit;
        color.setRGB(heat * 1.2, heat * 0.5, heat * 0.09);
        mesh.setColorAt(i, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    return {
      wood,
      bark: surface(world, { color: "#17110c", detail: 2.2, bump: 1.1, shine: 20, spec: 0.03, rim: 0.3, rimPower: 6 }),
      leafGeometry,
      leafMaterial,
      setup,
    };
  }, [world]);

  useEffect(() => {
    if (leaves.current) setup(leaves.current);
  }, [setup]);

  const { strips, strip, cables, cableMaterial } = useMemo(() => {
    const rand = seeded(3);
    const strips: number[][] = [];
    for (let i = 0; i < 12; i++) {
      const a = -0.5 + (i / 12) * 2.2;
      const r = 1 - (i % 3) * 0.08;
      const y = 1.8 + rand() * 3;
      strips.push([-5.1 + Math.cos(a) * r, y, 2.2 + Math.sin(a) * r, 0.05, 0.62 + rand() * 0.6, 0.05, 0, 0, (rand() - 0.5) * 0.15]);
    }
    const hanging = [0, 1, 2, 3, 4, 5].map((i) => {
      const startX = -4.5 + i * 0.28;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(startX, 5.4, 2.4 + i * 0.1),
        new THREE.Vector3(startX + 0.3, 3.8, 3.15),
        new THREE.Vector3(startX - 0.1, 1.8 - i * 0.08, 3.3),
      ]);
      return new THREE.TubeGeometry(curve, 16, 0.016, 5);
    });
    return {
      strips,
      strip: glow("#ffa64e", 1.9),
      cables: mergeGeometries(hanging, false)!,
      cableMaterial: new THREE.MeshBasicMaterial({ color: "#050403" }),
    };
  }, []);

  return (
    <group>
      <mesh geometry={wood} material={bark} />
      <instancedMesh ref={leaves} args={[leafGeometry, leafMaterial, leafCount]} frustumCulled={false} />
      <Boxes items={strips} material={strip} />
      <mesh geometry={cables} material={cableMaterial} />
    </group>
  );
}

/** Curling current of light rising from the seated figure's hand. */
function NebulaStream() {
  const { geometries, material } = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){
          vUv=uv;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        ${NOISE_GLSL}
        void main(){
          float along=vUv.x;
          float y=vUv.y-.5;
          vec2 q=vec2(along*7.-uTime*.1,y*4.);
          float warp=fbm2(q+vec2(0.,uTime*.05));
          float f=abs(y+(warp-.5)*.75);
          float filament=pow(smoothstep(.28,.0,f),2.5);
          float fine=pow(1.-abs(fbm2(q*3.+warp*2.)*2.-1.),6.);
          float env=smoothstep(0.,.02,along)*smoothstep(1.,.45,along)*smoothstep(.5,.2,abs(y));
          vec3 hot=vec3(1.,.73,.33);
          vec3 cold=vec3(.22,.42,.85);
          vec3 c=mix(hot,cold,smoothstep(.08,.5,along+(warp-.5)*.3));
          vec3 result=c*(filament*.26+fine*filament*.36+pow(smoothstep(.5,.0,abs(y)),2.)*.012)*env;
          gl_FragColor=vec4(result,1.);
        }`,
      uniforms: { ...noiseUniforms, uTime },
    });

    const makeStrip = (points: THREE.Vector3[], width: number, roll: number) => {
      const curve = new THREE.CatmullRomCurve3(points);
      const samples = 120;
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      const side = new THREE.Vector3();
      const view = new THREE.Vector3(0, 0, 1);
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const p = curve.getPoint(t);
        const tangent = curve.getTangent(t);
        side.crossVectors(tangent, view).normalize().applyAxisAngle(tangent, roll);
        const w = width * (0.004 + Math.pow(t, 2.1) * 0.95);
        positions.push(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
        positions.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
        uvs.push(t, 1, t, 0);
        if (i < samples) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      return geometry;
    };

    const path = (k: number) => [
      HAND.clone(),
      new THREE.Vector3(0.3, 3.9 + k * 0.25, 2),
      new THREE.Vector3(1.2 + k, 5.1, -4),
      new THREE.Vector3(-0.8 + k * 2, 7.6 + k, -13),
      new THREE.Vector3(1.8 - k * 2, 10.2, -24),
      new THREE.Vector3(-1.4 + k * 3, 14 + k * 2, -40),
      new THREE.Vector3(6 + k * 5, 24, -68),
      new THREE.Vector3(14 + k * 8, 40, -110),
    ];
    return {
      material,
      geometries: [
        makeStrip(path(0), 3.4, 0),
        makeStrip(path(0.45), 2.8, 0.5),
        makeStrip(path(-0.4), 3.1, -0.45),
      ],
    };
  }, []);

  return (
    <>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={material} renderOrder={3} frustumCulled={false} />
      ))}
    </>
  );
}

/** Sea of backlit cloud filling the valley below the hill. */
function CloudDeck() {
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
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vW;
          ${NOISE_GLSL}
          void main(){
            vec3 toCam=cameraPosition-vW;
            float dist=length(toCam);
            vec2 p=vW.xz*.022;
            p.x+=uTime*.004;
            float n=fbm2(p+fbm2(p*1.7)*.8);
            float e=.04;
            float n2=fbm2(p+vec2(-.1,-.72)*e*3.+fbm2(p*1.7)*.8);
            float lit=clamp((n-n2)*17.,0.,1.);
            vec3 c=mix(vec3(.018,.015,.016),vec3(.7,.35,.12),pow(lit,1.6));
            c*=.45+n;
            float far=1.-exp(-dist*.0028);
            c=mix(c,vec3(.46,.24,.09),far);
            gl_FragColor=vec4(c,1.);
          }`,
        uniforms: { ...noiseUniforms, uTime },
      }),
    [],
  );
  return (
    <mesh position={[0, -3.2, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[5000, 5000]} />
    </mesh>
  );
}

/** Spires across the valley, with thousands of tiny windows drawn in the shader. */
function City() {
  const { items, material, spireItems } = useMemo(() => {
    const rand = seeded(61);
    const items: number[][] = [];
    const spireItems: number[][] = [];
    const add = (x: number, z: number, h: number, w: number) => {
      items.push([x, -6 + h / 2, z, w, h, w, rand() * 0.4]);
      spireItems.push([x, -6 + h + h * 0.13, z, w * 0.22, h * 0.26, w * 0.22, 0]);
    };
    add(12, -150, 46, 4.6);
    add(5, -140, 26, 2.8);
    add(21, -165, 32, 3.2);
    add(-8, -180, 22, 3.2);
    add(34, -190, 26, 3.6);
    add(50, -240, 36, 4.2);
    for (let i = 0; i < 130; i++) {
      const x = -120 + rand() * 240;
      const z = -170 - rand() * 220;
      const h = 8 + Math.pow(rand(), 3) * 30;
      add(x, z, h, 1.6 + rand() * 2.8);
    }
    const material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec3 vW; varying vec3 vN;
        void main(){
          vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);
          vW=w.xyz;
          vN=normal;
          gl_Position=projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vW; varying vec3 vN;
        ${HASH_GLSL}
        void main(){
          vec2 cell=vec2(vW.x+vW.z,vW.y)*vec2(3.2,2.4);
          vec2 id=floor(cell);
          vec2 f=fract(cell);
          float on=step(.86,hash21(id))*step(.2,f.x)*step(f.x,.7)*step(.25,f.y)*step(f.y,.7);
          vec3 c=vec3(.01,.008,.008)+vec3(1.,.58,.2)*on*1.1*step(abs(vN.y),.5);
          float dist=length(cameraPosition-vW);
          float far=1.-exp(-dist*.0032);
          gl_FragColor=vec4(mix(c,vec3(.1,.058,.034),far),1.);
        }`,
    });
    return { items, spireItems, material };
  }, []);
  return (
    <>
      <Boxes items={items} material={material} />
      <Boxes items={spireItems} material={material} />
    </>
  );
}

export function AboutScene({ visible }: { visible: boolean }) {
  const { world } = useMemo(
    () => ({
      world: makeWorld({
        lights: [
          { pos: [-4, 3.2, 4.2], color: "#ffa951", power: 1.6, falloff: 0.14 },
          { pos: [3, 3.8, 1], color: "#ffbf73", power: 0.7, falloff: 0.1 },
          { pos: [-20, 8, -160], color: "#ff9c48", power: 0.35, falloff: 0 },
          { pos: [10, 40, -30], color: "#5c86d8", power: 0.1, falloff: 0 },
        ],
        ambient: "#2c2b39",
        ambientPower: 0.05,
        fog: "#1c120b",
        fogDensity: 0.004,
        rimDir: [-0.05, 0.08, -1],
        rim: "#ffa753",
        rimPower: 0.6,
      }),
    }),
    [],
  );

  return (
    <group visible={visible}>
      <Staged>
      <Sky options={SKY} />
      <Planet position={[140, 96, -300]} radius={46} light={[-0.8, 0.1, 0.6]} tint="#39435f" />
      <Planet position={[92, 74, -360]} radius={18} light={[-0.8, 0.2, 0.6]} tint="#343a56" />
      <CloudDeck />
      <City />
      <Hill world={world} />
      <Tree world={world} />
      <NebulaStream />
      <Grass />
      <Flowers />
      <Figure
        world={world}
        kind="hood"
        position={[-2.75, terrainHeight(-2.75, 4.7) - 0.03, 4.7]}
        rotationY={0.12}
        rim={1.5}
      />
      <Figure
        world={world}
        kind="seated"
        position={[-1.88, terrainHeight(-1.88, 4.2) + 0.03, 4.2]}
        rotationY={-0.1}
        rim={1.5}
      />
      </Staged>
    </group>
  );
}
