import { TravelLink } from "@/components/TravelLink";
import { Eyebrow, FootNote, PageTitle, stagger } from "@/components/ui";

export default function IntroPage() {
  return (
    <main className="page flex flex-col justify-end px-[var(--gutter)] pb-14 pt-32 lg:block lg:h-dvh lg:p-0">
      <section className="lg:absolute lg:left-[calc(var(--gutter)+1.5rem)] lg:top-[8.2rem] lg:w-[30rem]">
        <Eyebrow lines={["Developer", "Creative Thinker", "Interactive Experiences"]} />
        <PageTitle accent=".JS" size="clamp(2.8rem, 4.5rem, 12vw)">
          Adrian
        </PageTitle>
        <p className="label rise mt-3 tracking-[0.46em] text-soft" style={stagger(2)}>
          Into the Event Horizon
        </p>
        <span className="rule rise mt-6" style={stagger(3)} />
        <p className="copy rise mt-6 max-w-[24rem]" style={stagger(4)}>
          Beyond this edge is an archive of ideas, code and experiences from
          across the digital universe. Step closer when you are ready.
        </p>
        <TravelLink
          href="/home"
          className="group rise mt-9 inline-flex items-center gap-5"
          style={stagger(5)}
        >
          <span className="flex size-[3.4rem] items-center justify-center rounded-full border border-gold-line text-gold transition-all duration-300 group-hover:scale-110 group-hover:border-gold-bright group-hover:shadow-[0_0_1.6rem_rgb(236_182_95_/_0.5)]">
            <span className="block h-px w-4 bg-current transition-all duration-300 group-hover:w-6" />
          </span>
          <span className="label leading-[1.5] text-text">
            <span className="block">Explore</span>
            <span className="block text-soft">The Archive</span>
          </span>
        </TravelLink>
      </section>

      <blockquote
        className="serif-quote slide-left hidden text-[1.15rem] lg:absolute lg:bottom-[2.6rem] lg:right-[var(--gutter)] lg:block lg:w-[14rem] lg:text-right"
        style={stagger(7)}
      >
        &ldquo;Somewhere between code and the stars.&rdquo;
      </blockquote>

      <FootNote lines={["Exploring", "Ideas", "Through", "Technology_"]} />
    </main>
  );
}
