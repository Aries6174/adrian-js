import * as THREE from "three";

/** One clock for every shader, advanced by the Director. */
export const uTime = { value: 0 };

export const HASH_GLSL = /* glsl */ `
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float hash31(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
`;

/** Value noise read from small tiling textures: one fetch instead of eight hashes. */
export const NOISE_GLSL = /* glsl */ `
uniform sampler2D uN2;
uniform highp sampler3D uN3;
${HASH_GLSL}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return textureLod(uN2,(i+f+.5)/256.,0.).r;
}
float vnoise3(vec3 p){
  vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return textureLod(uN3,(i+f+.5)/32.,0.).r;
}
float fbm2(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise3(p); p=p*2.03+vec3(17.1,9.2,4.7); a*=.5; } return s; }
`;

function noiseBytes(size: number) {
  const rand = seeded(1337);
  return Uint8Array.from({ length: size }, () => Math.floor(rand() * 256));
}

const noise2 = new THREE.DataTexture(noiseBytes(256 * 256), 256, 256, THREE.RedFormat);
const noise3D = new THREE.Data3DTexture(noiseBytes(32 * 32 * 32), 32, 32, 32);
noise3D.format = THREE.RedFormat;
noise3D.wrapR = THREE.RepeatWrapping;
for (const texture of [noise2, noise3D]) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
}

/** Spread into the uniforms of any material whose shader includes NOISE_GLSL. */
export const noiseUniforms = {
  uN2: { value: noise2 as THREE.Texture },
  uN3: { value: noise3D as THREE.Texture },
};

