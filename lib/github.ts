import "server-only";

import { after } from "next/server";
import { readValue, writeValue } from "./store";

export type GithubDay = { date: string; count: number; level: number };

export type GithubStats = {
  handle: string;
  total: number;
  days: GithubDay[];
  activeDays: number;
  longestStreak: number;
  currentStreak: number;
  busiest: GithubDay | null;
  repos: number;
  languages: { name: string; repos: number }[];
  fetchedAt: number;
};

const HOUR = 3600_000;
const RETRY = 60_000;
const FETCH_LIMIT = 10_000;
const SHOWN_LANGUAGES = 7;

const headers = { "User-Agent": "adrian-js-portfolio" };

/** GitHub's own profile graph has no public API without a token, so this reads its HTML. */
export function parseCalendar(html: string) {
  const tips = new Map<string, number>();
  for (const [, id, text] of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    tips.set(id, Number(text.match(/^([\d,]+) contribution/)?.[1].replace(/,/g, "")) || 0);
  }
  const days: GithubDay[] = [];
  for (const [cell] of html.matchAll(/<td\b[^>]*ContributionCalendar-day[^>]*>/g)) {
    const date = cell.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    if (!date) continue;
    days.push({
      date,
      count: tips.get(cell.match(/\bid="([^"]+)"/)?.[1] ?? "") ?? 0,
      level: Number(cell.match(/data-level="(\d)"/)?.[1]) || 0,
    });
  }
  if (days.length === 0) throw new Error("GitHub's contribution graph has changed shape.");
  days.sort((a, b) => a.date.localeCompare(b.date));

  let run = 0;
  let longestStreak = 0;
  let busiest: GithubDay | null = null;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
    if (day.count > (busiest?.count ?? 0)) busiest = day;
  }
  // Today not being done yet doesn't end a streak.
  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) currentStreak += 1;
    else if (i !== days.length - 1) break;
  }
  return {
    days,
    total: days.reduce((sum, day) => sum + day.count, 0),
    activeDays: days.filter((day) => day.count > 0).length,
    longestStreak,
    currentStreak,
    busiest,
  };
}

async function fetchCalendar(handle: string) {
  const response = await fetch(`https://github.com/users/${handle}/contributions`, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_LIMIT),
  });
  if (!response.ok) throw new Error(`GitHub graph answered ${response.status}.`);
  return parseCalendar(await response.text());
}

/** Counts each public repo you made under its main language. Forks are other people's work. */
async function fetchLanguages(handle: string) {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/users/${handle}/repos?per_page=100&type=owner`, {
    headers: { ...headers, Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_LIMIT),
  });
  if (!response.ok) throw new Error(`GitHub repos answered ${response.status}.`);
  const repos = (await response.json()) as { fork: boolean; language: string | null }[];
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (!repo.fork && repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  return {
    repos: repos.filter((repo) => !repo.fork).length,
    languages: [...counts]
      .map(([name, count]) => ({ name, repos: count }))
      .sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name))
      .slice(0, SHOWN_LANGUAGES),
  };
}

/** Saves what it can. If one part failed, the older copy of it stays and a retry comes sooner. */
async function refresh(handle: string, key: string, previous: GithubStats | null) {
  const [calendar, languages] = await Promise.allSettled([fetchCalendar(handle), fetchLanguages(handle)]);
  for (const result of [calendar, languages]) {
    if (result.status === "rejected") console.error("Could not refresh GitHub progress.", result.reason);
  }
  const days = calendar.status === "fulfilled" ? calendar.value : previous;
  const repos = languages.status === "fulfilled" ? languages.value : previous;
  if (!days) return previous;
  const complete = calendar.status === "fulfilled" && languages.status === "fulfilled";
  const stats: GithubStats = {
    handle,
    days: days.days,
    total: days.total,
    activeDays: days.activeDays,
    longestStreak: days.longestStreak,
    currentStreak: days.currentStreak,
    busiest: days.busiest,
    repos: repos?.repos ?? 0,
    languages: repos?.languages ?? [],
    fetchedAt: complete ? Date.now() : Date.now() - HOUR + RETRY,
  };
  await writeValue(key, JSON.stringify(stats));
  return stats;
}

const refreshing = new Map<string, Promise<GithubStats | null>>();
const failedAt = new Map<string, number>();

function refreshOnce(handle: string, key: string, previous: GithubStats | null) {
  let job = refreshing.get(key);
  if (!job) {
    job = refresh(handle, key, previous).finally(() => refreshing.delete(key));
    refreshing.set(key, job);
  }
  return job;
}

/**
 * The newest saved copy, refreshed at most hourly. A stale copy is shown straight away and
 * refreshed after the response, so a visitor never waits on GitHub or sees an empty panel.
 */
export async function loadGithub(handle: string): Promise<GithubStats | null> {
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(handle)) return null;
  const key = `github:${handle.toLowerCase()}`;
  try {
    const saved = await readValue(key);
    const stats = saved ? (JSON.parse(saved) as GithubStats) : null;
    if (!stats) {
      // With nothing saved a visitor has to wait, but only once while GitHub is failing.
      if (Date.now() - (failedAt.get(key) ?? 0) < RETRY) return null;
      const fresh = await refreshOnce(handle, key, null);
      if (!fresh) failedAt.set(key, Date.now());
      return fresh;
    }
    if (Date.now() - stats.fetchedAt > HOUR) {
      after(() => refreshOnce(handle, key, stats).catch((error) => console.error("Could not save GitHub progress.", error)));
    }
    return stats;
  } catch (error) {
    console.error("Could not load GitHub progress.", error);
    return null;
  }
}
