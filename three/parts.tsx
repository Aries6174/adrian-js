"use client";

import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Children, createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { getStage, type SceneId } from "@/lib/stage";
import {
  bakes,
  compileFor,
  fbm,
  glow,
  HASH_GLSL,
  isShown,
  NOISE_GLSL,
  noiseUniforms,
  ridged,
  seeded,
  smoothstep,
  surface,
  uTime,
  type World,
} from "./shared";

/** Told when every part of a world has been built. */
export const WorldBuilt = createContext<(() => void) | null>(null);

/** Builds its children one per frame, so one heavy world doesn't freeze the page. */
export function Staged({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const [count, setCount] = useState(1);
  const built = useContext(WorldBuilt);
  const finished = count >= items.length;
  useFrame(() => {
    if (!finished) setCount((current) => current + 1);
  });
  useEffect(() => {
    if (finished) built?.();
  }, [finished, built]);
  return <>{items.slice(0, count)}</>;
}

/** Worlds stay mounted while hidden, so their clickable parts must opt out of hit testing. */
function raycastVisible(
  this: THREE.Mesh,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[],
) {
  if (!this.visible) return;
  for (let node = this.parent; node; node = node.parent) {
    if (!node.visible) return;
  }
  THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
}

/* ---------------------------------- Black hole ---------------------------------- */

const HOLE_VERT = /* glsl */ `
varying vec2 vP;
void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

const HOLE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uTilt;
uniform float uRoll;
uniform float uGain;
uniform float uBands;
uniform int uSteps;
varying vec2 vP;
${NOISE_GLSL}
const float RIN=2.35;
const float ROUT=13.5;
vec4 disk(vec3 hit,vec3 ray){
  float r=length(hit.xz);
  if(r<RIN||r>ROUT) return vec4(0.);
  float a=atan(hit.z,hit.x);
  float phi=a+uTime*1.9/pow(r,1.5);
  float sp=phi+log(r)*.9;
  vec2 dir=vec2(cos(sp),sin(sp));
  float big=fbm3(vec3(dir*1.2,r*.55));
  float warped=r+(big-.5)*1.5;
  float arcs=vnoise3(vec3(dir*.9,warped*6.))*.55+vnoise3(vec3(dir*2.2,warped*17.))*.45;
  float fine=vnoise3(vec3(dir*4.,warped*44.));
  float bands=pow(arcs,uBands*1.3)*(.3+fine*1.4);
  float edge=smoothstep(RIN,RIN+.3,r)*pow(smoothstep(ROUT,RIN+.8,r),2.6);
  float hot=exp(-(r-RIN)*.62);
  float dens=edge*(.13+bands*2.9)*(.25+big*1.6);
  // The side of the disk rotating toward the viewer burns brighter.
  vec3 tangent=normalize(vec3(-hit.z,0.,hit.x));
  float dop=1.+.62*dot(tangent,-ray);
  float heat=clamp(dens*(.3+hot*1.3),0.,1.);
  vec3 c=mix(vec3(.55,.17,.03),vec3(1.,.55,.16),smoothstep(.02,.32,heat));
  c=mix(c,vec3(1.,.82,.52),smoothstep(.4,.95,heat));
  c*=dens*(.34+hot*1.55)*dop*dop;
  return vec4(c,clamp(dens*.8,0.,1.));
}
void main(){
  float cr=cos(-uRoll),sr=sin(-uRoll);
  vec2 uv=mat2(cr,-sr,sr,cr)*vP;
  float D=26.;
  vec3 ro=vec3(0.,sin(uTilt),cos(uTilt))*D;
  vec3 b=normalize(ro);
  vec3 right=normalize(cross(vec3(0,1,0),b));
  vec3 up=cross(b,right);
  vec3 rd=normalize(-b*2.05+(right*uv.x+up*uv.y)*1.1);
  vec3 p=ro,v=rd;
  vec3 h=cross(p,v);
  float h2=dot(h,h);
  vec3 col=vec3(0.);
  float alpha=0.;
  for(int i=0;i<uSteps;i++){
    float r2=dot(p,p);
    float r=sqrt(r2);
    if(r<1.02){ alpha=1.; break; }
    if(r>D*1.25&&dot(p,v)>0.) break;
    float dt=clamp(r*.14,.04,1.6);
    vec3 acc=-1.5*h2*p/(r2*r2*r);
    vec3 nv=v+acc*dt;
    vec3 np=p+nv*dt;
    if(p.y*np.y<0.){
      float t=p.y/(p.y-np.y);
      vec4 s=disk(mix(p,np,t),normalize(nv));
      col+=(1.-alpha)*s.rgb;
      alpha+=(1.-alpha)*s.a;
      if(alpha>.995) break;
    }
    p=np; v=nv;
  }
  // Keep the deepest part of the shadow slightly warm so it reads as a sphere.
  float mask=smoothstep(1.,.86,length(vP));
  col*=uGain*mask;
  gl_FragColor=vec4(col,alpha*mask);
}`;

const HOLE_SHOW_FRAG = /* glsl */ `
uniform sampler2D tHole;
varying vec2 vP;
void main(){
  gl_FragColor=texture2D(tHole,vP*.5+.5);
}`;

export function BlackHole({
  position,
  size,
  tilt,
  roll,
  gain = 1,
  bands = 2.6,
  quality = 84,
  resolution = 1024,
}: {
  position: [number, number, number];
  size: number;
  tilt: number;
  roll: number;
  gain?: number;
  bands?: number;
  quality?: number;
  resolution?: number;
}) {
  const gl = useThree((s) => s.gl);
  const ref = useRef<THREE.Mesh>(null);
  const run = useRef({ status: "new", tick: 0 });
  const { target, bakeScene, bakeCamera, material } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(resolution, resolution, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    const bakeScene = new THREE.Scene();
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main(){ vP=position.xy; gl_Position=vec4(position.xy,0.,1.); }`,
        fragmentShader: HOLE_FRAG,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          ...noiseUniforms,
          uTime,
          uTilt: { value: tilt },
          uRoll: { value: roll },
          uGain: { value: gain },
          uBands: { value: bands },
          uSteps: { value: quality },
        },
      }),
    );
    quad.frustumCulled = false;
    bakeScene.add(quad);
    const material = new THREE.ShaderMaterial({
      vertexShader: HOLE_VERT,
      fragmentShader: HOLE_SHOW_FRAG,
      transparent: true,
      depthWrite: false,
      // Premultiplied: the disk adds light while the shadow blocks the stars.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { tHole: { value: target.texture } },
    });
    return { target, bakeScene, bakeCamera: new THREE.Camera(), material };
  }, [tilt, roll, gain, bands, quality, resolution]);

  const center = useMemo(() => new THREE.Vector3(...position), [position]);

  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.quaternion.copy(camera.quaternion);
    // Sits just ahead of the depth sphere, shrunk to keep the same apparent size.
    const distance = center.distanceTo(camera.position);
    const lift = size * 0.2;
    mesh.position.copy(center).lerp(camera.position, lift / distance);
    mesh.scale.setScalar((size * (distance - lift)) / distance);

    const state = run.current;
    if (state.status === "new") {
      state.status = "compiling";
      bakes.pending += 1;
      compileFor(gl, bakeScene, bakeCamera, target).then(() => {
        state.status = "first";
      });
      return;
    }
    if (state.status === "compiling") return;
    state.tick += 1;
    const first = state.status === "first";
    // The disk turns slowly, so every other frame is plenty.
    if (!first && (state.tick % 2 !== 0 || !isShown(mesh))) return;
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.render(bakeScene, bakeCamera);
    gl.setRenderTarget(previous);
    if (first) {
      state.status = "live";
      bakes.pending -= 1;
    }
  });

  return (
    <>
      <mesh position={position} scale={size * 0.178} renderOrder={-5}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshBasicMaterial colorWrite={false} />
      </mesh>
      <mesh ref={ref} position={position} scale={size} material={material} renderOrder={1}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </>
  );
}

/* ---------------------------------- Dust and rocks ---------------------------------- */

const DUST_VERT = /* glsl */ `
attribute vec4 aOrbit;
attribute float aSize;
attribute vec3 aTint;
uniform float uTime;
uniform float uScale;
uniform float uSpeed;
varying vec3 vTint;
varying float vFade;
void main(){
  float r=aOrbit.x;
  float a=aOrbit.y+uTime*uSpeed/pow(max(r,.2),1.5);
  vec3 p=vec3(cos(a)*r,aOrbit.z,sin(a)*r);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  float tw=.6+.4*sin(uTime*(1.+aOrbit.w*2.)+aOrbit.w*40.);
  vTint=aTint*tw;
  vFade=1.;
  gl_PointSize=clamp(aSize*uScale/max(-mv.z,.1),1.,5.5);
}`;

const DUST_FRAG = /* glsl */ `
varying vec3 vTint;
void main(){
  vec2 c=gl_PointCoord-.5;
  float d=dot(c,c)*4.;
  float s=exp(-d*5.)+exp(-d*28.);
  gl_FragColor=vec4(vTint*s,1.);
}`;

/** Gold particles orbiting a center, with optional spiral arms. */
export function DustDisk({
  position,
  quaternion,
  count = 6000,
  rMin,
  rMax,
  thickness,
  arms = 0,
  twist = 2.4,
  size = 3,
  speed = 2,
  intensity = 1,
  seed = 1,
  blue = 0,
}: {
  position: [number, number, number];
  quaternion?: THREE.Quaternion;
  count?: number;
  rMin: number;
  rMax: number;
  thickness: number;
  arms?: number;
  twist?: number;
  size?: number;
  speed?: number;
  intensity?: number;
  seed?: number;
  blue?: number;
}) {
  const { geometry, material } = useMemo(() => {
    const rand = seeded(seed);
    const orbit = new Float32Array(count * 4);
    const sizes = new Float32Array(count);
    const tints = new Float32Array(count * 3);
    const gold = new THREE.Color(1, 0.62, 0.24);
    const pale = new THREE.Color(1, 0.86, 0.62);
    const cool = new THREE.Color(0.42, 0.65, 1);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const k = Math.pow(rand(), 1.7);
      const r = rMin + (rMax - rMin) * k;
      let angle = rand() * Math.PI * 2;
      if (arms > 0) {
        const arm = Math.floor(rand() * arms);
        const scatter = (rand() - 0.5) * (0.7 + k * 1.1);
        angle = (arm / arms) * Math.PI * 2 + Math.log(r / rMin + 1) * twist + scatter;
      }
      orbit[i * 4] = r;
      orbit[i * 4 + 1] = angle;
      orbit[i * 4 + 2] = (rand() - 0.5) * thickness * (0.3 + k);
      orbit[i * 4 + 3] = rand();
      sizes[i] = size * (0.3 + Math.pow(rand(), 9) * 2.6);
      tint.copy(gold).lerp(pale, rand());
      if (rand() < blue) tint.copy(cool);
      const brightness = intensity * (0.25 + Math.pow(rand(), 3) * 1.6) * (1.15 - k * 0.8);
      tints[i * 3] = tint.r * brightness;
      tints[i * 3 + 1] = tint.g * brightness;
      tints[i * 3 + 2] = tint.b * brightness;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aOrbit", new THREE.BufferAttribute(orbit, 4));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));
    const material = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime, uScale: { value: 40 }, uSpeed: { value: speed } },
    });
    return { geometry, material };
  }, [count, rMin, rMax, thickness, arms, twist, size, speed, intensity, seed, blue]);

  return (
    <points
      geometry={geometry}
      material={material}
      position={position}
      quaternion={quaternion}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}

export function rockGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(1, 5);
  const position = geometry.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    const k = 0.64 + fbm(v.x * 1.5 + seed, v.y * 1.5, v.z * 1.5, 4) * 0.76;
    position.setXYZ(i, v.x * k, v.y * k * 0.86, v.z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Flat-shaded boulders circling on a tilted disk around a black hole. */
export function Asteroids({
  scene,
  world,
  position,
  quaternion,
  count,
  rMin,
  rMax,
  thickness,
  size,
  speed = 0.03,
  seed = 3,
}: {
  scene: SceneId;
  world: World;
  position: [number, number, number];
  quaternion?: THREE.Quaternion;
  count: number;
  rMin: number;
  rMax: number;
  thickness: number;
  size: number;
  speed?: number;
  seed?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geometry, material, rocks } = useMemo(() => {
    const rand = seeded(seed);
    const rocks = Array.from({ length: count }, () => {
      const k = Math.pow(rand(), 0.8);
      return {
        radius: rMin + (rMax - rMin) * k,
        angle: rand() * Math.PI * 2,
        height: (rand() - 0.5) * thickness,
        scale: size * (0.25 + Math.pow(rand(), 3.2) * 1.5),
        spin: new THREE.Euler(rand() * 6, rand() * 6, rand() * 6),
        axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        rate: 0.05 + rand() * 0.3,
      };
    });
    return {
      geometry: rockGeometry(seed),
      material: surface(world, {
        color: "#33281d",
        detail: 3,
        bump: 0.8,
        shine: 22,
        spec: 0.35,
        rim: 0.7,
        rimPower: 4,
      }),
      rocks,
    };
  }, [world, count, rMin, rMax, thickness, size, seed]);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      rotation: new THREE.Quaternion(),
      turn: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || getStage().scene !== scene) return;
    const t = uTime.value;
    rocks.forEach((rock, index) => {
      const angle = rock.angle + t * speed * Math.sqrt(rMin / rock.radius);
      scratch.position.set(Math.cos(angle) * rock.radius, rock.height, Math.sin(angle) * rock.radius);
      scratch.rotation.setFromEuler(rock.spin);
      scratch.turn.setFromAxisAngle(rock.axis, t * rock.rate);
      scratch.rotation.multiply(scratch.turn);
      scratch.scale.setScalar(rock.scale);
      scratch.matrix.compose(scratch.position, scratch.rotation, scratch.scale);
      mesh.setMatrixAt(index, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, count]}
      position={position}
      quaternion={quaternion}
      frustumCulled={false}
    />
  );
}

/* ---------------------------------- Sky ---------------------------------- */

export type SkyOptions = {
  zenith: string;
  horizon: string;
  sunDir: [number, number, number];
  sun: string;
  sunPower?: number;
  glow: string;
  glowPower?: number;
  clouds?: number;
  cloudTop?: number;
  cloudScale?: number;
  cloudShade?: string;
  cloudLit?: string;
  nebulaA?: string;
  nebulaB?: string;
  nebula?: number;
  nebulaDir?: [number, number, number];
  nebulaFocus?: number;
  stars?: number;
};

const SKY_BAKE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uZenith,uHorizon,uSunDir,uSun,uGlow,uCloudShade,uCloudLit,uNebA,uNebB,uNebDir;
uniform float uClouds,uCloudTop,uCloudScale,uNeb,uNebFocus;
varying vec3 vDir;
${NOISE_GLSL}
vec2 clouds(vec2 uv,float top01){
  vec2 w=vec2(fbm2(uv*.55+3.),fbm2(uv*.55+9.));
  float n=fbm2(uv+w*1.4);
  float wisps=1.-abs(fbm2(uv*2.1+w*2.)*2.-1.);
  float cover=n*.84+wisps*.2-mix(.1,.74,top01);
  return vec2(cover,n);
}
void main(){
  vec3 d=normalize(vDir);
  float y=d.y;
  vec3 col=mix(uHorizon,uZenith,smoothstep(-.02,.22,y));
  float focus=pow(max(dot(d,uNebDir),0.),uNebFocus);
  if(uNeb>0.){
    vec3 q=d*2.6;
    float warp=fbm3(q*1.3+3.);
    float n=fbm3(q+warp*1.4);
    col+=uNebA*pow(n,3.4)*(.08+focus*2.)*uNeb*.75;
  }
  float s=max(dot(d,uSunDir),0.);
  col+=uGlow*exp(-abs(y)*30.)*(.1+pow(s,8.)*1.1);
  col+=uGlow*exp(-abs(y)*22.)*pow(s,30.)*.22;
  float cover=0.;
  if(uClouds>0.&&y<uCloudTop&&y>-.05){
    float az=atan(d.x,-d.z);
    vec2 uv=vec2(az*uCloudScale+uTime*.006,y*uCloudScale*4.2);
    float top01=clamp(y/uCloudTop,0.,1.);
    vec2 c0=clouds(uv,top01);
    float c=smoothstep(0.,.05,c0.x);
    if(c>0.){
      vec2 sunUv=vec2(atan(uSunDir.x,-uSunDir.z)*uCloudScale,uSunDir.y*uCloudScale*4.2);
      vec2 toSun=normalize(sunUv-uv+1e-3);
      float lit=clamp((c0.x-clouds(uv+toSun*.075,top01).x)*7.,0.,1.);
      float near=(.025+pow(s,8.)*1.1)*pow(1.-top01,1.2);
      vec3 cc=uCloudShade*(.5+c0.y);
      cc+=uCloudLit*pow(lit,1.7)*near*1.9;
      cc+=uCloudLit*exp(-y*34.)*(.05+pow(s,5.)*.3);
      cc+=uCloudLit*pow(s,60.)*.22;
      cover=c*uClouds;
      col=mix(col,cc,cover);
    }
  }
  gl_FragColor=vec4(col,cover);
}`;

const SKY_LIVE_FRAG = /* glsl */ `
uniform float uTime;
uniform samplerCube tSky;
uniform vec3 uSunDir,uSun,uNebDir;
uniform float uNebFocus,uStars;
varying vec3 vDir;
${HASH_GLSL}
float stars(vec3 d,float scale,float rate){
  vec3 p=d*scale;
  vec3 i=floor(p);
  vec3 f=fract(p)-.5;
  float h=hash31(i);
  if(h<1.-rate) return 0.;
  vec3 o=vec3(hash31(i+1.),hash31(i+2.),hash31(i+3.))-.5;
  float s=smoothstep(.13,0.,length(f-o*.7));
  return s*s*(.55+.45*sin(uTime*(.6+h*3.)+h*90.));
}
void main(){
  vec3 d=normalize(vDir);
  vec4 baked=textureCube(tSky,d);
  float focus=pow(max(dot(d,uNebDir),0.),uNebFocus);
  float s=max(dot(d,uSunDir),0.);
  float upper=smoothstep(-.015,.03,d.y);
  // A sparse field of bright stars over a dense dusting, thickest around the nebula.
  float dusting=stars(d,620.,.2+focus*.35)*(.35+focus*2.2);
  vec3 sharp=uStars*upper*(
    stars(d,190.,.06)*vec3(1.,.93,.82)*1.7+
    stars(d,340.,.11)*vec3(.93,.94,1.)*1.1+
    stars(d,85.,.016)*vec3(1.,.84,.6)*4.5+
    dusting*vec3(1.,.8,.55)*.9);
  sharp+=uSun*(pow(s,2400.)*12.+pow(s,320.)*1.2+pow(s,60.)*.1)*upper;
  gl_FragColor=vec4(baked.rgb+sharp*(1.-baked.a),1.);
}`;

export function Sky({ options, radius = 1400 }: { options: SkyOptions; radius?: number }) {
  const gl = useThree((s) => s.gl);
  const ref = useRef<THREE.Mesh>(null);
  const run = useRef({ status: "new", face: 0, tick: 0 });
  const { material, target, bakeScene, faces } = useMemo(() => {
    const vec = (v: [number, number, number]) => new THREE.Vector3(...v).normalize();
    const color = (hex: string, power = 1) => new THREE.Color(hex).multiplyScalar(power);
    const target = new THREE.WebGLCubeRenderTarget(options.clouds ? 1024 : 512, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    const sunDir = { value: vec(options.sunDir) };
    const sun = { value: color(options.sun, options.sunPower ?? 1) };
    const nebDir = { value: vec(options.nebulaDir ?? options.sunDir) };
    const nebFocus = { value: options.nebulaFocus ?? 6 };
    const bakeScene = new THREE.Scene();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main(){
            vDir=position;
            gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);
          }`,
        fragmentShader: SKY_BAKE_FRAG,
        uniforms: {
          ...noiseUniforms,
          uTime,
          uZenith: { value: color(options.zenith) },
          uHorizon: { value: color(options.horizon) },
          uSunDir: sunDir,
          uSun: sun,
          uGlow: { value: color(options.glow, options.glowPower ?? 1) },
          uClouds: { value: options.clouds ?? 0 },
          uCloudTop: { value: options.cloudTop ?? 0.18 },
          uCloudScale: { value: options.cloudScale ?? 4 },
          uCloudShade: { value: color(options.cloudShade ?? "#0a0806") },
          uCloudLit: { value: color(options.cloudLit ?? "#ffb060") },
          uNebA: { value: color(options.nebulaA ?? "#5a3612") },
          uNebB: { value: color(options.nebulaB ?? "#ffb765") },
          uNeb: { value: options.nebula ?? 0.5 },
          uNebDir: nebDir,
          uNebFocus: nebFocus,
        },
      }),
    );
    sphere.frustumCulled = false;
    bakeScene.add(sphere);
    const cube = new THREE.CubeCamera(0.1, 100, target);
    cube.coordinateSystem = gl.coordinateSystem;
    cube.updateCoordinateSystem();
    cube.updateMatrixWorld(true);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir=(modelMatrix*vec4(position,0.)).xyz;
          gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);
        }`,
      fragmentShader: SKY_LIVE_FRAG,
      uniforms: {
        uTime,
        tSky: { value: target.texture },
        uSunDir: sunDir,
        uSun: sun,
        uNebDir: nebDir,
        uNebFocus: nebFocus,
        uStars: { value: options.stars ?? 1 },
      },
    });
    return { material, target, bakeScene, faces: cube.children as THREE.Camera[] };
  }, [options, gl]);

  const drawFace = (face: number) => {
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target, face);
    gl.render(bakeScene, faces[face]);
    gl.setRenderTarget(previous);
  };

  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.position.copy(camera.position);

    const state = run.current;
    if (state.status === "new") {
      state.status = "compiling";
      bakes.pending += 1;
      compileFor(gl, bakeScene, faces[0], target).then(() => {
        state.status = "first";
      });
      return;
    }
    if (state.status === "compiling") return;
    // First pass: one face per frame, so preparing a world doesn't cause a hitch.
    if (state.status === "first") {
      drawFace(state.face);
      state.face += 1;
      if (state.face === 6) {
        state.face = 0;
        state.status = "live";
        bakes.pending -= 1;
      }
      return;
    }
    // Only clouds change over time, and they drift very slowly.
    if (!options.clouds || !isShown(mesh)) return;
    state.tick += 1;
    if (state.tick % 20 === 0) {
      drawFace(state.face);
      state.face = (state.face + 1) % 6;
    }
  });

  return (
    <mesh ref={ref} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[radius, 48, 32]} />
    </mesh>
  );
}

