"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { getStage, type SceneId } from "@/lib/stage";
import {
  fbm,
  glow,
  NOISE_GLSL,
  noiseUniforms,
  ridged,
  seeded,
  smoothstep,
  surface,
  uTime,
  type World,
} from "./shared";

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
  float spin=uTime*1.9/pow(r,1.5);
  float phi=a+spin;
  vec3 q=vec3(cos(phi)*1.4,sin(phi)*1.4,r*.9);
  float big=fbm3(q);
  float arcs=vnoise3(vec3(cos(phi)*.8,sin(phi)*.8,r*7.))*.65+vnoise3(vec3(cos(phi)*1.6,sin(phi)*1.6,r*19.))*.35;
  float bands=pow(arcs,uBands);
  float edge=smoothstep(RIN,RIN+.32,r)*pow(smoothstep(ROUT,RIN+1.,r),2.1);
  float hot=exp(-(r-RIN)*.42);
  float dens=edge*(.14+bands*2.6)*(.5+big);
  // The side of the disk rotating toward the viewer burns brighter.
  vec3 tangent=normalize(vec3(-hit.z,0.,hit.x));
  float dop=1.+.62*dot(tangent,-ray);
  float heat=clamp(dens*(.45+hot*1.2),0.,1.);
  vec3 c=mix(vec3(.62,.2,.035),vec3(1.,.62,.2),smoothstep(.05,.55,heat));
  c=mix(c,vec3(1.,.8,.5),smoothstep(.6,1.,heat));
  c*=dens*(.26+hot*.95)*dop*dop;
  return vec4(c,clamp(dens*.9,0.,1.));
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

