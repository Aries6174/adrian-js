"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GlowRing, HoloPanel } from "../parts";
import { chartTexture } from "../panelTexture";
import { glow, seeded, surface, type World } from "../shared";

/** One instanced batch of boxes, placed with [x, y, z, sx, sy, sz, rotationY]. */
export function Boxes({
  items,
  material,
}: {
  items: number[][];
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new THREE.Object3D();
    items.forEach(([x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0], index) => {
      object.position.set(x, y, z);
      object.scale.set(sx, sy, sz);
      object.rotation.set(rx, ry, rz);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [items]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      frustumCulled={false}
    />
  );
}

/** Round hall: ring of columns with light strips, gallery rings and a ribbed dome. */
export function Rotunda({
  world,
  radius,
  height,
  columns = 16,
  center = [0, 0],
}: {
  world: World;
  radius: number;
  height: number;
  columns?: number;
  center?: [number, number];
}) {
  const { dark, trim, strip, faint, pillars, strips, faintStrips, ribs } = useMemo(() => {
    const pillars: number[][] = [];
    const strips: number[][] = [];
    const faintStrips: number[][] = [];
    const ribs: number[][] = [];
    const rand = seeded(9);
    for (let i = 0; i < columns; i++) {
      const a = ((i + 0.5) / columns) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = center[0] + ca * radius;
      const z = center[1] + sa * radius;
      const ry = -a + Math.PI / 2;
      pillars.push([x, height / 2, z, 2.6, height, 3.6, ry]);
      pillars.push([x, 1.1, z, 3.8, 2.2, 4.8, ry]);
      pillars.push([x, height * 0.42, z, 3.4, 0.9, 4.4, ry]);
      const ix = center[0] + ca * (radius - 1.84);
      const iz = center[1] + sa * (radius - 1.84);
      const side = 1.06;
      for (const s of [-1, 1]) {
        const ox = ix + -sa * s * side;
        const oz = iz + ca * s * side;
        const top = 7 + rand() * 7;
        strips.push([ox, 2.3 + top / 2, oz, 0.05, top, 0.05, ry]);
        faintStrips.push([ox, height * 0.42 + 4 + top / 2, oz, 0.04, top * 0.9, 0.04, ry]);
      }
      for (let k = 0; k < 2; k++) {
        const rib = radius - 3;
        const ra = a + (k * Math.PI) / columns;
        ribs.push([
          center[0] + (Math.cos(ra) * rib) / 2,
          height + 2.4,
          center[1] + (Math.sin(ra) * rib) / 2,
          rib,
          0.5,
          0.36,
          -ra,
          0,
          0,
        ]);
      }
    }
    return {
      dark: surface(world, { color: "#0f0b07", shine: 60, spec: 0.5, rim: 0.3 }),
      trim: surface(world, { color: "#1b130b", shine: 50, spec: 0.6, rim: 0.4 }),
      strip: glow("#ffb45e", 3.2),
      faint: glow("#ffac58", 1),
      pillars,
      strips,
      faintStrips,
      ribs,
    };
  }, [world, radius, height, columns, center]);

  const ringPosition = (y: number): [number, number, number] => [center[0], y, center[1]];

  return (
    <group>
      <Boxes items={pillars} material={dark} />
      <Boxes items={strips} material={strip} />
      <Boxes items={faintStrips} material={faint} />
      <Boxes items={ribs} material={trim} />
      {[height * 0.42, height * 0.72, height].map((y) => (
        <mesh key={y} position={ringPosition(y)} rotation={[Math.PI / 2, 0, 0]} material={dark}>
          <torusGeometry args={[radius - 0.8, 0.75, 8, 96]} />
        </mesh>
      ))}
      <GlowRing radius={radius - 2.1} position={ringPosition(height * 0.42 - 0.8)} tube={0.05} power={3.5} />
      <GlowRing radius={radius - 2.1} position={ringPosition(height * 0.72 - 0.8)} tube={0.04} power={2.2} />
      {[0.72, 0.5, 0.3, 0.14].map((k) => (
        <GlowRing
          key={k}
          radius={radius * k}
          position={ringPosition(height + 1.9)}
          tube={0.05}
          power={2.8}
        />
      ))}
    </group>
  );
}

/** Round railing, optionally only part of the way around. */
export function Railing({
  world,
  radius,
  center = [0, 0],
  y = 1.05,
  from = 0,
  arc = Math.PI * 2,
  posts = 44,
}: {
  world: World;
  radius: number;
  center?: [number, number];
  y?: number;
  from?: number;
  arc?: number;
  posts?: number;
}) {
  const { material, items, lower } = useMemo(() => {
    const material = surface(world, { color: "#20180f", shine: 60, spec: 1.3, rim: 0.8 });
    const items: number[][] = [];
    for (let i = 0; i <= posts; i++) {
      const a = from + (i / posts) * arc;
      items.push([center[0] + Math.cos(a) * radius, y / 2, center[1] + Math.sin(a) * radius, 0.05, y, 0.05, -a]);
    }
    return { material, items, lower: glow("#ffb65f", 1.5) };
  }, [world, radius, center, y, from, arc, posts]);

  // Lays the torus flat so its angles match the posts: x = cos, z = sin.
  const rotation: [number, number, number] = [Math.PI / 2, 0, from];
  return (
    <group>
      <Boxes items={items} material={material} />
      <mesh position={[center[0], y, center[1]]} rotation={rotation} material={material}>
        <torusGeometry args={[radius, 0.05, 8, 150, arc]} />
      </mesh>
      <mesh position={[center[0], y * 0.42, center[1]]} rotation={rotation} material={lower}>
        <torusGeometry args={[radius, 0.017, 6, 150, arc]} />
      </mesh>
    </group>
  );
}

/** A low stand with a tilted glowing display, as in the corners of the hall. */
export function Console({
  world,
  position,
  rotationY = 0,
  scale = 1,
  seed = 1,
  texture,
}: {
  world: World;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  seed?: number;
  texture?: THREE.Texture;
}) {
  const { body, trim, map } = useMemo(
    () => ({
      body: surface(world, { color: "#1b140c", shine: 40, spec: 0.8, rim: 0.75 }),
      trim: glow("#ffb45e", 3.6),
      map: texture ?? chartTexture(seed),
    }),
    [world, texture, seed],
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh position={[0, 0.5, 0]} material={body}>
        <boxGeometry args={[1.6, 1, 0.8]} />
      </mesh>
      <mesh position={[0, 1.1, 0.04]} rotation={[-0.72, 0, 0]} material={body}>
        <boxGeometry args={[2.1, 0.08, 1.4]} />
      </mesh>
      <mesh position={[0, 1.02, 0.54]} rotation={[-0.72, 0, 0]} material={trim}>
        <boxGeometry args={[2.1, 0.02, 0.02]} />
      </mesh>
      <HoloPanel
        texture={map}
        position={[0, 1.17, 0.08]}
        rotation={[-0.72, 0, 0]}
        width={1.96}
        height={1.26}
        bob={0}
      />
    </group>
  );
}
