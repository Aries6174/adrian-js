"use client";

import { useSyncExternalStore } from "react";
import type { Project } from "./content";

export type SceneId = "intro" | "hall" | "projects" | "about" | "contact";

export const WARP_IN = 600;
export const WARP_OUT = 900;
/** How long the previous world lingers as it dissolves into the next. */
export const SCENE_FADE = 800;
/** How many project panels fit in the 3D scene at once. */
export const PROJECTS_IN_VIEW = 5;

/** After this, a page that hasn't reported in is shown anyway. */
const PAGE_WAIT = 3500;
/** After this, a world that isn't prepared is shown anyway. */
const WORLD_WAIT = 6000;
/** After this, a route that hasn't arrived gets a full page load. */
const ROUTE_WAIT = 10000;
/** Longer holds than this show a small loading line. */
const LOADER_AFTER = 500;

type StageState = {
  scene: SceneId;
  mounted: SceneId[];
  worldsReady: SceneId[];
  leaving: boolean;
  /** Where the latest click is heading, so the header can respond at once. */
  targetPath: string | null;
  holding: boolean;
  ready: boolean;
  webgl: boolean;
  projects: Project[];
  projectId: string | null;
  projectScroll: number;
  filter: string;
  aboutSection: number;
};

let state: StageState = {
  scene: "intro",
  mounted: [],
  worldsReady: [],
  leaving: false,
  targetPath: null,
  holding: false,
  ready: false,
  webgl: true,
  projects: [],
  projectId: null,
  projectScroll: 0,
  filter: "all",
  aboutSection: 0,
};

const listeners = new Set<() => void>();
let navigate: (href: string) => void = () => {};

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

export function registerNavigate(fn: (href: string) => void) {
  navigate = fn;
}

/* A page change has one target and three steps:
   out      the old page fades and space stretches
   holding  the route loads and the world prepares, while the warp stays at its peak
   arrive   the new page and the new world appear together, in one update
   A click at any point only changes the target, so the last click always wins. */
type Target = { href: string; path: string; scene: SceneId };

let target: Target | null = null;
let phase: "idle" | "out" | "holding" = "idle";
let committedPath: string | null = null;
let sentHref: string | null = null;
let backNavScene: SceneId | null = null;
const shownPages = new Set<string>();

let still = false;
let warpFrom = 0;
let warpStart = -Infinity;
let releaseStart = -Infinity;
let releaseFrom = 0;
let holdStart = 0;
let outTimer = 0;
let holdTimer = 0;

const smooth = (k: number) => k * k * (3 - 2 * k);

/** 0 at rest, rising to 1 for as long as the page change is in progress, then falling back. */
export function warpAmount(now = performance.now()) {
  if (still) return 0;
  if (phase === "out") {
    const k = Math.min(1, Math.max(0, (now - warpStart) / WARP_IN));
    return warpFrom + (1 - warpFrom) * smooth(k);
  }
  if (phase === "holding") return 1;
  const t = now - releaseStart;
  if (t < 0 || t > WARP_OUT) return 0;
  return releaseFrom * smooth(1 - t / WARP_OUT);
}

export function warpIsLeaving() {
  return phase !== "idle";
}

function sendRoute() {
  if (!target || target.href === sentHref) return;
  // Back to the page already showing, with no other route on its way: there's nothing to load.
  if (target.path === committedPath && sentHref === null) return;
  sentHref = target.href;
  navigate(target.href);
}

function arrive() {
  if (!target) return;
  window.clearInterval(holdTimer);
  phase = "idle";
  releaseStart = performance.now();
  releaseFrom = 1;
  const { scene } = target;
  target = null;
  sentHref = null;
  setStage({ scene, leaving: false, targetPath: null, holding: false });
}

function checkHold() {
  if (phase !== "holding" || !target) return;
  const elapsed = performance.now() - holdStart;
  if (committedPath !== target.path) {
    if (elapsed > ROUTE_WAIT) window.location.assign(target.href);
  } else {
    const pageOk = shownPages.has(target.path) || elapsed > PAGE_WAIT;
    const worldOk = !state.webgl || state.worldsReady.includes(target.scene) || elapsed > WORLD_WAIT;
    if (pageOk && worldOk) return arrive();
  }
  if (elapsed > LOADER_AFTER && !state.holding) setStage({ holding: true });
}

function beginHold() {
  phase = "holding";
  holdStart = performance.now();
  window.clearInterval(holdTimer);
  holdTimer = window.setInterval(checkHold, 100);
  sendRoute();
  checkHold();
}

/** Fly to a route through the black hole. Also accepts `/about#skills`. */
export function travel(href: string) {
  const [path, hash] = href.split("#");
  const scene = sceneForPath(path);

  if (hash === "skills") setStage({ aboutSection: 2 });
  prepareScene(scene);

  if (phase !== "idle") {
    target = { href, path, scene };
    setStage({ targetPath: path });
    if (phase === "holding") {
      // The waits below are for this route, so a new choice starts them again.
      holdStart = performance.now();
      sendRoute();
      checkHold();
    }
    return;
  }

  if (path === committedPath) {
    navigate(href);
    return;
  }

  target = { href, path, scene };
  still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !state.webgl;
  warpFrom = warpAmount();
  warpStart = performance.now();
  phase = "out";
  setStage({ leaving: true, targetPath: path });
  window.clearTimeout(outTimer);
  outTimer = window.setTimeout(beginHold, still ? 0 : WARP_IN);
}

/** Called whenever the URL actually changes, including the back and forward buttons. */
export function routeCommitted(path: string) {
  committedPath = path;
  // A world stays built once it exists, including the one the visit started on.
  prepareScene(sceneForPath(path));
  if (phase === "idle") {
    const scene = sceneForPath(path);
    if (!state.ready || !state.webgl || state.worldsReady.includes(scene)) {
      backNavScene = null;
      setStage({ scene });
    } else {
      backNavScene = scene;
      prepareScene(scene);
    }
    return;
  }
  checkHold();
}

/** A page's content has streamed in and can be seen. */
export function pageShown(path: string) {
  shownPages.add(path);
  checkHold();
}

export function pageHidden(path: string) {
  shownPages.delete(path);
}

/** A world is compiled and uploaded, so showing it won't stall. */
export function worldReady(scene: SceneId) {
  if (!state.worldsReady.includes(scene)) setStage({ worldsReady: [...state.worldsReady, scene] });
  if (phase === "idle" && backNavScene === scene) {
    backNavScene = null;
    setStage({ scene });
  }
  checkHold();
}
