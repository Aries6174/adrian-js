"use client";

import { useEffect, useState } from "react";
import { type VisitStats, VISIT_HOURS, visitStats } from "@/lib/visits";

/** All-time visitors, with a small bar for each of the last hours. */
export function VisitorCounter({ className = "" }: { className?: string }) {
  const [stats, setStats] = useState<VisitStats | null>(null);

  useEffect(() => {
    let current = true;
    visitStats().then((value) => {
      if (current) setStats(value);
    });
    return () => {
      current = false;
    };
  }, []);

  if (!stats) return null;
  const busiest = Math.max(1, ...stats.hours);

  return (
    <div className={`visitor-counter ${className}`} data-visitors={stats.total}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="label text-[0.6rem] text-muted">Visitors · {VISIT_HOURS}h</p>
        <p className="display text-[0.95rem] tracking-[0.06em] text-gold">{stats.total.toLocaleString("en-US")}</p>
      </div>
      <div className="mt-1.5 flex h-6 items-end gap-px" aria-hidden>
        {stats.hours.map((count, index) => (
          <span
            key={index}
            className={`min-h-px flex-1 ${count > 0 ? "bg-gold" : "bg-gold-faint"}`}
            style={{ height: `${(count / busiest) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
