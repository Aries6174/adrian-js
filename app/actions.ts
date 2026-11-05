"use server";

import { headers } from "next/headers";
import { sendContactEmail } from "@/lib/mail";
import { addMessage, readContent } from "@/lib/store";
import { isEmail } from "@/lib/validate";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const MAX_TRACKED = 1000;
const recent = new Map<string, number[]>();

export type SendResult = { status: "sent" } | { status: "error"; message: string };

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

export async function sendMessage(input: {
  name: string;
  email: string;
  message: string;
  company: string;
}): Promise<SendResult> {
  // Bots fill in the hidden field. They get a normal reply and nothing is kept.
  if (input.company) return { status: "sent" };

  const name = String(input.name ?? "").trim().replace(/[\r\n]+/g, " ").slice(0, 100);
  const email = String(input.email ?? "").trim();
  const body = String(input.message ?? "").trim().slice(0, 5000);
  if (!name || !body) return { status: "error", message: "Please fill in your name and message." };
  if (!isEmail(email)) return { status: "error", message: "Please enter a valid email address." };

  const ip = await clientIp();
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    return { status: "error", message: "Too many messages. Please try again in a few minutes." };
  }
  recent.set(ip, [...times, now]);
  if (recent.size > MAX_TRACKED) {
    for (const [key, list] of recent) {
      if (list.every((time) => now - time >= WINDOW_MS)) recent.delete(key);
    }
  }

  const { profile } = await readContent();
  const emailed = await sendContactEmail({ to: profile.email, name, email, body });
  let stored = true;
  try {
    await addMessage({ name, email, body, emailed });
  } catch (error) {
    stored = false;
    console.error("Could not save the contact message.", error);
  }
  if (!emailed && !stored) {
    return {
      status: "error",
      message: `Your message could not be sent. Please email ${profile.email} directly.`,
    };
  }
  return { status: "sent" };
}