export function BlackHole({
  position,
  size,
  tilt,
  roll,
  gain = 1,
  bands = 2.6,
  quality = 84,
}: {
  position: [number, number, number];
  size: number;
  tilt: number;
  roll: number;
  gain?: number;
  bands?: number;
  quality?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HOLE_VERT,
        fragmentShader: HOLE_FRAG,
        transparent: true,
        depthWrite: false,
        // Premultiplied: the disk adds light while the shadow blocks the stars.
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
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
    [tilt, roll, gain, bands, quality],
  );

  useFrame(({ camera }) => {
    ref.current?.quaternion.copy(camera.quaternion);
  });

  return (
    <mesh ref={ref} position={position} scale={size} material={material} renderOrder={1}>
      <planeGeometry args={[2, 2]} />
    </mesh>
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
  gl_PointSize=clamp(aSize*uScale/max(-mv.z,.1),1.,26.);
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
        const scatter = (rand() - 0.5) * (0.35 + k * 0.75);
        angle = (arm / arms) * Math.PI * 2 + Math.log(r / rMin + 1) * twist + scatter;
      }
      orbit[i * 4] = r;
      orbit[i * 4 + 1] = angle;
      orbit[i * 4 + 2] = (rand() - 0.5) * thickness * (0.3 + k);
      orbit[i * 4 + 3] = rand();
      sizes[i] = size * (0.35 + Math.pow(rand(), 6) * 3.4);
      tint.copy(gold).lerp(pale, rand());
      if (rand() < blue) tint.copy(cool);
      const brightness = intensity * (0.5 + rand() * 1.5) * (1.15 - k * 0.75);
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

function rockGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    const k = 0.62 + fbm(v.x * 1.7 + seed, v.y * 1.7, v.z * 1.7, 3) * 0.85;
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
        color: "#3a2f22",
        shine: 26,
        spec: 0.5,
        rim: 0.9,
        flat: true,
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

const SKY_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uZenith,uHorizon,uSunDir,uSun,uGlow,uCloudShade,uCloudLit,uNebA,uNebB,uNebDir;
uniform float uClouds,uCloudTop,uCloudScale,uNeb,uNebFocus,uStars;
varying vec3 vDir;
${NOISE_GLSL}
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
float cloudD(vec2 uv){
  float n=fbm2(uv);
  float b=1.-abs(fbm2(uv*1.9+4.)*2.-1.);
  return n*.72+b*.4;
}
void main(){
  vec3 d=normalize(vDir);
  float y=d.y;
  vec3 col=mix(uHorizon,uZenith,smoothstep(-.02,.42,y));
  float focus=pow(max(dot(d,uNebDir),0.),uNebFocus);
  if(uNeb>0.){
    vec3 q=d*2.6;
    float warp=fbm3(q*1.3+3.);
    float n=fbm3(q+warp*1.4);
    float fil=pow(1.-abs(fbm3(q*2.1+warp*2.2+11.)*2.-1.),24.);
    col+=uNebA*pow(n,3.4)*(.12+focus*2.)*uNeb*.75;
    col+=uNebB*fil*focus*uNeb*.16;
  }
  float s=max(dot(d,uSunDir),0.);
  float upper=smoothstep(-.015,.03,y);
  col+=uStars*upper*(
    stars(d,190.,.075)*vec3(1.,.92,.8)*2.1+
    stars(d,340.,.1)*vec3(.92,.94,1.)*1.2+
    stars(d,85.,.02)*vec3(1.,.82,.58)*5.);
  col+=uGlow*exp(-abs(y)*13.)*(.05+pow(s,6.)*.9);
  col+=uSun*(pow(s,1600.)*9.+pow(s,220.)*1.1+pow(s,50.)*.14)*upper;
  if(uClouds>0.&&y<uCloudTop&&y>-.05){
    float az=atan(d.x,-d.z);
    vec2 uv=vec2(az*uCloudScale+uTime*.006,y*uCloudScale*3.2);
    float top=smoothstep(uCloudTop,uCloudTop*.05,y);
    float cover=cloudD(uv)-.62+top*.42;
    float c=smoothstep(0.,.2,cover);
    if(c>0.){
      vec2 sunUv=vec2(atan(uSunDir.x,-uSunDir.z)*uCloudScale,uSunDir.y*uCloudScale*3.2);
      vec2 toSun=normalize(sunUv-uv+1e-3);
      float lit=clamp((cover-(cloudD(uv+toSun*.22)-.62+top*.42))*2.8,0.,1.);
      float near=.05+pow(s,4.)*1.15;
      vec3 cc=mix(uCloudShade,uCloudLit,lit*near);
      cc+=uCloudLit*pow(s,20.)*.5;
      col=mix(col,cc,c*uClouds);
    }
  }
  gl_FragColor=vec4(col,1.);
}`;

export function Sky({ options, radius = 1400 }: { options: SkyOptions; radius?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    const vec = (v: [number, number, number]) => new THREE.Vector3(...v).normalize();
    const color = (hex: string, power = 1) => new THREE.Color(hex).multiplyScalar(power);
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir=(modelMatrix*vec4(position,0.)).xyz;
          gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);
        }`,
      fragmentShader: SKY_FRAG,
      uniforms: {
        ...noiseUniforms,
        uTime,
        uZenith: { value: color(options.zenith) },
        uHorizon: { value: color(options.horizon) },
        uSunDir: { value: vec(options.sunDir) },
        uSun: { value: color(options.sun, options.sunPower ?? 1) },
        uGlow: { value: color(options.glow, options.glowPower ?? 1) },
        uClouds: { value: options.clouds ?? 0 },
        uCloudTop: { value: options.cloudTop ?? 0.18 },
        uCloudScale: { value: options.cloudScale ?? 4 },
        uCloudShade: { value: color(options.cloudShade ?? "#0a0806") },
        uCloudLit: { value: color(options.cloudLit ?? "#ffb060") },
        uNebA: { value: color(options.nebulaA ?? "#5a3612") },
        uNebB: { value: color(options.nebulaB ?? "#ffb765") },
        uNeb: { value: options.nebula ?? 0.5 },
        uNebDir: { value: vec(options.nebulaDir ?? options.sunDir) },
        uNebFocus: { value: options.nebulaFocus ?? 6 },
        uStars: { value: options.stars ?? 1 },
      },
    });
  }, [options]);

  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
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
    reflector.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
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
    const columns = 760;
    const rows = 56;
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

type Outline = [number, number][];

function mirrored(right: Outline): Outline {
  const left = [...right].reverse().map(([x, y]): [number, number] => [-x, y]);
  return [...right, ...left];
}

const LEGS: Outline = [
  [0.015, 0.86], [0.035, 0.5], [0.04, 0.1], [0.035, 0.0], [0.16, 0.0], [0.15, 0.05],
  [0.125, 0.1], [0.14, 0.48], [0.17, 0.82],
];
const ARM: Outline = [
  [0.205, 1.1], [0.225, 0.86], [0.235, 0.78], [0.275, 0.8], [0.275, 1.0], [0.285, 1.25],
  [0.27, 1.42], [0.19, 1.5], [0.1, 1.53], [0.075, 1.58],
];

