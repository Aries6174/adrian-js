import { connection, NextResponse } from "next/server";
import { readVisits, recordVisit } from "@/lib/store";
import { VISIT_HOURS } from "@/lib/visits";

const NOT_A_PERSON = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget/i;

function reply(stats: Awaited<ReturnType<typeof readVisits>>) {
  return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
}

function failed(error: unknown) {
  console.error("Could not read the visitor count.", error);
  return NextResponse.json({ error: "Unavailable" }, { status: 503 });
}

export async function GET() {
  await connection();
  try {
    return reply(await readVisits(VISIT_HOURS));
  } catch (error) {
    return failed(error);
  }
}

/** Only the site's own pages count, and only for people. Search engines and other sites don't. */
export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const counts = site === "same-origin" && !NOT_A_PERSON.test(request.headers.get("user-agent") ?? "");
  try {
    if (counts) await recordVisit();
    return reply(await readVisits(VISIT_HOURS));
  } catch (error) {
    return failed(error);
  }
}
