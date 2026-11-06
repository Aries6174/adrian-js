"use client";

import { useEffect, useRef, useState } from "react";

/** Counts a number up from zero the first time it scrolls into view. Keeps any suffix, like the d in 12d. */
export function CountUp({ text }: { text: string }) {
  const match = /^([\d,]+)(.*)$/.exec(text);
  const target = match ? Number(match[1].replace(/,/g, "")) : 0;
  const suffix = match ? match[2] : "";
  const span = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!match || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / 1400);
        setShown(Math.round(target * (1 - Math.pow(1 - k, 3))));
        if (k < 1) frame = requestAnimationFrame(tick);
      };
      setShown(0);
      frame = requestAnimationFrame(tick);
    });
    if (span.current) observer.observe(span.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    // The text only changes when GitHub's numbers do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return <span ref={span}>{shown === null ? text : `${shown.toLocaleString("en-US")}${suffix}`}</span>;
}
