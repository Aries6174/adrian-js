import type { Metadata } from "next";
import { Suspense } from "react";
import { AboutView } from "@/components/AboutView";
import { GithubLoading, GithubProgress } from "@/components/GithubPanel";
import { PageReady } from "@/components/PageReady";
import { loadGithub } from "@/lib/github";
import { loadContent } from "@/lib/store";

export const metadata: Metadata = {
  title: "About",
  description:
    "Adrian Jaspa, a Computer and Information Science graduate who builds interactive and meaningful web experiences.",
};

async function GithubSection({ handle }: { handle: string }) {
  return <GithubProgress stats={await loadGithub(handle)} handle={handle} />;
}

async function AboutContent() {
  const { about, profile } = await loadContent();
  return (
    <>
      {/* In its own Suspense, so the page never waits on GitHub. */}
      <AboutView
        about={about}
        github={
          <Suspense fallback={<GithubLoading />}>
            <GithubSection handle={profile.githubHandle} />
          </Suspense>
        }
      />
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