/* ---------------------------------- Reflective floor ---------------------------------- */

const FLOOR_SHADER = {
  name: "WetFloor",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uBase: { value: new THREE.Color("#060504") },
    uTile: { value: 3 },
    uFade: { value: 90 },
    uStrength: { value: 1 },
    uGlowCol: { value: new THREE.Color("#c37a2b") },
    uGlowAt: { value: new THREE.Vector3() },
    uGlowRange: { value: 10 },
    uN2: { value: null },
    uN3: { value: null },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vRef;
    varying vec3 vW;
    void main(){
      vRef=textureMatrix*vec4(position,1.);
      vW=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uBase,uGlowCol,uGlowAt;
    uniform float uTile,uFade,uStrength,uGlowRange;
    varying vec4 vRef;
    varying vec3 vW;
    ${NOISE_GLSL}
    void main(){
      vec2 uv=vRef.xy/vRef.w;
      vec3 V=normalize(cameraPosition-vW);
      float n=vnoise(vW.xz*1.1);
      float pud=smoothstep(.34,.66,fbm2(vW.xz*.32+3.));
      vec2 jitter=(vec2(n,vnoise(vW.zx*1.1+9.))-.5)*mix(.009,.0012,pud);
      vec3 r=vec3(0.);
      float spread=mix(.009,.002,pud);
      for(int i=-3;i<=3;i++){
        r+=texture2D(tDiffuse,uv+jitter+vec2(0.,float(i)*spread)).rgb;
      }
      r/=7.;
      vec2 g=abs(fract(vW.xz/uTile)-.5);
      float seam=smoothstep(.482,.5,max(g.x,g.y));
      float fres=.22+.78*pow(1.-max(V.y,0.),3.);
      vec3 col=uBase*(.3+.3*n)+r*fres*mix(.45,.95,pud)*uStrength;
      col*=1.-seam*.62;
      float gd=length(vW.xz-uGlowAt.xz);
      col+=uGlowCol*exp(-gd*gd/(uGlowRange*uGlowRange))*(.5+.5*n)*.06;
      float fade=smoothstep(uFade,uFade*.35,length(vW.xz-cameraPosition.xz));
      gl_FragColor=vec4(col*fade,1.);
    }`,
};

export function WetFloor({
  size = 240,
  y = 0,
  tile = 3,
  strength = 1,
  glowAt = [0, 0, 0],
  glowRange = 10,
  resolution = 900,
  fade = 90,
  hide,
}: {
  size?: number;
  y?: number;
  tile?: number;
  strength?: number;
  glowAt?: [number, number, number];
  glowRange?: number;
  resolution?: number;
  fade?: number;
  hide?: React.RefObject<THREE.Object3D | null>;
}) {
  const reflector = useMemo(() => {
    const mirror = new Reflector(new THREE.PlaneGeometry(size, size), {
      textureWidth: resolution,
      textureHeight: Math.round(resolution * 0.56),
      clipBias: 0.002,
      shader: FLOOR_SHADER,
      multisample: 0,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = y;
    const uniforms = (mirror.material as THREE.ShaderMaterial).uniforms;
    uniforms.uN2.value = noiseUniforms.uN2.value;
    uniforms.uN3.value = noiseUniforms.uN3.value;
    uniforms.uTile.value = tile;
    uniforms.uStrength.value = strength;
    uniforms.uGlowAt.value = new THREE.Vector3(...glowAt);
    uniforms.uGlowRange.value = glowRange;
    uniforms.uFade.value = fade;
    return mirror;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const render = reflector.onBeforeRender;
    // The disk is expensive and barely visible in the floor, so it stays out of the mirror.
    let frame = 0;
    reflector.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
      frame += 1;
      if (frame % 2 === 0) return;
      const target = hide?.current;
      if (target) target.visible = false;
      render.call(reflector, renderer, scene, camera, geometry, material, group);
      if (target) target.visible = true;
    };
    return () => {
      reflector.onBeforeRender = render;
    };
  }, [reflector, hide]);

  return <primitive object={reflector} />;
}

/* ---------------------------------- Landscape props ---------------------------------- */

/** A ring of jagged peaks around the origin. Rim light picks out the ridgelines. */
export function Mountains({
  world,
  radius,
  height,
  base = -2,
  seed = 1,
  color = "#0d0a07",
  from = 0,
  to = Math.PI * 2,
}: {
  world: World;
  radius: number;
  height: number;
  base?: number;
  seed?: number;
  color?: string;
  from?: number;
  to?: number;
}) {
  const { geometry, material } = useMemo(() => {
    const columns = 520;
    const rows = 40;
    const scale = height * 3.2;
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const distance = radius * (0.84 + v * 0.34);
      // Rises from the valley, peaks along the range, then falls away behind it.
      const profile = smoothstep(0, 0.45, v) * smoothstep(1, 0.7, v);
      for (let c = 0; c <= columns; c++) {
        const a = from + (c / columns) * (to - from);
        const x = Math.cos(a) * distance;
        const z = Math.sin(a) * distance;
        const range = fbm(x / (scale * 2.4) + seed, seed * 2, z / (scale * 2.4), 2);
        const ridge = ridged(x / scale + seed * 7, seed, z / scale, 5);
        const peak = Math.pow(ridge, 1.5) * (0.45 + range * 1.5);
        vertices.push(x, base - 8 * (1 - profile) + height * 2.2 * peak * profile, z);
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
    const material = surface(world, { color, flat: true, spec: 0.05, rim: 0.28, rimPower: 5 });
    return { geometry, material };
  }, [world, radius, height, base, seed, color, from, to]);

  return <mesh geometry={geometry} material={material} />;
}

const PLANET_FRAG = /* glsl */ `
uniform vec3 uLight,uTint;
varying vec3 vN,vW,vO;
${NOISE_GLSL}
void main(){
  vec3 N=normalize(vN);
  vec3 V=normalize(cameraPosition-vW);
  vec3 p=normalize(vO);
  float c1=vnoise3(p*7.),c2=vnoise3(p*17.+3.);
  float rings=smoothstep(.66,.7,c1)*smoothstep(.76,.7,c1)+.5*smoothstep(.68,.72,c2)*smoothstep(.77,.72,c2);
  float pits=smoothstep(.7,.82,c1)*.5+smoothstep(.72,.84,c2)*.25;
  float tex=fbm3(p*4.5);
  vec3 alb=uTint*(.45+tex*.9-pits*.55+rings*.42);
  float d=dot(N,uLight);
  float lit=smoothstep(-.06,.5,d);
  vec3 col=alb*lit*1.05;
  float fr=pow(1.-max(dot(N,V),0.),4.);
  col+=vec3(1.,.66,.32)*fr*smoothstep(-.3,.5,d)*.9;
  gl_FragColor=vec4(col,1.);
}`;

export function Planet({
  position,
  radius,
  light,
  tint = "#c9b499",
}: {
  position: [number, number, number];
  radius: number;
  light: [number, number, number];
  tint?: string;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vN,vW,vO;
          void main(){
            vO=position;
            vN=mat3(modelMatrix)*normal;
            vec4 w=modelMatrix*vec4(position,1.);
            vW=w.xyz;
            gl_Position=projectionMatrix*viewMatrix*w;
          }`,
        fragmentShader: PLANET_FRAG,
        uniforms: {
          ...noiseUniforms,
          uLight: { value: new THREE.Vector3(...light).normalize() },
          uTint: { value: new THREE.Color(tint) },
        },
      }),
    [light, tint],
  );
  return (
    <mesh position={position} scale={radius} material={material}>
      <sphereGeometry args={[1, 96, 64]} />
    </mesh>
  );
}

