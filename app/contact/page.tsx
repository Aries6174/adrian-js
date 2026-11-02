import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { ContactForm } from "@/components/ContactForm";
import { ContactLinks } from "@/components/ContactLinks";
import { Eyebrow, FootNote, PageTitle, SectionLabel, stagger } from "@/components/ui";
import { loadContent } from "@/lib/store";
import { landDots, mapPoint } from "@/lib/worldmap";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Adrian Jaspa about opportunities, collaborations and interesting projects.",
};

const dots = landDots(5);

async function ContactPanels() {
  const { profile } = await loadContent();
  const [pinX, pinY] = mapPoint(profile.lon, profile.lat);
  return (
    <div className="mt-[30dvh] grid gap-3 lg:absolute lg:bottom-[1.4rem] lg:right-[var(--gutter)] lg:top-[5.2rem] lg:mt-0 lg:w-[39rem] lg:grid-cols-[1fr_10.5rem] lg:grid-rows-[1fr_auto]">
      <section className="hud-panel slide-left p-5 lg:overflow-y-auto" data-active="true" style={stagger(2)}>
        <SectionLabel no="01">Send a message</SectionLabel>
        <h2 className="display mt-3 text-[1.55rem] text-gold">
          Let&apos;s talk<span className="caret">_</span>
        </h2>
        <p className="copy mt-2">
          Have a question, opportunity, or just want to say hi? I&apos;d love
          to hear from you.
        </p>
        <ContactForm />
      </section>

      <aside className="hud-panel slide-left flex flex-col p-4 lg:row-span-1 lg:overflow-hidden" style={stagger(3)}>
        <div className="relative -mx-4 -mt-4 h-[7.8rem] shrink-0 overflow-hidden">
          <Image src="/art/world.webp" alt="" fill sizes="12vw" className="object-cover object-right" />
          <span className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
        </div>
        <ul className="label mt-3 text-[0.64rem] leading-[1.75] text-soft">
          {["Ideas", "Projects", "Jobs", "Collaborations", "Friendly chats"].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <span className="rule mt-2" />

        <div className="mt-auto border-t border-gold-faint pt-4">
          <SectionLabel no="02">Location</SectionLabel>
          <svg
            viewBox="0 0 100 42"
            role="img"
            aria-label={`Map with a marker on ${profile.city}, ${profile.country}`}
            className="mt-3 w-full text-soft"
          >
            {dots.map(([lon, lat]) => {
              const [x, y] = mapPoint(lon, lat);
              return <circle key={`${lon}:${lat}`} cx={x * 100} cy={y * 42} r="0.5" fill="currentColor" opacity="0.55" />;
            })}
            <circle cx={pinX * 100} cy={pinY * 42} r="3.4" fill="none" stroke="var(--gold)" strokeWidth="0.35" />
            <circle cx={pinX * 100} cy={pinY * 42} r="1.3" fill="var(--gold-bright)" />
          </svg>
          <p className="label mt-3 text-[0.66rem] leading-[1.6] text-text">
            {profile.city}
            <br />
            {profile.country}
          </p>
          <p className="mt-2 text-[0.68rem] leading-[1.5] tracking-widest text-soft">
            {Math.abs(profile.lat).toFixed(4)}° {profile.lat < 0 ? "S" : "N"}
            <br />
            {Math.abs(profile.lon).toFixed(4)}° {profile.lon < 0 ? "W" : "E"}
          </p>
        </div>
      </aside>

      <section className="hud-panel slide-left p-4" style={stagger(4)}>
        <SectionLabel no="03">Find me on</SectionLabel>
        <ContactLinks profile={profile} />
      </section>

      <aside className="hud-panel slide-left relative flex items-end overflow-hidden p-4 max-lg:hidden" style={stagger(5)}>
        <Image src="/art/world.webp" alt="" fill sizes="12vw" className="object-cover object-left opacity-55" />
        <span className="absolute inset-0 bg-gradient-to-t from-ink/90 to-transparent" />
        <blockquote className="label relative text-[0.64rem] leading-[1.7] text-text">
          &ldquo;Good ideas always find a way to connect.&rdquo;
          <span className="rule mt-2" />
        </blockquote>
      </aside>
    </div>
  );
}

export default function ContactPage() {
  return (
    <main className="page px-[var(--gutter)] pb-10 pt-32 lg:h-dvh lg:p-0">
      <section className="lg:absolute lg:left-[calc(var(--gutter)+1.5rem)] lg:top-[6.4rem] lg:w-[20rem]">
        <Eyebrow lines={["Let's", "Connect", "Across", "Worlds"]} />
        <span className="rule rise mt-2" style={stagger(0)} />
        <PageTitle size="clamp(2.4rem, 2.95rem, 12vw)">Contact</PageTitle>
        <span className="rule rise mt-4" style={stagger(2)} />
        <p className="label rise mt-5 leading-[1.7] text-soft" style={stagger(3)}>
          Open to opportunities,
          <br />
          collaborations, and
          <br />
          interesting projects.
        </p>
      </section>

      <FootNote lines={["Different", "Worlds", "Same", "Conversation"]} />

      <Suspense fallback={null}>
        <ContactPanels />
      </Suspense>
    </main>
  );
}
