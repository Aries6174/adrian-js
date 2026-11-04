"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SavePass } from "three/examples/jsm/postprocessing/SavePass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {
  getStage,
  prepareScene,
  SCENE_FADE,
  type SceneId,
  setStage,
  useStage,
  warpAmount,
  warpIsLeaving,
  worldReady,
} from "@/lib/stage";
import { AboutScene, ABOUT_POSE } from "./scenes/AboutScene";
import { ContactScene, CONTACT_POSE } from "./scenes/ContactScene";
import { HallScene, HALL_POSE } from "./scenes/HallScene";
import { IntroScene, INTRO_POSE } from "./scenes/IntroScene";
import { WorldBuilt } from "./parts";
import { ProjectsScene, PROJECTS_POSE } from "./scenes/ProjectsScene";
import { bakes, compileFor, NOISE_GLSL, noiseUniforms, type Pose, uPixels, uTime } from "./shared";

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
    const leaving = warpIsLeaving();
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
    if (leaving) eye.lerp(hole, warp * 0.03);
    lookAt.set(...target);
    if (leaving) lookAt.lerp(hole, warp * 0.12);

    camera.position.copy(eye);
    camera.lookAt(lookAt);

    // Wider screens keep the vertical framing, narrow ones keep the horizontal.
    const narrow = Math.min(1.75, Math.max(1, 16 / 9 / aspect));
    const halfFov = Math.tan(THREE.MathUtils.degToRad(pose.fov / 2)) * narrow;
    const warpZoom = leaving ? 1 - warp * 0.1 : 1 + warp * 0.08;
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
    tPrevious: { value: null as THREE.Texture | null },
    uFade: { value: 0 },
    uWarp: { value: 0 },
    uCenter: { value: warpCenter },
    uAspect: { value: 1.78 },
    uTexel: { value: new THREE.Vector2(1 / 1600, 1 / 900) },
    uSharpen: { value: 0.35 },
    uTime,
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: /* glsl */ `
    uniform vec2 uTexel;
    uniform float uSharpen;
    uniform sampler2D tDiffuse;
    uniform sampler2D tPrevious;
    uniform float uFade;
    uniform float uWarp;
    uniform vec2 uCenter;
    uniform float uAspect;
    uniform float uTime;
    varying vec2 vUv;
    ${NOISE_GLSL}
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
    // A short radial smear. It stays well away from the centre so it never averages down
    // into the hole's black shadow, which keeps overall brightness steady.
    vec3 smeared(sampler2D map,vec2 d,float pull){
      vec3 c=vec3(0.);
      for(int i=0;i<10;i++){
        c+=textureLod(map,uCenter+d*(1.-pull*float(i)/9.),0.).rgb;
      }
      return c/10.;
    }
    // Pushes each pixel away from the average of its neighbours, which firms up soft edges.
    // The limit stops bright text from growing dark outlines.
    vec3 sharpened(sampler2D map){
      vec3 c=texture2D(map,vUv).rgb;
      vec3 around=(texture2D(map,vUv+vec2(uTexel.x,0.)).rgb+texture2D(map,vUv-vec2(uTexel.x,0.)).rgb
        +texture2D(map,vUv+vec2(0.,uTexel.y)).rgb+texture2D(map,vUv-vec2(0.,uTexel.y)).rgb)*.25;
      return max(c+clamp(c-around,-.2,.2)*uSharpen*2.,0.);
    }
    void main(){
      vec2 d=vUv-uCenter;
      float pull=uWarp*.26;
      vec3 col=uWarp>.002?smeared(tDiffuse,d,pull):sharpened(tDiffuse);
      if(uFade>.002){
        col=mix(col,smeared(tPrevious,d,pull),uFade);
      }
      if(uWarp>.002){
        vec2 ad=d*vec2(uAspect,1.);
        float a=atan(ad.y,ad.x);
        float streak=pow(vnoise(vec2(a*34.,uTime*.7)),7.);
        col+=vec3(1.,.66,.3)*streak*smoothstep(.15,.6,length(ad))*uWarp*uWarp*.3;
      }
      col*=1.-uWarp*.42;
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

type WorldEntry = { group: THREE.Group; status: "building" | "mounted" | "compiling" | "compiled" | "warm" };
const worlds = new Map<SceneId, WorldEntry>();

/** Resolution steps. Lower ones also drop anti-aliasing and glow. */
const MAX_QUALITY = 1.25;
const MIN_QUALITY = 0.7;
const QUALITY_STEP = 0.15;
const SLOW_FRAME = 1 / 38;
const FAST_FRAME = 1 / 56;

function PostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const run = useRef({
    first: true,
    scene: getStage().scene,
    sceneSince: 0,
    fadeStart: -Infinity,
    settleUntil: 0,
    count: 0,
    spent: 0,
    tick: 0,
    width: 0,
    height: 0,
    pixelRatio: 0,
    quality: MAX_QUALITY,
    ceiling: MAX_QUALITY,
    ceilingUntil: 0,
    raisedAt: -Infinity,
  });

  const { composer, grade, snapshot, bloom, warmTarget } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      samples: 2,
    });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ShaderPass(CLAMP));
    const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.08, 0.6, 1);
    composer.addPass(bloom);
    const snapshot = new SavePass();
    composer.addPass(snapshot);
    // Passing a material keeps the shared uniforms; a plain object would be cloned.
    const grade = new ShaderPass(new THREE.ShaderMaterial(GRADE));
    grade.uniforms.tPrevious.value = snapshot.renderTarget.texture;
    composer.addPass(grade);
    const warmTarget = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    return { composer, grade, snapshot, bloom, warmTarget };
  }, [gl, scene, camera]);

  useFrame((state, delta) => {
    const r = run.current;
    const now = performance.now();
    const stage = getStage();

    // Prepare worlds out of sight: compile on the side, then one tiny draw to upload everything.
    for (const [id, world] of worlds) {
      if (world.status === "mounted") {
        world.status = "compiling";
        compileFor(gl, world.group, camera, composer.renderTarget1).then(() => {
          world.status = "compiled";
        });
      } else if (world.status === "compiled" && bakes.pending === 0) {
        world.group.visible = true;
        const previous = gl.getRenderTarget();
        gl.setRenderTarget(warmTarget);
        gl.render(world.group, camera);
        gl.setRenderTarget(previous);
        world.group.visible = false;
        world.status = "warm";
        worldReady(id);
        break;
      }
    }

    // Any change of world dissolves from the last saved frame, including back and forward.
    if (stage.scene !== r.scene) {
      r.scene = stage.scene;
      r.sceneSince = now;
      if (stage.ready) r.fadeStart = now;
      r.settleUntil = now + SCENE_FADE + 1500;
      r.count = 0;
      r.spent = 0;
    }
    for (const [id, world] of worlds) {
      // If preparing takes far too long, draw it anyway rather than showing nothing.
      world.group.visible = id === r.scene && (world.status === "warm" || now - r.sceneSince > 6000);
    }

    const left = THREE.MathUtils.clamp(1 - (now - r.fadeStart) / SCENE_FADE, 0, 1);
    const fade = left * left * (3 - 2 * left);
    const warp = warpAmount(now);

    const { size, viewport } = state.get();

    // Trade resolution for smoothness. Only the internal buffers change: the canvas keeps its
    // size, because resizing it would clear it and show a black frame. One-off hitches, page
    // changes, worlds being prepared and throttled tabs say nothing about the GPU.
    const preparing = [...worlds.values()].some((world) => world.status !== "warm") || bakes.pending > 0;
    if (preparing) r.settleUntil = Math.max(r.settleUntil, now + 1000);
    const best = Math.min(viewport.dpr, MAX_QUALITY);
    const measurable = !r.first && fade === 0 && warp === 0 && now > r.settleUntil;
    if (measurable && delta < 0.2 && !document.hidden && document.hasFocus()) {
      r.count += 1;
      r.spent += delta;
      if (r.count >= 45) {
        const average = r.spent / r.count;
        r.count = 0;
        r.spent = 0;
        if (average > SLOW_FRAME && r.quality > MIN_QUALITY) {
          // A raise that didn't hold stops further raises above this level for a while.
          if (now - r.raisedAt < 8000) {
            r.ceiling = r.quality - QUALITY_STEP;
            r.ceilingUntil = now + 60000;
          }
          r.quality = Math.max(MIN_QUALITY, r.quality - QUALITY_STEP);
          r.settleUntil = now + 1000;
        } else if (average < FAST_FRAME && r.quality < best && now - r.raisedAt > 12000) {
          r.quality = Math.min(now > r.ceilingUntil ? best : r.ceiling, r.quality + QUALITY_STEP);
          r.raisedAt = now;
          r.settleUntil = now + 1000;
        }
      }
    }

    if (r.first) {
      r.quality = Math.min(viewport.dpr, MAX_QUALITY);
      r.ceiling = r.quality;
    }
    const pixelRatio = Math.min(viewport.dpr, r.quality);
    if (size.width !== r.width || size.height !== r.height || pixelRatio !== r.pixelRatio) {
      r.width = size.width;
      r.height = size.height;
      r.pixelRatio = pixelRatio;
      const low = r.quality < 0.95;
      bloom.enabled = !low;
      composer.renderTarget1.samples = low ? 0 : 2;
      composer.renderTarget2.samples = low ? 0 : 2;
      gl.domElement.dataset.quality = pixelRatio.toFixed(2);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(size.width, size.height);
      grade.uniforms.uAspect.value = size.width / size.height;
      grade.uniforms.uTexel.value.set(1 / (size.width * pixelRatio), 1 / (size.height * pixelRatio));
      grade.uniforms.uSharpen.value = low ? 0.7 : 0.35;
      uPixels.value = pixelRatio / 0.85;
      // Resizing empties the saved frame, so refill it right away.
      r.tick = 7;
    }

    r.tick += 1;
    snapshot.enabled = fade === 0 && (warpIsLeaving() || r.tick % 8 === 0);
    grade.uniforms.uFade.value = fade;
    grade.uniforms.uWarp.value = warp;
    composer.render(delta);

    if (r.first && worlds.get(r.scene)?.status === "warm") {
      r.first = false;
      setStage({ ready: true });
    }
  }, 1);

  return null;
}

function World({ id, children }: { id: SceneId; children: ReactNode }) {
  const register = useCallback(
    (group: THREE.Group | null) => {
      if (group) worlds.set(id, { group, status: "building" });
      else worlds.delete(id);
    },
    [id],
  );
  const built = useCallback(() => {
    const world = worlds.get(id);
    if (world?.status === "building") world.status = "mounted";
  }, [id]);
  return (
    <group ref={register} visible={false}>
      <WorldBuilt.Provider value={built}>{children}</WorldBuilt.Provider>
    </group>
  );
}

const ORDER: SceneId[] = ["hall", "projects", "about", "contact", "intro"];

function Worlds() {
  const scene = useStage((s) => s.scene);
  const prepared = useStage((s) => s.mounted);
  const worldsReady = useStage((s) => s.worldsReady);
  const ready = useStage((s) => s.ready);
  const leaving = useStage((s) => s.leaving);
  const has = (id: SceneId) => id === scene || prepared.includes(id);

  // Quietly get the other worlds ready, one at a time. Small or low-memory devices skip
  // this and build each world when it's needed.
  useEffect(() => {
    if (!ready || leaving) return;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    if (window.innerWidth < 1024 || memory < 4) return;
    const building = prepared.some((id) => !worldsReady.includes(id));
    const next = ORDER.find((id) => id !== scene && !prepared.includes(id));
    if (!next || building) return;
    let idle = 0;
    const timer = window.setTimeout(() => {
      idle = window.requestIdleCallback(() => prepareScene(next), { timeout: 1500 });
    }, 2000);
    return () => {
      window.clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, [ready, leaving, prepared, worldsReady, scene]);

  return (
    <>
      {has("intro") && (
        <World id="intro">
          <IntroScene visible />
        </World>
      )}
      {has("hall") && (
        <World id="hall">
          <HallScene visible />
        </World>
      )}
      {has("projects") && (
        <World id="projects">
          <ProjectsScene visible />
        </World>
      )}
      {has("about") && (
        <World id="about">
          <AboutScene visible />
        </World>
      )}
      {has("contact") && (
        <World id="contact">
          <ContactScene visible />
        </World>
      )}
    </>
  );
}

/** A fixed ratio: changing it later would resize the canvas, which blanks a frame. */
const CANVAS_DPR = Math.min(window.devicePixelRatio || 1, MAX_QUALITY);

export default memo(function Experience() {
  return (
    <div aria-hidden className="fixed inset-0 z-0">
      <Canvas
        flat
        dpr={CANVAS_DPR}
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
});
