"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navItems } from "@/lib/content";
import { useStage } from "@/lib/stage";
import { TravelLink } from "./TravelLink";

const manilaTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function Clock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setTime(manilaTime.format(new Date()));
    update();
    const id = window.setInterval(update, 5000);
    return () => window.clearInterval(id);
  }, []);

  return <span className="tabular-nums">{time ?? "--:--"} PHT</span>;
}

export function Header() {
  const pathname = usePathname();
  const targetPath = useStage((s) => s.targetPath);

  return (
    <header className="site-header fixed inset-x-0 top-0 z-20 flex flex-wrap items-center gap-x-10 gap-y-2 px-[var(--gutter)] py-4 lg:h-[5.4rem] lg:flex-nowrap lg:py-0 lg:pl-[calc(var(--gutter)+1.5rem)] max-lg:bg-gradient-to-b max-lg:from-ink/90 max-lg:to-transparent">
      <TravelLink
        href="/"
        aria-label="ADRIAN.JS, back to the introduction"
        className="display text-[1.25rem] text-gold max-lg:py-2"
      >
        Adrian.js
        <span className="caret">_</span>
      </TravelLink>

      <nav aria-label="Main" className="flex gap-x-6 lg:gap-x-9 max-lg:order-3 max-lg:w-full max-lg:justify-between">
        {navItems.map((item, index) => {
          const active = (targetPath ?? pathname).startsWith(item.href);
          return (
            <TravelLink
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`label group relative flex gap-3 py-2 max-lg:py-2.5 transition-colors hover:text-text ${
                active ? "text-text" : "text-soft"
              }`}
            >
              <span className="max-lg:hidden text-muted">0{index + 1}</span>
              <span>{item.label}</span>
              <span
                className={`absolute inset-x-0 bottom-0 h-0.5 bg-gold transition-transform duration-300 lg:left-7 ${
                  active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </TravelLink>
          );
        })}
      </nav>

      <div className="label ml-auto flex items-center gap-4 text-soft max-sm:hidden">
        <span>Philippines</span>
        <span className="size-1 rounded-full bg-gold" />
        <Clock />
      </div>
    </header>
  );
}
