import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "admin_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 16;

const failures = new Map<string, { count: number; until: number }>();

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

/** Derived from the password, so changing the password signs out every session. */
function sessionKey(password: string) {
  return sha256(`admin-session:${password}`);
}

function sign(expires: string, password: string) {
  return createHmac("sha256", sessionKey(password)).update(expires).digest("hex");
}

/** Online, a short password leaves admin locked, as this is the only thing protecting it. */
function adminPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const online = Boolean(process.env.DATABASE_URL || process.env.VERCEL);
  return online && password.length < MIN_PASSWORD_LENGTH ? null : password;
}

export function adminConfigured() {
  return Boolean(adminPassword());
}

export function loginLocked(ip: string) {
  const entry = failures.get(ip);
  return Boolean(entry && entry.count >= MAX_FAILURES && entry.until > Date.now());
}

/** With no usable ADMIN_PASSWORD set, nothing can log in. */
export function checkPassword(input: string, ip: string) {
  const password = adminPassword();
  const ok = Boolean(password) && timingSafeEqual(sha256(input), sha256(password ?? ""));
  if (ok) {
    failures.delete(ip);
  } else {
    const entry = failures.get(ip);
    const expired = !entry || entry.until <= Date.now();
    failures.set(ip, { count: expired ? 1 : entry.count + 1, until: Date.now() + LOCK_MS });
  }
  return ok;
}

export async function startSession() {
  const password = adminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD is not set.");
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  (await cookies()).set(COOKIE, `${expires}.${sign(expires, password)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  const password = adminPassword();
  const value = (await cookies()).get(COOKIE)?.value;
  if (!password || !value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires, password));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