const OUTLINES: Record<string, Outline> = {
  // Hooded explorer seen from behind, feet at y=0, 1.84 tall.
  hood: mirrored([
    ...LEGS, [0.18, 0.92], [0.165, 1.08], [0.175, 1.28], ...ARM,
    [0.105, 1.66], [0.105, 1.75], [0.06, 1.82], [0.0, 1.84],
  ]),
  // Long coat, flaring out at the knees over the legs.
  coat: mirrored([
    [0.02, 0.5], [0.04, 0.1], [0.035, 0.0], [0.15, 0.0], [0.13, 0.08], [0.13, 0.42],
    [0.26, 0.46], [0.22, 0.9], [0.17, 1.1], [0.175, 1.28], ...ARM,
    [0.1, 1.66], [0.1, 1.75], [0.055, 1.82], [0.0, 1.84],
  ]),
  // Bare head with tousled hair, jacket.
  casual: mirrored([
    ...LEGS, [0.18, 0.92], [0.17, 1.06], [0.175, 1.28], ...ARM,
    [0.085, 1.62], [0.11, 1.68], [0.115, 1.76], [0.08, 1.83], [0.03, 1.865], [0.0, 1.87],
  ]),
};

// Seated in profile with one arm reaching out to the right.
const SEATED: Outline = [
  [-0.38, 0.0], [0.52, 0.0], [0.62, 0.05], [0.58, 0.12], [0.34, 0.14], [0.36, 0.46],
  [0.3, 0.56], [0.0, 0.52], [0.02, 0.62], [0.12, 0.84], [0.34, 0.92], [0.62, 0.98], [0.68, 1.03],
  [0.62, 1.05], [0.32, 1.02], [0.12, 1.02], [0.08, 1.08], [0.13, 1.17], [0.1, 1.28],
  [0.0, 1.32], [-0.13, 1.27], [-0.15, 1.13], [-0.09, 1.05], [-0.27, 0.98], [-0.36, 0.72], [-0.38, 0.44],
];

function figureGeometry(outline: Outline) {
  const curve = new THREE.CatmullRomCurve3(
    outline.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    "centripetal",
  );
  const shape = new THREE.Shape(
    curve.getPoints(outline.length * 5).map((p) => new THREE.Vector2(p.x, p.y)),
  );
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -0.05);
  return geometry;
}

export function Figure({
  kind = "hood",
  position,
  rotationY = 0,
  scale = 1,
  rim = 1,
  pack = true,
}: {
  kind?: "hood" | "coat" | "casual" | "seated";
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  rim?: number;
  pack?: boolean;
}) {
  const { body, packGeometry, black, edge } = useMemo(() => {
    const packGeometry = new THREE.SphereGeometry(1, 18, 14);
    packGeometry.scale(0.2, 0.28, 0.1);
    packGeometry.translate(0, 1.2, 0.15);
    return {
      body: figureGeometry(kind === "seated" ? SEATED : OUTLINES[kind]),
      packGeometry,
      black: new THREE.MeshBasicMaterial({ color: "#020201" }),
      edge: new THREE.MeshBasicMaterial({
        color: new THREE.Color("#ffb35e").multiplyScalar(0.55 * rim),
        side: THREE.BackSide,
      }),
    };
  }, [kind, rim]);
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh geometry={body} material={black} />
      <mesh geometry={body} material={edge} scale={[1.016, 1.005, 1]} position={[0, 0.002, -0.015]} />
      {pack && kind !== "seated" && <mesh geometry={packGeometry} material={black} />}
    </group>
  );
}

/* ---------------------------------- Hologram panels ---------------------------------- */

const PANEL_FRAG = /* glsl */ `
uniform sampler2D tMap;
uniform float uHover,uDim,uTime,uFlicker;
varying vec2 vUv;
void main(){
  vec4 t=texture2D(tMap,vUv);
  float scan=.93+.07*sin(vUv.y*420.+uTime*2.);
  float flick=1.-uFlicker*.05*(.5+.5*sin(uTime*11.+vUv.y*5.));
  vec3 col=t.rgb*scan*flick*(1.25+uHover*.75);
  vec2 e=min(vUv,1.-vUv);
  float edge=smoothstep(.024,.0,min(e.x,e.y*1.45));
  col+=vec3(1.,.66,.28)*edge*(.28+uHover*1.6);
  float a=max(t.a,.0)*mix(1.,.2,uDim);
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
    <mesh ref={ref} position={position} rotation={rotation} material={material} renderOrder={4} {...handlers}>
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

