"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/content";
import { Icon } from "./ui";

const BOX = "block w-full border border-gold-faint/60 bg-black/20 p-1.5 text-center";
const ACTIVE = `${BOX} cursor-pointer transition-all hover:border-gold hover:bg-gold/10`;

function Body({ icon, label, value }: { icon: string; label: ReactNode; value: ReactNode }) {
  return (
    <>
      <span className="flex h-[2.2rem] items-center justify-center text-gold">
        <Icon name={icon} className="size-6" />
      </span>
      <span className="label block text-[0.62rem] text-text max-lg:text-[0.7rem]">{label}</span>
      <span className="mt-0.5 block truncate text-[0.62rem] tracking-wider text-soft max-lg:text-[0.7rem]">{value}</span>
    </>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The clipboard API needs a secure page. This older route works without one.
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}

function CopyEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    setState((await copyText(email)) ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button type="button" onClick={copy} title={`Copy ${email}`} className={ACTIVE}>
      <Body
        icon="mail"
        label={
          <span aria-live="polite">
            {state === "copied" ? "Copied!" : state === "failed" ? "Copy failed" : "Email"}
          </span>
        }
        value={<span className="text-[0.53rem] tracking-tight">{email}</span>}
      />
    </button>
  );
}

export function ContactLinks({ profile }: { profile: Profile }) {
  const links = [
    { label: "GitHub", value: profile.githubHandle, href: profile.github, icon: "github" },
    { label: "LinkedIn", value: profile.linkedinHandle, href: profile.linkedin, icon: "linkedin" },
    { label: "Resume", value: "View PDF", href: profile.resume, icon: "resume" },
    { label: "Twitter / X", value: profile.xHandle, href: profile.x, icon: "x" },
  ];
  return (
    <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      <li>
        <CopyEmail email={profile.email} />
      </li>
      {links.map((link) => (
        <li key={link.label}>
          <a href={link.href} target="_blank" rel="noreferrer" className={ACTIVE}>
            <Body icon={link.icon} label={link.label} value={link.value} />
          </a>
        </li>
      ))}
      <li>
        <div className={BOX}>
          <Body icon="discord" label="Discord" value={profile.discord} />
        </div>
      </li>
    </ul>
  );
}
