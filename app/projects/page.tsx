import type { Metadata } from "next";
import { Suspense } from "react";
import { PageReady } from "@/components/PageReady";
import { ProjectsView } from "@/components/ProjectsView";
import { inDisplayOrder } from "@/lib/content";
import { loadContent } from "@/lib/store";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Worlds built through code: Elvicor Management System, UP: Visions and other projects by Adrian Jaspa.",
};

async function ProjectsContent() {
  const { projects } = await loadContent();
  return (
    <>
      <ProjectsView projects={inDisplayOrder(projects)} />
      <PageReady path="/projects" />
    </>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsContent />
    </Suspense>
  );
}
