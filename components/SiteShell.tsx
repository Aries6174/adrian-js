"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import {
  registerNavigate,
  sceneForPath,
  setStage,
  useStage,
} from "@/lib/stage";
import { Header } from "./Header";

const Experience = dynamic(() => import("@/three/Experience"), { ssr: false });

const noSubscribe = () => () => {};

function supportsWebGL() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const leaving = useStage((s) => s.leaving);
  const ready = useStage((s) => s.ready);
  const webgl = useStage((s) => s.webgl);
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);

  useEffect(() => {
    registerNavigate((href) => router.push(href));
  }, [router]);

  // Keeps the world in step with back/forward and direct links.
  useEffect(() => {
    setStage({ scene: sceneForPath(pathname), leaving: false });
  }, [pathname]);

  useEffect(() => {
    if (!supportsWebGL()) setStage({ webgl: false });
  }, []);

  const [worldStarted, setWorldStarted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setWorldStarted(true), 450);
    return () => window.clearTimeout(id);
  }, []);

  if (pathname.startsWith("/admin")) return <>{children}</>;

  const isIntro = sceneForPath(pathname) === "intro";

  return (
    <div data-leaving={leaving}>
      {worldStarted && webgl ? (
        <Experience />
      ) : (
        <div
          aria-hidden
          className="fixed inset-0 bg-cover bg-center"
          style={{
            backgroundImage: mounted && !webgl
              ? `url(/art/poster-${isIntro ? "intro" : "hall"}.webp)`
              : undefined,
          }}
        />
      )}

      {webgl && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[5] flex items-center justify-center bg-ink transition-opacity duration-[1400ms]"
          style={{ opacity: ready ? 0 : 1 }}
        >
          <div className="w-40">
            <p className="label mb-3 text-center text-muted">Entering orbit</p>
            <div className="h-px overflow-hidden bg-gold-faint">
              <div
                className="h-full bg-gold"
                style={{ animation: "loader 1.8s ease-in-out infinite" }}
              />
            </div>
          </div>
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[6] max-lg:hidden"
        style={{
          background:
            "linear-gradient(90deg, rgb(5 4 3 / 0.62), rgb(5 4 3 / 0.3) 22%, transparent 38%), linear-gradient(180deg, rgb(5 4 3 / 0.6), transparent 13%)",
        }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[6] bg-ink/45 lg:hidden" />
      <div className="edge-rail" aria-hidden />
      <Header />
      {children}
    </div>
  );
}
