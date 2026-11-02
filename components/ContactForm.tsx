"use client";

import { type FormEvent, useLayoutEffect, useRef, useState } from "react";
import { profile } from "@/lib/content";
import { Arrow } from "./ui";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const shouldReset = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  // Activity keeps this page alive between visits, so clear a finished message on the way out.
  useLayoutEffect(() => {
    const current = form.current;
    return () => {
      if (shouldReset.current) {
        shouldReset.current = false;
        setSent(false);
        current?.reset();
      }
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name"));
    const email = String(data.get("email"));
    const message = String(data.get("message"));
    const subject = encodeURIComponent(`Portfolio message from ${name}`);
    const body = encodeURIComponent(`${message}\n\n${name}\n${email}`);
    window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
    shouldReset.current = true;
    setSent(true);
  }

  return (
    <form ref={form} onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2.5">
      <label className="block">
        <span className="label text-[0.66rem] text-soft">Name</span>
        <input required name="name" autoComplete="name" placeholder="Your name" className="field mt-1" />
      </label>
      <label className="block">
        <span className="label text-[0.66rem] text-soft">Email</span>
        <input required name="email" type="email" autoComplete="email" placeholder="you@example.com" className="field mt-1" />
      </label>
      <label className="block">
        <span className="label text-[0.66rem] text-soft">Message</span>
        <textarea required name="message" rows={3} placeholder="Tell me about your project, idea, or anything..." className="field mt-1 resize-none" />
      </label>
      <button type="submit" className="btn w-full" data-solid="true">
        <Arrow className="w-4 text-gold" /> Send Message
      </button>
      <p role="status" className="min-h-4 text-center text-[0.68rem] tracking-wide text-gold">
        {sent && "Your email app should open with this message ready to send."}
      </p>
    </form>
  );
}
