import { TravelLink } from "@/components/TravelLink";
import { PageTitle } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="page flex flex-col justify-center px-[var(--gutter)] lg:pl-[calc(var(--gutter)+1.5rem)]">
      <p className="label text-soft">Signal lost</p>
      <PageTitle size="clamp(2.4rem, 3rem, 12vw)">Off the map</PageTitle>
      <p className="copy mt-4 max-w-sm">
        This part of the archive has drifted past the event horizon.
      </p>
      <TravelLink href="/home" className="btn mt-6 w-max" data-solid="true">
        Back to the archive
      </TravelLink>
    </main>
  );
}
