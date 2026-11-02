import type { Metadata } from "next";
import { AboutView } from "@/components/AboutView";

export const metadata: Metadata = {
  title: "About",
  description:
    "Adrian Jaspa, a Computer and Information Science graduate who builds interactive and meaningful web experiences.",
};

export default function AboutPage() {
  return <AboutView />;
}
