import type { CSSProperties } from "react";
import type { GithubDay, GithubStats } from "@/lib/github";
import { CountUp } from "./CountUp";
import { External } from "./ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""];
const LEVELS = [0, 1, 2, 3, 4];

/** Dates only, so no time zone can move them to the day before. */
function parts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

function longDate(date: string) {
  const { year, month, day } = parts(date);
  return `${MONTHS[month]} ${day}, ${year}`;
}

function describe(day: GithubDay) {
  const label = day.count === 1 ? "contribution" : "contributions";
  return `${day.count === 0 ? "No" : day.count} ${label} on ${longDate(day.date)}`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l border-gold-faint pl-3">
      <p className="display text-[1rem] leading-tight tracking-[0.08em] text-gold">
        <CountUp text={value} />
      </p>
      <p className="mt-0.5 text-[0.62rem] leading-tight tracking-wide text-muted">{label}</p>
    </div>
  );
}

/** One cell per day: a column for each week and a row for each weekday, as on a GitHub profile. */
function Calendar({ days }: { days: GithubDay[] }) {
  const offset = parts(days[0].date).weekday;
  const placed = days.map((day, index) => ({ day, week: Math.floor((index + offset) / 7), row: parts(day.date).weekday }));
  const weeks = placed[placed.length - 1].week + 1;

  const months: { label: string; week: number }[] = [];
  placed.forEach(({ day, week }) => {
    const { month, day: date } = parts(day.date);
    if (date === 1 && week < weeks - 1) months.push({ label: MONTHS[month], week });
  });

  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="relative grid min-w-[34rem] gap-[2px]"
        style={{ gridTemplateColumns: `1.6rem repeat(${weeks}, minmax(0, 1fr))` }}
        role="img"
        aria-label="Contributions per day over the last year"
      >
        {months.map(({ label, week }) => (
          <span key={`${label}-${week}`} className="text-[0.58rem] leading-none tracking-wide text-muted" style={{ gridColumn: `${week + 2} / span 3`, gridRow: 1 }}>
            {label}
          </span>
        ))}
        {WEEKDAYS.map((label, row) =>
          label ? (
            <span key={label} className="self-center text-[0.56rem] leading-none tracking-wide text-muted" style={{ gridColumn: 1, gridRow: row + 2 }}>
              {label}
            </span>
          ) : null,
        )}
        {placed.map(({ day, week, row }) => (
          <span
            key={day.date}
            title={describe(day)}
            data-level={day.level}
            className="contribution-day aspect-square"
            style={{ gridColumn: week + 2, gridRow: row + 2, "--week": week } as CSSProperties}
          />
        ))}
        {/* A soft light that keeps passing over the graph. */}
        <span aria-hidden className="graph-scan-track">
          <span className="graph-scan" />
        </span>
      </div>
    </div>
  );
}

/** Holds the panel's space while GitHub answers, so nothing jumps when the graph arrives. */
export function GithubLoading() {
  return <p className="copy mt-3 min-h-[20rem] text-muted">Reading the contribution graph...</p>;
}

export function GithubProgress({ stats, handle }: { stats: GithubStats | null; handle: string }) {
  const profile = `https://github.com/${handle}`;
  if (!stats) {
    return (
      <p className="copy mt-3">
        The contribution graph will be back shortly.{" "}
        <a href={profile} target="_blank" rel="noreferrer" className="text-gold underline">
          See the profile on GitHub
        </a>
        .
      </p>
    );
  }
  const most = Math.max(1, ...stats.languages.map((language) => language.repos));

  return (
    <>
      <div className="mt-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="text-[0.72rem] tracking-wide text-soft">
            <span className="text-gold">{stats.total.toLocaleString("en-US")}</span> contributions in the last year
          </p>
          <a href={profile} target="_blank" rel="noreferrer" className="label flex items-center gap-1.5 text-[0.6rem] text-soft transition-colors hover:text-gold max-lg:py-2.5">
            <span aria-hidden className="live-dot" />
            @{stats.handle} <External />
          </a>
        </div>
        <Calendar days={stats.days} />
        <div className="mt-1.5 flex items-center justify-end gap-1 text-[0.56rem] tracking-wide text-muted">
          Less
          {LEVELS.map((level) => (
            <span key={level} data-level={level} className="contribution-swatch size-2.5" />
          ))}
          More
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t border-gold-faint pt-3 md:grid-cols-[1fr_14rem]">
        <div>
          <p className="label text-[0.6rem] text-muted">Languages · public repos</p>
          <ul className="mt-2 grid gap-1">
            {stats.languages.map((language, index) => (
              <li key={language.name} className="grid grid-cols-[5.2rem_1fr_3.4rem] items-center gap-2 text-[0.68rem] tracking-wide">
                <span className="truncate text-soft">{language.name}</span>
                <span className="language-track h-2">
                  <span
                    className="language-bar block h-full"
                    style={{ width: `${(language.repos / most) * 100}%`, "--i": index } as CSSProperties}
                  />
                </span>
                <span className="text-right text-muted">
                  <span className="text-gold">{language.repos}</span> {language.repos === 1 ? "repo" : "repos"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 content-start gap-x-2 gap-y-3">
          <Stat value={stats.total.toLocaleString("en-US")} label="Contributions" />
          <Stat value={String(stats.activeDays)} label="Active days" />
          <Stat value={`${stats.currentStreak}d`} label="Current streak" />
          <Stat value={`${stats.longestStreak}d`} label="Longest streak" />
          <Stat value={String(stats.repos)} label="Public repos" />
          <Stat value={String(stats.busiest?.count ?? 0)} label="Busiest day" />
        </div>
      </div>
    </>
  );
}
