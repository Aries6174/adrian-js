import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { TravelLink } from "@/components/TravelLink";
import { Arrow, Eyebrow, Icon, PageTitle, stagger } from "@/components/ui";
import { newestFirst } from "@/lib/content";
import { loadContent } from "@/lib/store";

export const metadata: Metadata = { title: "The Cosmic Archive" };

const systemIndex = [
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Skills", href: "/about#skills" },
  { label: "Contact", href: "/contact" },
];

const infoCards = [
  { key: "about", title: "About Me", icon: "world", cta: "Learn More", href: "/about" },
  { key: "skills", title: "Skills", icon: "code", cta: "View Skills", href: "/about#skills" },
  { key: "contact", title: "Get in Touch", icon: "mail", cta: "Let's Talk", href: "/contact" },
] as const;

async function FeaturedProjects() {
  const { projects } = await loadContent();
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:gap-4">
      {newestFirst(projects).slice(0, 3).map((project, index) => (
        <TravelLink
          key={project.id}
          href="/projects"
          className="hud-panel group relative block h-[7.6rem] overflow-hidden"
        >
          <Image
            src={project.image}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className={`${project.fit === "contain" ? "object-contain opacity-90" : "object-cover opacity-50"} transition-all duration-700 group-hover:scale-105 group-hover:opacity-80`}
            style={{ objectPosition: project.imagePosition ?? "center" }}
          />
          <span className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/70 to-transparent" />
          <span className="relative flex h-full flex-col justify-between p-3.5">
            <span className="label flex items-center gap-2 text-soft">
              0{index + 1} <span className="h-px w-4 bg-gold-line" />
            </span>
            <span>
              <span className="display block text-[1.08rem] text-text">{project.headline[0]}</span>
              <span className="mt-0.5 block text-[0.72rem] tracking-wider text-soft">{project.tagline}</span>
              <span className="mt-1.5 flex gap-1.5">
                {project.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="border border-gold-faint px-1.5 py-px text-[0.56rem] uppercase tracking-widest text-soft">
                    {tag}
                  </span>
                ))}
              </span>
            </span>
          </span>
          <span className="absolute bottom-3.5 right-3.5 flex size-9 items-center justify-center rounded-full border border-gold-line bg-ink/80 text-gold transition-colors group-hover:bg-gold group-hover:text-ink">
            <Arrow className="w-3.5" />
          </span>
        </TravelLink>
      ))}
    </div>
  );
}

async function InfoCards() {
  const { home } = await loadContent();
  return (
    <section className="hud-panel rise mt-3 grid divide-gold-faint md:grid-cols-3 md:divide-x lg:mt-4" style={stagger(6)}>
      {infoCards.map((card) => (
        <div key={card.key} className="flex gap-4 p-3 lg:px-5">
          <Icon name={card.icon} className="mt-0.5 size-8 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <h2 className="label text-text">{card.title}</h2>
            <p className="mt-1 text-[0.72rem] leading-[1.5] tracking-wide text-soft">{home[card.key]}</p>
            <TravelLink href={card.href} className="label mt-0.5 flex items-center justify-end gap-2 text-[0.62rem] text-gold transition-colors hover:text-gold-bright">
              {card.cta} <Arrow className="w-4" />
            </TravelLink>
          </div>
        </div>
      ))}
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="page px-[var(--gutter)] pb-10 pt-32 lg:h-dvh lg:p-0">
      <section className="lg:absolute lg:left-[calc(var(--gutter)+1.5rem)] lg:top-[6.6rem] lg:w-[25rem]">
        <Eyebrow lines={["Developer", "Creative Thinker", "Interactive Experiences"]} />
        <PageTitle accent=".JS" size="clamp(2.8rem, 3.6rem, 12vw)">
          Adrian
        </PageTitle>
        <p className="label rise mt-2 tracking-[0.5em] text-soft" style={stagger(2)}>
          The Cosmic Archive
        </p>
        <span className="rule rise mt-4" style={stagger(3)} />
        <p className="copy rise mt-4 max-w-[20rem]" style={stagger(4)}>
          A collection of ideas, code and experiences from across the digital
          universe. Exploring the intersection of technology, design and
          imagination.
        </p>
        <TravelLink href="/projects" className="group rise mt-5 inline-flex items-center gap-4" style={stagger(5)}>
          <span className="flex size-[2.9rem] items-center justify-center rounded-full border border-gold-line text-gold transition-all duration-300 group-hover:border-gold-bright group-hover:shadow-[0_0_1.4rem_rgb(236_182_95_/_0.5)]">
            <span className="block h-px w-3.5 bg-current transition-all duration-300 group-hover:w-5" />
          </span>
          <span className="label leading-[1.5] text-text">
            <span className="block">Explore</span>
            <span className="block text-soft">The Archive</span>
          </span>
        </TravelLink>
      </section>

      <aside className="slide-left hidden lg:absolute lg:right-[var(--gutter)] lg:top-[6.4rem] lg:block lg:w-[9.5rem]" style={stagger(4)}>
        <p className="label border-l border-gold-faint pl-5 text-soft">System Index</p>
        <nav aria-label="System index" className="mt-3 flex flex-col border-l border-gold-faint">
          {systemIndex.map((item, index) => (
            <TravelLink
              key={item.label}
              href={item.href}
              className="label flex gap-4 py-[0.42rem] pl-5 text-soft transition-all hover:translate-x-1 hover:text-gold"
            >
              <span className="text-muted">0{index + 1}</span>
              {item.label}
            </TravelLink>
          ))}
        </nav>
        <blockquote className="serif-quote mt-8 text-[1.15rem]">
          &ldquo;Turning ideas into interactive realities.&rdquo;
        </blockquote>
        <span className="rule mt-3" />
      </aside>

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 hidden h-[22rem] bg-gradient-to-t from-ink via-ink/70 to-transparent lg:block"
      />
      <div className="mt-10 lg:absolute lg:inset-x-[3.6rem] lg:bottom-[1.3rem] lg:mt-0">
        <section aria-labelledby="featured" className="rise" style={stagger(5)}>
          <div className="mb-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
            <h2 id="featured" className="label text-[0.84rem] text-gold">
              Featured Projects
            </h2>
            <span className="hidden h-px w-14 bg-gold-line lg:block" />
            <p className="label hidden text-[0.6rem] text-muted lg:block">Selected records from the archive</p>
            <TravelLink href="/projects" className="label ml-auto flex items-center gap-2 text-[0.64rem] text-soft transition-colors hover:text-gold">
              View all projects <Arrow className="w-4" />
            </TravelLink>
          </div>
          <Suspense fallback={<div className="h-[7.6rem]" />}>
            <FeaturedProjects />
          </Suspense>
        </section>

        <Suspense fallback={<div className="mt-3 h-[6.1rem] lg:mt-4" />}>
          <InfoCards />
        </Suspense>
      </div>
    </main>
  );
}