/* ---------------------------------- People ---------------------------------- */

export type FigureKind = "explorer" | "coat" | "casual" | "jacket" | "standing" | "seated";

const figureRequests = new Map<FigureKind, Promise<THREE.BufferGeometry>>();
const NO_GEOMETRY = new THREE.BufferGeometry();

/** Posed people, 1.85 m tall, feet at y=0, facing away from the viewer. See public/models. */
function loadFigure(kind: FigureKind) {
  let request = figureRequests.get(kind);
  if (!request) {
    request = new GLTFLoader().loadAsync(`/models/${kind}.glb`).then((gltf) => {
      let geometry: THREE.BufferGeometry | null = null;
      gltf.scene.traverse((node) => {
        if (!geometry && (node as THREE.Mesh).isMesh) geometry = (node as THREE.Mesh).geometry;
      });
      if (!geometry) throw new Error(`No mesh in ${kind}.glb`);
      return geometry;
    });
    figureRequests.set(kind, request);
  }
  return request;
}

/** Backpack worn by standing figures, sitting against the shoulder blades. */
function backpack() {
  const pack = new RoundedBoxGeometry(0.32, 0.44, 0.16, 4, 0.06);
  pack.translate(0, 1.22, 0.19);
  return pack;
}

export function Figure({
  world,
  kind,
  position,
  rotationY = 0,
  rim = 1,
  pack = false,
}: {
  world: World;
  kind: FigureKind;
  position: [number, number, number];
  rotationY?: number;
  rim?: number;
  pack?: boolean;
}) {
  const [body, setBody] = useState<THREE.BufferGeometry>(NO_GEOMETRY);

  // Counted with the offscreen images, so the world isn't shown until its people have arrived.
  useEffect(() => {
    let current = true;
    bakes.pending += 1;
    loadFigure(kind)
      .then((geometry) => {
        if (current) setBody(geometry);
      })
      .catch((error) => console.error("Could not load figure", kind, error))
      .finally(() => {
        bakes.pending -= 1;
      });
    return () => {
      current = false;
    };
  }, [kind]);

  const { gear, material, edge } = useMemo(() => {
    // Hair and clothes are thin one-sided layers, so both sides are drawn to keep the body solid.
    const material = surface(world, {
      color: "#17120d",
      detail: 22,
      bump: 0.3,
      shine: 14,
      spec: 0.03,
      rim: 0.12,
      rimPower: 6,
    });
    material.side = THREE.DoubleSide;
    return {
      gear: pack ? backpack() : null,
      material,
      // A shell pushed out along the normals, showing only its inside: a thin line of light.
      // Its width follows distance so the line stays even, and it's held behind the body.
      edge: new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: /* glsl */ `
          void main(){
            float distance=-(modelViewMatrix*vec4(position,1.)).z;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*distance*.0014,1.);
            gl_Position.z+=.004*gl_Position.w;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          void main(){ gl_FragColor=vec4(uColor,1.); }`,
        uniforms: { uColor: { value: new THREE.Color("#ffb564").multiplyScalar(0.62 * rim) } },
      }),
    };
  }, [world, rim, pack]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={body} material={material} frustumCulled={false} />
      {gear && <mesh geometry={gear} material={material} />}
      <mesh geometry={body} material={edge} frustumCulled={false} />
    </group>
  );
}

