"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {
  getStage,
  prepareScene,
  type SceneId,
  setStage,
  useStage,
  warpAmount,
  warpIsLeaving,
} from "@/lib/stage";
import { AboutScene, ABOUT_POSE } from "./scenes/AboutScene";
import { ContactScene, CONTACT_POSE } from "./scenes/ContactScene";
import { HallScene, HALL_POSE } from "./scenes/HallScene";
import { IntroScene, INTRO_POSE } from "./scenes/IntroScene";
import { ProjectsScene, PROJECTS_POSE } from "./scenes/ProjectsScene";
import { NOISE_GLSL, noiseUniforms, type Pose, uTime } from "./shared";

const POSES: Record<SceneId, Pose> = {
  intro: INTRO_POSE,
  hall: HALL_POSE,
  projects: PROJECTS_POSE,
  about: ABOUT_POSE,
  contact: CONTACT_POSE,
};

const pointer = { x: 0, y: 0 };
const damped = { x: 0, y: 0 };
const warpCenter = new THREE.Vector2(0.5, 0.5);
const stillCamera = window.matchMedia("(prefers-reduced-motion: reduce)");

function Director() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const hole = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, delta) => {
    uTime.value += Math.min(delta, 0.05);
    const pose = POSES[getStage().scene];
    const now = performance.now();
    const warp = warpAmount(now);
    const leaving = warpIsLeaving(now);
    const aspect = size.width / size.height;
    const t = uTime.value;

    const ease = 1 - Math.exp(-delta * 2.4);
    damped.x += (pointer.x - damped.x) * ease;
    damped.y += (pointer.y - damped.y) * ease;

    const target = aspect < 0.9 && pose.portraitTarget ? pose.portraitTarget : pose.target;
    hole.set(...pose.hole);
    eye.set(...pose.position);
    if (!stillCamera.matches) {
      eye.x += damped.x * pose.parallax[0] + Math.sin(t * 0.13) * pose.parallax[0] * 0.25;
      eye.y += -damped.y * pose.parallax[1] + Math.sin(t * 0.17) * pose.parallax[1] * 0.2;
    }
    if (leaving) eye.lerp(hole, warp * 0.18);
    lookAt.set(...target);
    if (leaving) lookAt.lerp(hole, warp * 0.9);

    camera.position.copy(eye);
    camera.lookAt(lookAt);

    // Wider screens keep the vertical framing, narrow ones keep the horizontal.
    const narrow = Math.min(1.75, Math.max(1, 16 / 9 / aspect));
    const halfFov = Math.tan(THREE.MathUtils.degToRad(pose.fov / 2)) * narrow;
    const warpZoom = leaving ? 1 - warp * 0.55 : 1 + warp * 0.6;
    camera.fov = THREE.MathUtils.radToDeg(Math.atan(halfFov)) * 2 * warpZoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const projected = hole.clone().project(camera);
    warpCenter.set(
      THREE.MathUtils.clamp(projected.x * 0.5 + 0.5, 0.1, 0.9),
      THREE.MathUtils.clamp(projected.y * 0.5 + 0.5, 0.1, 0.9),
    );
    state.scene.background = null;
  }, -1);

  return null;
}

