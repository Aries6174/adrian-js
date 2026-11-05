"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { type Project, projectFilters } from "@/lib/content";
import { getStage, PROJECTS_IN_VIEW, setStage, useStage } from "@/lib/stage";
import { External, Eyebrow, PageTitle, stagger } from "./ui";

function matching(projects: Project[], filter: string) {
  return projects.filter(
    (project) => filter === "all" || project.categories.some((category) => category === filter),
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden className="h-3.5 w-2">
      <path d={direction === "left" ? "M7 1 1 7l6 6" : "m1 1 6 6-6 6"} />
    </svg>
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Position in the build-in sequence, which sets how long a piece waits to appear. */
function order(index: number) {
  return { "--i": index } as CSSProperties;
}

export function ProjectsView({ projects }: { projects: Project[] }) {
  const selectedId = useStage((s) => s.projectId);
  const filter = useStage((s) => s.filter);
  const scroll = useStage((s) => s.projectScroll);
  const strip = useRef<HTMLDivElement>(null);
  const details = useRef<HTMLElement>(null);
  // On arrival the details wait for their panel to slide in. After that they start at once.
  const [arrived, setArrived] = useState(false);

  const list = matching(projects, filter);
  const position = Math.max(0, list.findIndex((item) => item.id === selectedId));
  const project = list[position];
  const maxScroll = Math.max(0, list.length - PROJECTS_IN_VIEW);
  const canScroll = maxScroll > 0;
  const start = Math.min(scroll, maxScroll);

  // Selecting a project off to one side brings it into the 3D view.
  const select = (index: number) => {
    const item = list[index];
    if (!item) return;
    let next = start;
    if (index < next) next = index;
    if (index >= next + PROJECTS_IN_VIEW) next = index - PROJECTS_IN_VIEW + 1;
    setStage({ projectId: item.id, projectScroll: next });
  };

  const step = (by: number) => select((position + by + list.length) % list.length);

  const moveView = (by: number) => {
    setStage({ projectScroll: Math.max(0, Math.min(maxScroll, start + by)) });
  };

  const chooseFilter = (id: string) => {
    const options = matching(projects, id);
    const index = Math.max(0, options.findIndex((item) => item.id === selectedId));
    setStage({
      filter: id,
      projectId: options[index]?.id ?? null,
      projectScroll: Math.max(0, Math.min(index, options.length - PROJECTS_IN_VIEW)),
    });
  };

  useEffect(() => {
    const id = window.setTimeout(() => setArrived(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    details.current?.scrollTo({ top: 0 });
  }, [project?.id]);

  // Clicking a 3D panel can select a project that is not yet visible in the strip.
  useEffect(() => {
    const box = strip.current;
    const button = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!box || !button) return;
    const left = button.offsetLeft - box.offsetLeft;
    const right = left + button.offsetWidth;
    if (left < box.scrollLeft) box.scrollTo({ left, behavior: "smooth" });
    else if (right > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: right - box.clientWidth, behavior: "smooth" });
    }
  }, [position, list.length]);

  // The mouse wheel moves through the 3D panels, except over panels that scroll themselves.
  useEffect(() => {
    if (!canScroll) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    let built = 0;
    const onWheel = (event: WheelEvent) => {
      if (!wide.matches || (event.target as Element).closest?.("article, [data-strip]")) return;
      built += event.deltaY + event.deltaX;
      if (Math.abs(built) < 60) return;
      const by = Math.sign(built);
      built = 0;
      const current = getStage().projectScroll;
      setStage({ projectScroll: Math.max(0, Math.min(maxScroll, current + by)) });
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [canScroll, maxScroll]);

  return (
    <main className="page px-[var(--gutter)] pb-10 pt-32 lg:h-dvh lg:p-0">
      <section className="lg:absolute lg:left-[calc(var(--gutter)+1.5rem)] lg:top-[6.4rem] lg:w-[18rem]">
        <Eyebrow lines={["Projects", "Ideas", "Code", "Real-World", "Applications"]} />
        <span className="rule rise mt-2" style={stagger(0)} />
        <PageTitle size="clamp(2.4rem, 2.95rem, 12vw)" step={1}>
          Projects
        </PageTitle>
        <p className="label rise mt-2 text-text" style={stagger(2)}>
          Worlds built through code
        </p>
        <span className="rule rise mt-4" style={stagger(3)} />
        <p className="copy rise mt-4 max-w-[12.5rem]" style={stagger(4)}>
          A collection of projects that explore technology, design, and
          interactive experiences.
        </p>

        <nav
          aria-label="Filter projects"
          className="rise mt-6 flex flex-wrap gap-x-6 lg:block"
          style={stagger(5)}
        >
          {projectFilters.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              data-active={filter === item.id}
              onClick={() => chooseFilter(item.id)}
              className="side-item w-max gap-4"
            >
              <span className={filter === item.id ? "" : "text-muted"}>0{index + 1}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      <blockquote className="serif-quote rise hidden text-[1.1rem] lg:absolute lg:bottom-[2.2rem] lg:left-[calc(var(--gutter)+1.5rem)] lg:block lg:w-[9rem]" style={stagger(7)}>
        &ldquo;Ideas turn into real experiences here.&rdquo;
      </blockquote>

      {/* Always on touch screens. On desktops it appears once there are more panels than fit. */}
      <section
        data-strip
        aria-label="All projects"
        className={`hud-panel mt-5 p-2 lg:absolute lg:bottom-[1.4rem] lg:left-[calc(var(--gutter)+12rem)] lg:right-[calc(var(--gutter)+21rem)] lg:mt-0 ${
          canScroll ? "" : "lg:hidden"
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="label text-[0.6rem] text-soft">
            {canScroll
              ? `Showing ${start + 1}-${Math.min(start + PROJECTS_IN_VIEW, list.length)} of ${list.length}`
              : `${list.length} ${list.length === 1 ? "project" : "projects"}`}
            <span className="ml-3 text-muted max-lg:hidden">Scroll to browse</span>
          </p>
          {canScroll && (
            <div className="flex gap-3 text-soft max-lg:hidden">
              <button type="button" aria-label="Show earlier projects" disabled={start === 0} onClick={() => moveView(-1)} className="cursor-pointer p-1 transition-colors hover:text-gold disabled:cursor-default disabled:opacity-30">
                <Chevron direction="left" />
              </button>
              <button type="button" aria-label="Show later projects" disabled={start === maxScroll} onClick={() => moveView(1)} className="cursor-pointer p-1 transition-colors hover:text-gold disabled:cursor-default disabled:opacity-30">
                <Chevron direction="right" />
              </button>
            </div>
          )}
        </div>
        <div ref={strip} className="relative flex gap-1.5 overflow-x-auto pb-1">
          {list.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.title}
              aria-current={index === position}
              title={item.title}
              onClick={() => select(index)}
              className={`relative aspect-[3/2] w-[4.6rem] shrink-0 cursor-pointer overflow-hidden border transition-opacity ${
                index === position ? "border-gold-bright" : "border-gold-faint opacity-65 hover:opacity-100"
              }`}
            >
              <Image src={item.image} alt="" fill sizes="96px" className={item.fit === "contain" ? "object-contain" : "object-cover"} />
            </button>
          ))}
        </div>
      </section>

      <article
        className="hud-panel slide-left mt-3 flex flex-col p-5 lg:absolute lg:bottom-[1.4rem] lg:right-[var(--gutter)] lg:top-[5.5rem] lg:mt-0 lg:w-[20rem] lg:overflow-y-auto"
        ref={details}
        style={{ ...stagger(4), "--reveal-wait": arrived ? "0ms" : "700ms" } as CSSProperties}
        data-active="true"
        aria-live="polite"
      >
        {!project ? (
          <p className="copy my-auto text-center">No projects in this category yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="label flex items-center gap-2 text-soft">
                <span className="size-1 rounded-full bg-gold" />
                {`${pad(position + 1)} / ${pad(list.length)}`}
              </p>
              <div className="flex gap-4 text-soft">
                <button type="button" aria-label="Previous project" onClick={() => step(-1)} className="cursor-pointer p-1 max-lg:-my-2 max-lg:p-3 transition-colors hover:text-gold">
                  <Chevron direction="left" />
                </button>
                <button type="button" aria-label="Next project" onClick={() => step(1)} className="cursor-pointer p-1 max-lg:-my-2 max-lg:p-3 transition-colors hover:text-gold">
                  <Chevron direction="right" />
                </button>
              </div>
            </div>

            {/* A new key restarts every animation inside when the project changes. */}
            <div key={project.id} className="contents">
            <div className="detail-gallery mt-3 flex aspect-[16/7.6] shrink-0 gap-1">
              {project.gallery.map((src, index) => (
                <div
                  key={src}
                  className={`detail-wipe relative overflow-hidden border border-gold-faint ${index === 0 ? "flex-[3]" : "flex-[2]"}`}
                  style={order(index)}
                >
                  <Image
                    src={src}
                    alt={index === 0 ? `${project.title} preview` : `${project.title} image ${index + 1}`}
                    fill
                    sizes="(max-width: 1024px) 60vw, 14vw"
                    className={`detail-image ${project.fit === "contain" ? "object-contain" : "object-cover"}`}
                  />
                </div>
              ))}
              <span aria-hidden className="detail-scan" />
            </div>
            {project.credit && (
              <p className="detail-in mt-1 text-[0.56rem] leading-snug tracking-wide text-muted" style={order(3)}>{project.credit}</p>
            )}

            <h2 className="display mt-4 text-[1.32rem] leading-[1.2] text-gold">
              {project.headline.map((line, index) => (
                <span key={line} className="block overflow-hidden">
                  <span className="detail-line block" style={order(3 + index)}>
                    {line}
                  </span>
                </span>
              ))}
            </h2>
            <p className="detail-in copy mt-2" style={order(5)}>{project.summary}</p>

            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Technologies">
              {project.tags.map((tag, index) => (
                <li key={tag} className="detail-pop tag" style={order(6 + index * 0.5)}>
                  {tag}
                </li>
              ))}
            </ul>

            <div className="detail-in mt-4 grid grid-cols-2 gap-3" style={order(8)}>
              {project.live ? (
                <a className="btn" data-solid="true" href={project.live} target="_blank" rel="noreferrer">
                  View Live <External />
                </a>
              ) : (
                <span className="label flex items-center justify-center border border-gold-faint px-2 text-center text-[0.62rem] text-muted">
                  Demo on request
                </span>
              )}
              {project.github && (
                <a className="btn" href={project.github} target="_blank" rel="noreferrer">
                  GitHub <External />
                </a>
              )}
            </div>

            {project.overview && (
              <div className="detail-in mt-4 border-t border-gold-faint pt-3" style={order(9)}>
                <h3 className="label flex items-center gap-2 text-soft">
                  <span className="size-1 rounded-full bg-gold" /> Overview
                </h3>
                <p className="mt-2 pl-3 text-[0.76rem] leading-[1.6] tracking-wide text-soft">{project.overview}</p>
              </div>
            )}

            {project.features.length > 0 && (
              <div className="detail-in mt-3 border-t border-gold-faint pt-3" style={order(10)}>
                <h3 className="label flex items-center gap-2 text-soft">
                  <span className="size-1 rounded-full bg-gold" /> Key Features
                </h3>
                <ul className="mt-2 flex list-inside list-disc flex-col gap-0.5 pl-3 text-[0.76rem] tracking-wide text-soft marker:text-gold">
                  {project.features.map((feature, index) => (
                    <li key={feature} className="detail-in" style={order(10.5 + index * 0.5)}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
            </div>
          </>
        )}
      </article>
    </main>
  );
}
