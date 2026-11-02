"use client";

import { useEffect } from "react";
import { pageHidden, pageShown } from "@/lib/stage";

/** Rendered with a page's content, so a page change can wait until there is something to show. */
export function PageReady({ path }: { path: string }) {
  useEffect(() => {
    pageShown(path);
    return () => pageHidden(path);
  }, [path]);
  return null;
}