/** Small seeded generator so the worlds are identical on every visit. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const smooth = (v: number) => v * v * (3 - 2 * v);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(
      lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx),
      lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx),
      fy,
    ),
    lerp(
      lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx),
      lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx),
      fy,
    ),
    fz,
  );
}

export function fbm(x: number, y: number, z: number, octaves = 4) {
  let amplitude = 0.5;
  let sum = 0;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise3(x * frequency, y * frequency, z * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return sum;
}

export function ridged(x: number, y: number, z: number, octaves = 4) {
  let amplitude = 0.5;
  let sum = 0;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * frequency, y * frequency, z * frequency) * 2 - 1);
    sum += amplitude * n * n;
    frequency *= 2.1;
    amplitude *= 0.5;
  }
  return sum;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export type World = {
  uLightPos: { value: THREE.Vector3[] };
  uLightCol: { value: THREE.Color[] };
  uLightK: { value: number[] };
  uAmbient: { value: THREE.Color };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
  uRimDir: { value: THREE.Vector3 };
  uRimCol: { value: THREE.Color };
};

type Light = { pos: [number, number, number]; color: string; power: number; falloff: number };

export function makeWorld(config: {
  lights: Light[];
  ambient: string;
  ambientPower?: number;
  fog: string;
  fogDensity: number;
  rimDir: [number, number, number];
  rim: string;
  rimPower?: number;
}): World {
  const lights = [...config.lights];
  while (lights.length < 4) lights.push({ pos: [0, 0, 0], color: "#000000", power: 0, falloff: 1 });
  return {
    uLightPos: { value: lights.map((l) => new THREE.Vector3(...l.pos)) },
    uLightCol: { value: lights.map((l) => new THREE.Color(l.color).multiplyScalar(l.power)) },
    uLightK: { value: lights.map((l) => l.falloff) },
    uAmbient: { value: new THREE.Color(config.ambient).multiplyScalar(config.ambientPower ?? 1) },
    uFogColor: { value: new THREE.Color(config.fog) },
    uFogDensity: { value: config.fogDensity },
    uRimDir: { value: new THREE.Vector3(...config.rimDir).normalize() },
    uRimCol: { value: new THREE.Color(config.rim).multiplyScalar(config.rimPower ?? 1) },
  };
}

const SURFACE_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec3 vTint;
void main(){
  vec4 p=vec4(position,1.);
  mat3 basis=mat3(modelMatrix);
  vTint=vec3(1.);
  #ifdef USE_INSTANCING
    p=instanceMatrix*p;
    basis=basis*mat3(instanceMatrix);
  #endif
  #ifdef USE_INSTANCING_COLOR
    vTint=instanceColor;
  #endif
  vec4 w=modelMatrix*p;
  vW=w.xyz;
  vN=transpose(inverse(basis))*normal;
  gl_Position=projectionMatrix*viewMatrix*w;
}`;

const SURFACE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uShine;
uniform float uSpec;
uniform float uDetail;
uniform float uBump;
uniform float uRimAmount;
uniform float uRimPower;
uniform float uPanel;
uniform vec3 uLightPos[4];
uniform vec3 uLightCol[4];
uniform float uLightK[4];
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
varying vec3 vW;
varying vec3 vN;
varying vec3 vTint;
${NOISE_GLSL}
void main(){
  vec3 V=normalize(cameraPosition-vW);
  #ifdef FLAT
    vec3 N=normalize(cross(dFdx(vW),dFdy(vW)));
  #else
    vec3 N=normalize(vN);
  #endif
  if(dot(N,V)<0.) N=-N;
  vec3 albedo=uColor*vTint;
  float wet=1.;
  vec3 emit=vec3(0.);
  #ifdef PANELS
    // Plating drawn from world position, so any box reads as built structure.
    vec3 an=abs(normalize(vN));
    vec2 puv=an.y>.6?vW.xz:(an.x>an.z?vW.zy:vW.xy);
    vec2 cell=puv/vec2(uPanel,uPanel*1.7);
    vec2 id=floor(cell),pf=fract(cell);
    float ph=hash21(id);
    float seam=smoothstep(0.,.035,pf.x)*smoothstep(1.,.965,pf.x)*smoothstep(0.,.022,pf.y)*smoothstep(1.,.978,pf.y);
    float rivet=smoothstep(.45,.5,abs(fract(cell.y*5.)-.5))*.25;
    albedo*=(.5+ph*1.15)*(.28+.72*seam)*(1.-rivet);
    wet=.6+ph*1.2;
    float slot=step(.975,ph)*step(.47,pf.x)*step(pf.x,.53)*step(.12,pf.y)*step(pf.y,.88);
    emit=vec3(1.,.52,.16)*slot*(.5+.25*sin(ph*90.));
  #endif
  #ifdef DETAIL
    float lod=1./(1.+length(cameraPosition-vW)*uDetail*.035);
    vec3 q=vW*uDetail;
    float n0=fbm3(q);
    float e=.14;
    vec3 g=vec3(fbm3(q+vec3(e,0,0))-n0,fbm3(q+vec3(0,e,0))-n0,fbm3(q+vec3(0,0,e))-n0)/e;
    N=normalize(N-g*uBump*lod);
    albedo*=mix(1.,.55+n0*.95,lod);
    albedo=mix(albedo,uAccent,smoothstep(.45,.82,N.y)*smoothstep(.42,.62,vnoise3(q*.55+7.))*.75);
    float puddle=smoothstep(.56,.74,vnoise3(q*.3+3.));
    wet=mix(.12,.12+puddle*4.5+pow(vnoise3(q*2.3),5.)*9.,lod);
  #endif
  vec3 col=albedo*uAmbient*(.55+.45*N.y);
  for(int i=0;i<4;i++){
    vec3 L=uLightPos[i]-vW;
    float d2=dot(L,L);
    L/=sqrt(d2);
    float att=1./(1.+uLightK[i]*d2);
    float diff=max(dot(N,L),0.);
    vec3 H=normalize(L+V);
    float sp=pow(max(dot(N,H),0.),uShine)*uSpec*wet;
    col+=uLightCol[i]*att*(albedo*diff+sp*diff);
  }
  float fres=pow(clamp(1.-dot(N,V),0.,1.),uRimPower);
  float back=.35+.65*max(dot(-V,uRimDir),0.);
  col+=uRimCol*fres*back*uRimAmount;
  col+=emit;
  float dist=length(cameraPosition-vW);
  float fog=1.-exp(-uFogDensity*uFogDensity*dist*dist);
  gl_FragColor=vec4(mix(col,uFogColor,fog),1.);
}`;

export function surface(
  world: World,
  options: {
    color: string;
    accent?: string;
    shine?: number;
    spec?: number;
    rim?: number;
    rimPower?: number;
    panel?: number;
    flat?: boolean;
    detail?: number;
    bump?: number;
  },
) {
  const material = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERT,
    fragmentShader: SURFACE_FRAG,
    defines: {
      ...(options.flat ? { FLAT: 1 } : {}),
      ...(options.detail ? { DETAIL: 1 } : {}),
      ...(options.panel ? { PANELS: 1 } : {}),
    },
    uniforms: {
      ...world,
      ...noiseUniforms,
      uColor: { value: new THREE.Color(options.color) },
      uAccent: { value: new THREE.Color(options.accent ?? options.color) },
      uShine: { value: options.shine ?? 40 },
      uSpec: { value: options.spec ?? 0.4 },
      uDetail: { value: options.detail ?? 1 },
      uBump: { value: options.bump ?? 0.5 },
      uRimAmount: { value: options.rim ?? 1 },
      uRimPower: { value: options.rimPower ?? 4.5 },
      uPanel: { value: options.panel ?? 1 },
    },
  });
  return material;
}

/** Self-lit material. Values above 1 feed the bloom pass. */
export function glow(color: string, power = 4) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(power),
  });
}

/**
 * Orientation of a black hole's disk in the world, for props that orbit with it.
 * Mirrors the virtual camera used in the hole's shader, seen from `eye`.
 */
export function diskBasis(
  eye: THREE.Vector3,
  center: THREE.Vector3,
  tilt: number,
  roll: number,
) {
  const back = eye.clone().sub(center).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
  const up = back.clone().cross(right);
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const rolled = (x: number, y: number, z: number) =>
    right
      .clone()
      .multiplyScalar(x * c - y * s)
      .addScaledVector(up, x * s + y * c)
      .addScaledVector(back, z);
  const hx = rolled(1, 0, 0);
  const hy = rolled(0, Math.cos(tilt), Math.sin(tilt));
  const hz = rolled(0, -Math.sin(tilt), Math.cos(tilt));
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(hx, hy, hz),
  );
}

/** Scene-level parameters shared with the Director for camera and warp. */
export type Pose = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  parallax: [number, number];
  /** World point the warp collapses into. */
  hole: [number, number, number];
  /** Camera target used on portrait screens, where the sides get cropped. */
  portraitTarget?: [number, number, number];
};
