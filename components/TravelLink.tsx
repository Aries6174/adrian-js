"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { prepareScene, sceneForPath, travel } from "@/lib/stage";

/** A normal link that flies through the black hole on plain clicks. */
export function TravelLink({
  href,
  ...props
}: ComponentProps<typeof Link> & { href: string }) {
  return (
    <Link
      href={href}
      {...props}
      onPointerEnter={() => prepareScene(sceneForPath(href.split("#")[0]))}
      onNavigate={(event) => {
        event.preventDefault();
        travel(href);
      }}
    />
  );
}