const GRADE = {
  uniforms: {
    ...noiseUniforms,
    tDiffuse: { value: null },
    uWarp: { value: 0 },
    uCenter: { value: warpCenter },
    uAspect: { value: 1.78 },
    uTime,
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uWarp;
    uniform vec2 uCenter;
    uniform float uAspect;
    uniform float uTime;
    varying vec2 vUv;
    ${NOISE_GLSL}
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
    void main(){
      vec2 d=vUv-uCenter;
      vec3 col;
      if(uWarp>.002){
        // Space collapses toward the hole: a long radial smear that grows with the warp.
        col=vec3(0.);
        float pull=uWarp*uWarp*.92;
        for(int i=0;i<16;i++){
          float t=float(i)/15.;
          col+=texture2D(tDiffuse,uCenter+d*(1.-pull*t)).rgb;
        }
        col/=16.;
        vec2 ad=d*vec2(uAspect,1.);
        float r=length(ad);
        float a=atan(ad.y,ad.x);
        float streak=pow(vnoise(vec2(a*34.,uTime*.7)),7.)+.5*pow(vnoise(vec2(a*90.,-uTime)),9.);
        col+=vec3(1.,.66,.3)*streak*smoothstep(.0,.55,r)*uWarp*uWarp*9.;
        col+=vec3(1.,.72,.42)*pow(uWarp,5.)*3.2;
      }else{
        col=texture2D(tDiffuse,vUv).rgb;
      }
      // Warm split-tone with deep blacks, like the reference renders.
      col=aces(col*1.08);
      float luma=dot(col,vec3(.2126,.7152,.0722));
      col=mix(col,col*vec3(1.05,.985,.9),smoothstep(.05,.7,luma));
      col=pow(col,vec3(1.06));
      vec2 v=vUv-.5;
      col*=1.-dot(v,v)*.72;
      col=pow(clamp(col,0.,1.),vec3(1./2.2));
      col+=(hash21(vUv*vec2(913.,711.)+fract(uTime)*37.)-.5)*.018;
      gl_FragColor=vec4(col,1.);
    }`,
};

/** Keeps stray HDR spikes and NaNs from flooding the bloom pass. */
const CLAMP = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: GRADE.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main(){
      vec3 c=texture2D(tDiffuse,vUv).rgb;
      if(!(c.r==c.r&&c.g==c.g&&c.b==c.b)) c=vec3(0.);
      gl_FragColor=vec4(min(max(c,vec3(0.)),vec3(4.)),1.);
    }`,
};

function PostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const setDpr = useThree((s) => s.setDpr);
  const frames = useRef({ count: 0, spent: 0, first: true });

  const { composer, grade } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      samples: 2,
    });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ShaderPass(CLAMP));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(4, 4), 0.07, 0.55, 1));
    // Passing a material keeps the shared uniforms; a plain object would be cloned.
    const grade = new ShaderPass(new THREE.ShaderMaterial(GRADE));
    composer.addPass(grade);
    return { composer, grade };
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
    grade.uniforms.uAspect.value = size.width / size.height;
  }, [composer, grade, size, dpr]);

  useFrame((_, delta) => {
    grade.uniforms.uWarp.value = warpAmount();
    composer.render(delta);

    const stats = frames.current;
    if (stats.first) {
      stats.first = false;
      setStage({ ready: true });
    }
    // Trade resolution for smoothness on slower GPUs.
    // One-off hitches (a world being built) and throttled background tabs say nothing about the GPU.
    if (delta > 0.2 || document.hidden || !document.hasFocus()) return;
    stats.count += 1;
    stats.spent += delta;
    if (stats.count >= 50) {
      const average = stats.spent / stats.count;
      stats.count = 0;
      stats.spent = 0;
      if (average > 0.03 && dpr > 0.8) setDpr(Math.max(0.8, dpr - 0.25));
    }
  }, 1);

  return null;
}

function Worlds() {
  const scene = useStage((s) => s.scene);
  const prepared = useStage((s) => s.mounted);
  const ready = useStage((s) => s.ready);
  const has = (id: SceneId) => id === scene || prepared.includes(id);

  // From the intro there is only one way forward, so have it waiting.
  useEffect(() => {
    if (!ready || scene !== "intro") return;
    const id = window.setTimeout(() => prepareScene("hall"), 2500);
    return () => window.clearTimeout(id);
  }, [ready, scene]);

  return (
    <>
      {has("intro") && <IntroScene visible={scene === "intro"} />}
      {has("hall") && <HallScene visible={scene === "hall"} />}
      {has("projects") && <ProjectsScene visible={scene === "projects"} />}
      {has("about") && <AboutScene visible={scene === "about"} />}
      {has("contact") && <ContactScene visible={scene === "contact"} />}
    </>
  );
}

export default function Experience() {
  return (
    <div aria-hidden className="fixed inset-0 z-0">
      <Canvas
        flat
        dpr={[1, 1.6]}
        camera={{ fov: 38, near: 0.1, far: 3000, position: [0, 2, 20] }}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance", stencil: false }}
      >
        <color attach="background" args={["#050403"]} />
        <Director />
        <Worlds />
        <PostFX />
      </Canvas>
    </div>
  );
}
