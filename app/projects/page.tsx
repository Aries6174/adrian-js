import type { Metadata } from "next";
import { ProjectsView } from "@/components/ProjectsView";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Worlds built through code: Elvicor Management System, UP: Visions and other projects by Adrian Jaspa.",
};

export default function ProjectsPage() {
  return <ProjectsView />;
}
