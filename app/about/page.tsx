import type { Metadata } from "next";
import { Suspense } from "react";
import { AboutView } from "@/components/AboutView";
import { PageReady } from "@/components/PageReady";
import { loadContent } from "@/lib/store";

export const metadata: Metadata = {
  title: "About",
  description:
    "Adrian Jaspa, a Computer and Information Science graduate who builds interactive and meaningful web experiences.",
};

async function AboutContent() {
  const { about } = await loadContent();
  return (
    <>
      <AboutView about={about} />
      <PageReady path="/about" />
    </>
  );
}

export default function AboutPage() {
  return (
    <Suspense fallback={null}>
      <AboutContent />
    </Suspense>
  );
}
