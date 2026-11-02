"use client";

import { useEffect } from "react";
import type { Project } from "@/lib/content";
import { setStage } from "@/lib/stage";

/** Hands the projects to the 3D scene, which lives outside the page tree. */
export function ContentBridge({ projects }: { projects: Project[] }) {
  useEffect(() => {
    setStage({ projects });
  }, [projects]);
  return null;
}
