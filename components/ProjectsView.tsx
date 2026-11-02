"use client";

import Image from "next/image";
import { projectFilters, projects } from "@/lib/content";
import { setStage, useStage } from "@/lib/stage";
import { External, Eyebrow, PageTitle, stagger } from "./ui";

function matching(filter: string) {
  return projects
    .map((project, index) => ({ project, index }))
    .filter(({ project }) => filter === "all" || project.categories.some((c) => c === filter))
    .map(({ index }) => index);
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden className="h-3.5 w-2">
      <path d={direction === "left" ? "M7 1 1 7l6 6" : "m1 1 6 6-6 6"} />
    </svg>
  );
}

export function ProjectsView() {
  const selected = useStage((s) => s.project);
  const filter = useStage((s) => s.filter);
  const project = projects[selected];
  const list = matching(filter);
  const position = Math.max(0, list.indexOf(selected));

  const step = (by: number) => {
    const next = list[(position + by + list.length) % list.length];
    setStage({ project: next });
  };

  const chooseFilter = (id: string) => {
    const options = matching(id);
    setStage({
      filter: id,
      project: options.includes(selected) ? selected : options[0],
    });
  };

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

      {/* Touch screens get the project list here; desktops can also click the 3D panels. */}
      <div className="mt-[46dvh] grid grid-cols-5 gap-2 lg:hidden">
        {projects.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.title}
            aria-current={selected === index}
            onClick={() => setStage({ project: index })}
            className={`relative aspect-[4/3] overflow-hidden border ${
              selected === index ? "border-gold" : "border-gold-faint opacity-60"
            }`}
          >
            <Image src={item.image} alt="" fill sizes="20vw" className="object-cover" />
          </button>
        ))}
      </div>

      <article
        className="hud-panel slide-left mt-3 flex flex-col p-5 lg:absolute lg:bottom-[1.4rem] lg:right-[var(--gutter)] lg:top-[5.5rem] lg:mt-0 lg:w-[20rem] lg:overflow-y-auto"
        style={stagger(4)}
        data-active="true"
        aria-live="polite"
      >
        <div className="flex items-center justify-between">
          <p className="label flex items-center gap-2 text-soft">
            <span className="size-1 rounded-full bg-gold" />
            {`0${position + 1} / 0${list.length}`}
          </p>
          <div className="flex gap-4 text-soft">
            <button type="button" aria-label="Previous project" onClick={() => step(-1)} className="cursor-pointer p-1 transition-colors hover:text-gold">
              <Chevron direction="left" />
            </button>
            <button type="button" aria-label="Next project" onClick={() => step(1)} className="cursor-pointer p-1 transition-colors hover:text-gold">
              <Chevron direction="right" />
            </button>
          </div>
        </div>

        <div className="relative mt-3 aspect-[16/8.8] shrink-0 overflow-hidden border border-gold-faint">
          <Image key={project.id} src={project.image} alt={`${project.title} preview`} fill sizes="(max-width: 1024px) 100vw, 22vw" className="object-cover" />
        </div>

        <h2 className="display mt-4 text-[1.32rem] leading-[1.2] text-gold">
          {project.headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>
        <p className="copy mt-2">{project.summary}</p>

        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Technologies">
          {project.tags.map((tag) => (
            <li key={tag} className="tag">
              {tag}
            </li>
          ))}
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-3">
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

        <div className="mt-4 border-t border-gold-faint pt-3">
          <h3 className="label flex items-center gap-2 text-soft">
            <span className="size-1 rounded-full bg-gold" /> Overview
          </h3>
          <p className="mt-2 pl-3 text-[0.76rem] leading-[1.6] tracking-wide text-soft">{project.overview}</p>
        </div>

        <div className="mt-3 border-t border-gold-faint pt-3">
          <h3 className="label flex items-center gap-2 text-soft">
            <span className="size-1 rounded-full bg-gold" /> Key Features
          </h3>
          <ul className="mt-2 flex list-inside list-disc flex-col gap-0.5 pl-3 text-[0.76rem] tracking-wide text-soft marker:text-gold">
            {project.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>

        {project.gallery.length > 1 && (
          <div className="mt-auto flex gap-2 pt-3">
            {project.gallery.map((src) => (
              <div key={src} className="relative aspect-[16/9] flex-1 overflow-hidden border border-gold-faint">
                <Image src={src} alt="" fill sizes="8vw" className="object-cover" />
              </div>
            ))}
          </div>
        )}
      </article>
    </main>
  );
}
