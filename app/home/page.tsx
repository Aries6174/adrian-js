import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { PageReady } from "@/components/PageReady";
import { TravelLink } from "@/components/TravelLink";
import { VisitorCounter } from "@/components/VisitorCounter";
import { Arrow, Eyebrow, Icon, PageTitle, stagger } from "@/components/ui";
import { inDisplayOrder } from "@/lib/content";
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
    <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
      {inDisplayOrder(projects).slice(0, 3).map((project, index) => (
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
            className={`${project.fit === "contain" ? "object-contain opacity-60 p-3" : "object-cover opacity-40"} transition-all duration-700 group-hover:scale-105 group-hover:opacity-80`}
            style={{ objectPosition: project.fit === "contain" ? "right center" : (project.imagePosition ?? "center") }}
          />
          <span className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/80 to-ink/20" />
          <span className="relative flex h-full flex-col justify-between p-3.5">
            <span className="label flex items-center gap-2 text-soft">
              0{index + 1} <span className="h-px w-4 bg-gold-line" />
            </span>
            <span>
              <span className="display block truncate pr-12 text-[1.08rem] text-text max-sm:text-[0.88rem] max-sm:tracking-[0.12em]">{project.title}</span>
              <span className="mt-0.5 block text-[0.72rem] tracking-wider text-soft">{project.tagline}</span>
              <span className="mt-1.5 flex gap-1.5">
                {project.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="border border-gold-faint px-1.5 py-px text-[0.56rem] uppercase tracking-widest text-soft max-lg:text-[0.66rem] max-lg:tracking-wider">
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

/** A small moving picture for each card: an orbit, a lattice of skills, a signal. */
function CardMotif({ kind }: { kind: (typeof infoCards)[number]["key"] }) {
  return (
    <svg
      viewBox="40 12 120 76"
      aria-hidden
      className="card-motif h-full w-full text-gold"
      fill="none"
      stroke="currentColor"
    >
      {kind === "about" && (
        <>
          <circle cx="104" cy="50" r="20" strokeWidth="1.2" />
          <circle cx="104" cy="44" r="6" fill="currentColor" stroke="none" />
          <path d="M92 64a12 10 0 0 1 24 0" fill="currentColor" stroke="none" />
          <ellipse
            cx="104"
            cy="50"
            rx="46"
            ry="13"
            strokeWidth="1.2"
            strokeDasharray="2 5"
            transform="rotate(-14 104 50)"
            className="motif-flow"
          />
          <circle cx="148" cy="39" r="2.6" fill="currentColor" stroke="none" />
        </>
      )}
      {kind === "skills" && (
        <>
          {[0, 1, 2, 3].map((col) =>
            [0, 1, 2].map((row) => (
              <rect
                key={`${col}-${row}`}
                x={70 + col * 20}
                y={22 + row * 20}
                width="12"
                height="12"
                strokeWidth="1"
                className="motif-blink"
                style={{ animationDelay: `${(col * 3 + row) * 0.37}s` }}
              />
            )),
          )}
          <path d="M60 30 46 52l14 22M140 30l14 22-14 22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {kind === "contact" && (
        <>
          {[10, 20, 30].map((r, index) => (
            <path
              key={r}
              d={`M${110 - r} 52a${r} ${r} 0 0 1 ${2 * r} 0`}
              strokeWidth="1.4"
              className="motif-pulse"
              style={{ animationDelay: `${index * 0.45}s` }}
            />
          ))}
          <path d="M88 58h44v26H88zM88 58l22 15 22-15" strokeWidth="1.6" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

async function InfoCards() {
  const { home } = await loadContent();
  return (
    <section className="hud-panel rise mt-3 grid divide-gold-faint lg:mt-4 lg:grid-cols-3 lg:divide-x" style={stagger(6)}>
      {infoCards.map((card, index) => (
        // Icon, then words with the link pinned to the bottom so all three cards line up,
        // then the moving picture in its own small screen. The screen is left out where the
        // card is too narrow for it: phones, and three-across on smaller laptops.
        <div key={card.key} className="info-card group relative flex gap-4 overflow-hidden p-3 lg:px-5">
          <span aria-hidden className="info-sweep" style={{ animationDelay: `${index * 1.4}s` }} />
          <Icon name={card.icon} className="relative mt-0.5 size-8 shrink-0 text-gold transition-transform duration-300 group-hover:-translate-y-0.5" />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <h2 className="label text-text">
              <span className="mr-2 text-muted">0{index + 1}</span>
              {card.title}
            </h2>
            <p className="mt-1 text-[0.72rem] leading-[1.5] tracking-wide text-soft">{home[card.key]}</p>
            <TravelLink href={card.href} className="label mt-auto flex w-max items-center gap-2 pt-2 text-[0.62rem] text-gold max-lg:py-2.5 max-lg:text-[0.7rem] transition-colors hover:text-gold-bright">
              {card.cta} <Arrow className="w-4" />
            </TravelLink>
          </div>
          <div aria-hidden className="motif-frame relative hidden h-[4.2rem] w-[6.6rem] shrink-0 self-center sm:block lg:hidden xl:block">
            <CardMotif kind={card.key} />
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
        <VisitorCounter className="mt-6" />
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
            <TravelLink href="/projects" className="label ml-auto flex items-center gap-2 text-[0.64rem] text-soft max-lg:py-2.5 transition-colors hover:text-gold">
              View all projects <Arrow className="w-4" />
            </TravelLink>
          </div>
          <Suspense fallback={<div className="h-[7.6rem]" />}>
            <FeaturedProjects />
            <PageReady path="/home" />
          </Suspense>
        </section>

        <Suspense fallback={<div className="mt-3 h-[6.1rem] lg:mt-4" />}>
          <InfoCards />
        </Suspense>
        <VisitorCounter className="ml-auto mt-4 max-w-sm lg:hidden" />
      </div>
    </main>
  );
}
