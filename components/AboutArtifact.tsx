"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const GOLD = "#f0bb66";
const BRIGHT = "#ffe1a8";

/**
 * A gold crystal that tumbles on all three axes inside a slower cage turning the other way,
 * with a tilted orbit and a small moon going round it.
 */
function Crystal({ still }: { still: boolean }) {
  const crystal = useRef<THREE.Group>(null);
  const cage = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Mesh>(null);

  const shapes = useMemo(() => {
    const core = new THREE.IcosahedronGeometry(1, 0);
    const cageShape = new THREE.DodecahedronGeometry(1.6, 0);
    return {
      core,
      coreEdges: new THREE.EdgesGeometry(core),
      cageEdges: new THREE.EdgesGeometry(cageShape),
      // The cage's corners, drawn as small lit points.
      corners: cageShape,
    };
  }, []);

  useEffect(
    () => () => Object.values(shapes).forEach((shape) => shape.dispose()),
    [shapes],
  );

  useFrame((state, delta) => {
    // Speeds are in radians per second around each axis. Different speeds on x, y and z
    // mean the crystal never shows quite the same side twice in a row.
    const step = still ? 0 : Math.min(delta, 0.05);
    if (crystal.current) {
      crystal.current.rotation.x += step * 0.45;
      crystal.current.rotation.y += step * 0.7;
      crystal.current.rotation.z += step * 0.3;
    }
    if (cage.current) {
      cage.current.rotation.x -= step * 0.18;
      cage.current.rotation.y -= step * 0.26;
      cage.current.rotation.z += step * 0.12;
    }
    if (moon.current) {
      const t = still ? 0.6 : state.clock.elapsedTime * 0.6;
      moon.current.position.set(Math.cos(t) * 2.1, 0, Math.sin(t) * 2.1);
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={2.4} color="#ffd9a0" />
      <pointLight position={[-3, -2, 2]} intensity={8} color="#c98a42" />

      <group ref={crystal}>
        <mesh geometry={shapes.core}>
          <meshStandardMaterial color="#3a2610" metalness={0.45} roughness={0.4} flatShading />
        </mesh>
        <lineSegments geometry={shapes.coreEdges}>
          <lineBasicMaterial color={BRIGHT} />
        </lineSegments>
      </group>

      <group ref={cage}>
        <lineSegments geometry={shapes.cageEdges}>
          <lineBasicMaterial color={GOLD} transparent opacity={0.4} />
        </lineSegments>
        <points geometry={shapes.corners}>
          <pointsMaterial color={BRIGHT} size={0.09} sizeAttenuation />
        </points>
      </group>

      <group rotation={[1.15, 0.2, 0.35]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.1, 0.012, 6, 128]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.55} />
        </mesh>
        <mesh ref={moon}>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshBasicMaterial color={BRIGHT} />
        </mesh>
      </group>
    </>
  );
}

/** Its own small 3D view, which only draws while it's on screen. */
export default function AboutArtifact({ label }: { label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(motion.matches);
    update();
    motion.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (box.current) observer.observe(box.current);
    return () => {
      motion.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={box} role="img" aria-label={label} className="absolute inset-0">
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 2]}
        camera={{ fov: 38, position: [0, 0, 6.2] }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      >
        <Crystal still={still} />
      </Canvas>
    </div>
  );
}