/* ---------------------------------- Hologram panels ---------------------------------- */

const PANEL_FRAG = /* glsl */ `
uniform sampler2D tMap;
uniform float uHover,uDim,uTime,uFlicker,uFade;
varying vec2 vUv;
void main(){
  vec4 t=texture2D(tMap,vUv);
  float scan=.93+.07*sin(vUv.y*420.+uTime*2.);
  float flick=1.-uFlicker*.05*(.5+.5*sin(uTime*11.+vUv.y*5.));
  vec3 col=t.rgb*scan*flick*(1.25+uHover*.75);
  vec2 e=min(vUv,1.-vUv);
  float edge=smoothstep(.024,.0,min(e.x,e.y*1.45));
  col+=vec3(1.,.66,.28)*edge*(.28+uHover*1.6);
  float a=max(t.a,.0)*mix(1.,.2,uDim)*uFade;
  gl_FragColor=vec4(col*mix(1.,.22,uDim)*a,a);
}`;

export function HoloPanel({
  texture,
  position,
  rotation,
  width,
  height,
  hover = 0,
  dim = 0,
  onSelect,
  onHover,
  bob = 0.06,
  phase = 0,
  fade,
}: {
  texture: THREE.Texture;
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
  hover?: number;
  dim?: number;
  onSelect?: () => void;
  onHover?: (over: boolean) => void;
  bob?: number;
  phase?: number;
  fade?: React.RefObject<number>;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [over, setOver] = useState(false);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: PANEL_FRAG,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        uniforms: {
          tMap: { value: texture },
          uHover: { value: 0 },
          uDim: { value: 0 },
          uTime,
          uFlicker: { value: 1 },
          uFade: { value: 1 },
        },
      }),
    [texture],
  );

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const k = 1 - Math.exp(-delta * 7);
    const uniforms = material.uniforms;
    uniforms.uHover.value += ((over ? 1 : hover) - uniforms.uHover.value) * k;
    uniforms.uDim.value += (dim - uniforms.uDim.value) * k;
    if (fade) uniforms.uFade.value = fade.current;
    mesh.position.y = position[1] + Math.sin(uTime.value * 0.6 + phase) * bob;
    const grow = 1 + uniforms.uHover.value * 0.035;
    mesh.scale.set(width * grow, height * grow, 1);
  });

  const handlers = onSelect
    ? {
        onClick: (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onSelect();
        },
        onPointerOver: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setOver(true);
          onHover?.(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          setOver(false);
          onHover?.(false);
          document.body.style.cursor = "";
        },
      }
    : {};

  return (
    <mesh
      ref={ref}
      position={position}
      rotation={rotation}
      material={material}
      renderOrder={4}
      raycast={onSelect ? raycastVisible : () => null}
      {...handlers}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

/* ---------------------------------- Small kit ---------------------------------- */

/** Soft additive cone of light, used for beams and floor-to-ceiling shafts. */
export function LightShaft({
  position,
  radiusTop,
  radiusBottom,
  height,
  color = "#ffb765",
  power = 0.5,
}: {
  position: [number, number, number];
  radiusTop: number;
  radiusBottom: number;
  height: number;
  color?: string;
  power?: number;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vN,vV;
          void main(){
            vUv=uv;
            vec4 mv=modelViewMatrix*vec4(position,1.);
            vN=normalize(normalMatrix*normal);
            vV=normalize(-mv.xyz);
            gl_Position=projectionMatrix*mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uTime;
          varying vec2 vUv; varying vec3 vN,vV;
          ${NOISE_GLSL}
          void main(){
            float f=pow(abs(dot(normalize(vN),normalize(vV))),2.2);
            float s=.5+.5*vnoise(vec2(vUv.x*60.,vUv.y*2.-uTime*.2));
            float a=f*s*smoothstep(0.,.12,vUv.y)*smoothstep(1.,.5,vUv.y);
            gl_FragColor=vec4(uColor*a,1.);
          }`,
        uniforms: { ...noiseUniforms, uColor: { value: new THREE.Color(color).multiplyScalar(power) }, uTime },
      }),
    [color, power],
  );
  return (
    <mesh position={position} material={material} renderOrder={3}>
      <cylinderGeometry args={[radiusTop, radiusBottom, height, 48, 1, true]} />
    </mesh>
  );
}

/** Thin gold ring. Stands in for a line, with a width that survives bloom. */
export function GlowRing({
  radius,
  position = [0, 0, 0],
  rotation = [Math.PI / 2, 0, 0],
  tube = 0.02,
  color = "#ffb765",
  power = 3,
  quaternion,
  arc = Math.PI * 2,
}: {
  radius: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  tube?: number;
  color?: string;
  power?: number;
  quaternion?: THREE.Quaternion;
  arc?: number;
}) {
  const material = useMemo(() => glow(color, power), [color, power]);
  return (
    <mesh
      position={position}
      {...(quaternion ? { quaternion } : { rotation })}
      material={material}
    >
      <torusGeometry args={[radius, tube, 6, 180, arc]} />
    </mesh>
  );
}

