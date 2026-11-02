"use client";

import { useSyncExternalStore } from "react";

export type SceneId = "intro" | "hall" | "projects" | "about" | "contact";

export const WARP_IN = 600;
export const WARP_OUT = 900;
/** How long the previous world lingers as it dissolves into the next. */
export const SCENE_FADE = 800;

type StageState = {
  scene: SceneId;
  mounted: SceneId[];
  leaving: boolean;
  ready: boolean;
  webgl: boolean;
  project: number;
  filter: string;
  aboutSection: number;
};

type Navigate = (href: string) => void;

let state: StageState = {
  scene: "intro",
  mounted: [],
  leaving: false,
  ready: false,
  webgl: true,
  project: 0,
  filter: "all",
  aboutSection: 0,
};

const listeners = new Set<() => void>();
let navigate: Navigate = () => {};
let warpStart = -Infinity;

export function sceneForPath(pathname: string): SceneId {
  if (pathname.startsWith("/home")) return "hall";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/about")) return "about";
  if (pathname.startsWith("/contact")) return "contact";
  return "intro";
}

export function setStage(patch: Partial<StageState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function getStage() {
  return state;
}

export function useStage<T>(select: (s: StageState) => T): T {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => select(state),
    () => select(state),
  );
}

/** Builds a world ahead of time so that flying into it does not stall. */
export function prepareScene(scene: SceneId) {
  if (!state.mounted.includes(scene)) setStage({ mounted: [...state.mounted, scene] });
}

export function registerNavigate(fn: Navigate) {
  navigate = fn;
}

/** 0 at rest, rising to 1 at the swap, falling back to 0 as the new scene appears. */
export function warpAmount(now = performance.now()) {
  const t = now - warpStart;
  if (t < 0 || t > WARP_IN + WARP_OUT) return 0;
  const k = t < WARP_IN ? t / WARP_IN : 1 - (t - WARP_IN) / WARP_OUT;
  return k * k * (3 - 2 * k);
}

export function warpIsLeaving(now = performance.now()) {
  const t = now - warpStart;
  return t >= 0 && t < WARP_IN;
}

/** Fly to a route through the black hole. Also accepts `/about#skills`. */
export function travel(href: string) {
  const [path, hash] = href.split("#");
  const target = sceneForPath(path);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (hash === "skills") setStage({ aboutSection: 2 });
  prepareScene(target);

  if (state.leaving) return;
  if (target === state.scene || reduced || !state.webgl) {
    setStage({ scene: target });
    navigate(href);
    return;
  }

  warpStart = performance.now();
  setStage({ leaving: true });
  window.setTimeout(() => {
    setStage({ scene: target });
    navigate(href);
    // The route change normally ends this first; never leave the page hidden.
    window.setTimeout(() => setStage({ leaving: false }), 1500);
  }, WARP_IN);
}
