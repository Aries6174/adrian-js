"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { aboutSections, interests, journey, techStack } from "@/lib/content";
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
    <section id={id} data-active={active} className={`hud-panel slide-left scroll-mt-24 ${className}`} style={stagger(step)}>
      {children}
    </section>
  );
}

export function AboutView() {
  const section = useStage((s) => s.aboutSection);
  const firstRun = useRef(true);
  const sectionId = aboutSections[section].id;

  useEffect(() => {
    if (window.location.hash === "#skills") setStage({ aboutSection: 2 });
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
        <Panel id="intro" active={section === 0} step={2} className="grid gap-5 p-4 md:grid-cols-[1fr_16.5rem]">
          <div>
            <SectionLabel no="01">Who am I</SectionLabel>
            <h2 className="display mt-2.5 text-[1.25rem] leading-[1.28] text-gold">
              A developer who turns ideas into experiences.
            </h2>
            <p className="copy mt-2">
              I&apos;m Adrian, a Computer and Information Science graduate who
              enjoys building interactive and meaningful web experiences. I like
              combining technology, design, and storytelling to create projects
              that feel unique and engaging.
            </p>
          </div>
          <div className="border-gold-faint md:border-l md:pl-5">
            <div className="relative aspect-[16/7] overflow-hidden border border-gold-faint">
              <Image src="/art/world.webp" alt="A black hole over a dark sea, rendered in real time" fill sizes="(max-width: 768px) 100vw, 17vw" className="object-cover" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="label text-[0.66rem] leading-[1.5] text-soft">
                Somewhere between
                <br />
                code and the stars
              </p>
              <Arrow className="w-5 text-gold" />
            </div>
          </div>
        </Panel>

        <div className="grid gap-3 md:grid-cols-2">
          <Panel id="skills" active={section === 2} step={3} className="p-4">
            <SectionLabel no="02">Tech stack</SectionLabel>
            <ul className="mt-3 grid grid-cols-4 gap-x-2 gap-y-2.5">
              {techStack.map((tech) => (
                <li key={tech.name} className="group text-center">
                  <span className="mx-auto flex size-[3.1rem] items-center justify-center border border-gold-faint bg-black/25 text-gold transition-all group-hover:border-gold group-hover:shadow-[0_0_1rem_rgb(236_182_95_/_0.25)]">
                    <Icon name={tech.icon} className="size-6" />
                  </span>
                  <span className="mt-1 block text-[0.66rem] leading-tight tracking-wide text-soft">{tech.name}</span>
                  {"note" in tech && <span className="block text-[0.6rem] leading-tight text-muted">({tech.note})</span>}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel id="background" active={section === 1} step={4} className="p-4">
            <SectionLabel no="03">Education</SectionLabel>
            <div className="mt-3 flex gap-4">
              <div className="relative w-[7.2rem] shrink-0 overflow-hidden border border-gold-faint">
                <Image src="/art/campus.webp" alt="The Oblation statue at the University of the Philippines Visayas" fill sizes="10vw" className="object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-ink/80 px-1.5 py-1 text-[0.52rem] leading-snug tracking-wide text-soft">
                  Photo: Marcos Caratao Jr. / exploreiloilo.com
                </span>
              </div>
              <div className="min-w-0 py-1">
                <h3 className="display text-[0.92rem] tracking-[0.1em] text-text">BS Computer and Information Science</h3>
                <p className="mt-2 text-[0.72rem] leading-[1.6] tracking-wide text-soft">
                  University of the Philippines Visayas
                  <br />
                  Miagao, Iloilo
                  <br />
                  2022 - 2026
                </p>
                <span className="rule my-3" />
                <p className="text-[0.72rem] leading-[1.6] tracking-wide text-muted">
                  Senior High School (STEM)
                  <br />
                  University of the East Manila
                  <br />
                  2020 - 2022
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <Panel id="journey" active={section === 3} step={5} className="p-4">
          <SectionLabel no="04">Journey</SectionLabel>
          <ol className="relative mt-3 grid grid-cols-2 gap-y-4 sm:grid-cols-5">
            <span aria-hidden className="absolute inset-x-0 top-[0.27rem] hidden h-px bg-gold-line sm:block" />
            {journey.map((event) => (
              <li key={event.year} className="relative">
                <span className="relative block size-[0.55rem] rounded-full bg-gold shadow-[0_0_0.6rem_var(--gold)]" />
                <p className="display mt-2 text-[0.84rem] tracking-[0.12em] text-text">{event.year}</p>
                {event.lines.map((line) => (
                  <p key={line} className="text-[0.68rem] leading-[1.45] tracking-wide text-soft">
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel id="interests" active={section === 4} step={6} className="grid items-center gap-4 p-4 md:grid-cols-[1fr_15rem]">
          <div>
            <SectionLabel no="05">Interests</SectionLabel>
            <ul className="mt-3 flex justify-between gap-2">
              {interests.map((interest) => (
                <li key={interest.name} className="text-center text-gold">
                  <Icon name={interest.icon} className="mx-auto size-7" />
                  <span className="mt-1.5 block text-[0.68rem] tracking-wide text-soft">{interest.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <blockquote className="label border-gold-faint text-[0.72rem] leading-[1.75] text-soft md:border-l md:pl-5">
            &ldquo;Exploring worlds both real and imagined through technology.&rdquo;
            <span className="rule mt-2" />
          </blockquote>
        </Panel>
      </div>
    </main>
  );
}
