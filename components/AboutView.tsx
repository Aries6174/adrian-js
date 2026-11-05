"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { type About, aboutSections, SKILLS_SECTION } from "@/lib/content";
import { setStage, useStage } from "@/lib/stage";
import { Arrow, Eyebrow, FootNote, Icon, PageTitle, SectionLabel, stagger } from "./ui";

function Panel({
  id,
  active,
  step,
  className = "",
  children,
}: {
  id: string;
  active: boolean;
  step: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} data-active={active} className={`hud-panel about-panel slide-left scroll-mt-24 ${className}`} style={stagger(step)}>
      {children}
    </section>
  );
}

export function AboutView({ about, github }: { about: About; github: ReactNode }) {
  const section = useStage((s) => s.aboutSection);
  const firstRun = useRef(true);
  const sectionId = aboutSections[section].id;

  useEffect(() => {
    if (window.location.hash === "#skills") setStage({ aboutSection: SKILLS_SECTION });
  }, []);

  // Bring the chosen panel into view, but leave the page alone when it first appears.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [sectionId]);

  return (
    <main className="page px-[var(--gutter)] pb-10 pt-32 lg:h-dvh lg:p-0">
      <section className="lg:absolute lg:left-[calc(var(--gutter)+1.5rem)] lg:top-[6.4rem] lg:w-[18rem]">
        <Eyebrow lines={["Developer", "Creative Thinker", "Interactive Experiences"]} />
        <PageTitle accent="Me" size="clamp(2.4rem, 2.95rem, 12vw)">
          About{" "}
        </PageTitle>
        <span className="rule rise mt-5" style={stagger(2)} />
        <nav aria-label="About sections" className="rise mt-5 flex flex-wrap gap-x-6 lg:block" style={stagger(3)}>
          {aboutSections.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-active={section === index}
              aria-current={section === index}
              onClick={() => setStage({ aboutSection: index })}
              className="side-item w-max"
            >
              <span className={section === index ? "" : "text-muted"}>0{index + 1}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      <FootNote lines={["Exploring", "Ideas", "Through", "Technology_"]} />

      <div
        className="mt-[34dvh] flex flex-col gap-3 lg:absolute lg:bottom-[2rem] lg:right-[var(--gutter)] lg:top-[5.5rem] lg:mt-0 lg:w-[43rem] lg:gap-3 lg:overflow-y-auto"
      >
        <Panel id="github" active={section === 0} step={2} className="p-4">
          <SectionLabel no="01">GitHub progress</SectionLabel>
          {github}
        </Panel>

        <Panel id="intro" active={section === 1} step={3} className="grid gap-5 p-4 md:grid-cols-[1fr_16.5rem]">
          <div>
            <SectionLabel no="02">Who am I</SectionLabel>
            <h2 className="display mt-2.5 text-[1.25rem] leading-[1.28] text-gold">
              {about.heading}
            </h2>
            <p className="copy mt-2">{about.body}</p>
          </div>
          <div className="border-gold-faint md:border-l md:pl-5">
            <div className="relative aspect-[16/7] overflow-hidden border border-gold-faint">
              <Image src={about.image} alt={about.imageAlt} fill sizes="(max-width: 768px) 100vw, 17vw" className="object-cover" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="label text-[0.66rem] leading-[1.5] text-soft">
                {about.caption.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
              <Arrow className="w-5 text-gold" />
            </div>
          </div>
        </Panel>

        <div className="grid gap-3 md:grid-cols-2">
          <Panel id="background" active={section === 2} step={4} className="p-4">
            <SectionLabel no="03">Education</SectionLabel>
            <div className="mt-3 flex gap-4">
              <div className="relative w-[7.2rem] shrink-0 overflow-hidden border border-gold-faint">
                <Image src={about.education.image} alt={about.education.imageAlt} fill sizes="10vw" className="object-cover" />
                {about.education.credit &&
                  (about.education.creditLink ? (
                    <a
                      href={about.education.creditLink}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-x-0 bottom-0 bg-ink/80 px-1.5 py-1 text-[0.52rem] leading-snug tracking-wide text-soft underline hover:text-gold"
                    >
                      {about.education.credit}
                    </a>
                  ) : (
                    <span className="absolute inset-x-0 bottom-0 bg-ink/80 px-1.5 py-1 text-[0.52rem] leading-snug tracking-wide text-soft">
                      {about.education.credit}
                    </span>
                  ))}
              </div>
              <div className="min-w-0 py-1">
                <h3 className="display text-[0.92rem] tracking-[0.1em] text-text">{about.education.degree}</h3>
                <p className="mt-2 text-[0.72rem] leading-[1.6] tracking-wide text-soft">
                  {about.education.school}
                  <br />
                  {about.education.place}
                  <br />
                  {about.education.years}
                </p>
                <span className="rule my-3" />
                <p className="text-[0.72rem] leading-[1.6] tracking-wide text-muted">
                  {about.education.earlierTitle}
                  <br />
                  {about.education.earlierSchool}
                  <br />
                  {about.education.earlierYears}
                </p>
              </div>
            </div>
          </Panel>

          <Panel id="skills" active={section === 3} step={5} className="p-4">
            <SectionLabel no="04">Tech stack</SectionLabel>
            <ul className="mt-3 grid grid-cols-4 gap-x-2 gap-y-2.5">
              {about.techStack.map((tech) => (
                <li key={tech.name} className="group text-center">
                  <span className="mx-auto flex size-[3.1rem] items-center justify-center border border-gold-faint bg-black/25 text-gold transition-all group-hover:border-gold group-hover:shadow-[0_0_1rem_rgb(236_182_95_/_0.25)]">
                    <Icon name={tech.icon} className="size-6" />
                  </span>
                  <span className="mt-1 block text-[0.66rem] leading-tight tracking-wide text-soft">{tech.name}</span>
                  {tech.note && <span className="block text-[0.6rem] leading-tight text-muted">({tech.note})</span>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel id="journey" active={section === 4} step={6} className="p-4">
          <SectionLabel no="05">Journey</SectionLabel>
          <ol
            className="relative mt-3 grid grid-cols-2 gap-y-4 sm:[grid-template-columns:repeat(var(--steps),minmax(0,1fr))]"
            style={{ "--steps": Math.max(1, about.journey.length) } as CSSProperties}
          >
            <span aria-hidden className="absolute inset-x-0 top-[0.27rem] hidden h-px bg-gold-line sm:block" />
            {about.journey.map((event, index) => (
              <li key={index} className="relative">
                <span className="relative block size-[0.55rem] rounded-full bg-gold shadow-[0_0_0.6rem_var(--gold)]" />
                <p className="display mt-2 text-[0.84rem] tracking-[0.12em] text-text">{event.year}</p>
                {event.lines.map((line, lineIndex) => (
                  <p key={lineIndex} className="text-[0.68rem] leading-[1.45] tracking-wide text-soft">
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel id="interests" active={section === 5} step={7} className="grid items-center gap-4 p-4 md:grid-cols-[1fr_15rem]">
          <div>
            <SectionLabel no="06">Interests</SectionLabel>
            <ul className="mt-3 flex justify-between gap-2">
              {about.interests.map((interest) => (
                <li key={interest.name} className="text-center text-gold">
                  <Icon name={interest.icon} className="mx-auto size-7" />
                  <span className="mt-1.5 block text-[0.68rem] tracking-wide text-soft">{interest.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <blockquote className="label border-gold-faint text-[0.72rem] leading-[1.75] text-soft md:border-l md:pl-5">
            &ldquo;{about.quote}&rdquo;
            <span className="rule mt-2" />
          </blockquote>
        </Panel>
      </div>
    </main>
  );
}
