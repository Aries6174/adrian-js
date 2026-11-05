export type VisitStats = { total: number; hours: number[] };

/** How many hours the small chart covers. */
export const VISIT_HOURS = 56;

const STORAGE_KEY = "adrian-js-last-visit";

function lastVisit() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function remember(day: string) {
  try {
    localStorage.setItem(STORAGE_KEY, day);
  } catch {
    // Private windows can refuse storage. The visit just counts again next time.
  }
}

let request: Promise<VisitStats | null> | null = null;

async function load() {
  // Each browser counts once a day, however many pages it opens.
  const today = new Date().toISOString().slice(0, 10);
  const counting = lastVisit() !== today;
  try {
    const response = await fetch("/visits", { method: counting ? "POST" : "GET" });
    if (!response.ok) return null;
    if (counting) remember(today);
    return (await response.json()) as VisitStats;
  } catch {
    return null;
  }
}

/** Shared by the whole page, so opening it is only ever counted once. */
export function visitStats() {
  request ??= load();
  return request;
}
