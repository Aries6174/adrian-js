"use client";

import { type FormEvent, useLayoutEffect, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/app/actions";
import { Arrow } from "./ui";

export function ContactForm() {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const shouldReset = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  // Activity keeps this page alive between visits, so clear a finished message on the way out.
  useLayoutEffect(() => {
    const current = form.current;
    return () => {
      if (shouldReset.current) {
        shouldReset.current = false;
        setResult(null);
        current?.reset();
      }
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const data = new FormData(element);
    setResult(null);
    startTransition(async () => {
      try {
        const reply = await sendMessage({
          name: String(data.get("name")),
          email: String(data.get("email")),
          message: String(data.get("message")),
          company: String(data.get("company") ?? ""),
        });
        if (reply.status === "sent") {
          element.reset();
          shouldReset.current = true;
          setResult({ ok: true, text: "Message sent. I'll get back to you soon." });
        } else {
          setResult({ ok: false, text: reply.message });
        }
      } catch {
        setResult({ ok: false, text: "Something went wrong. Please try again." });
      }
    });
  }

  return (
    <form ref={form} onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2.5">
      <label className="block">
        <span className="label text-[0.66rem] text-soft">Name</span>
        <input required maxLength={100} name="name" autoComplete="name" placeholder="Your name" className="field mt-1" />
      </label>
      <label className="block">
        <span className="label text-[0.66rem] text-soft">Email</span>
        <input required maxLength={200} name="email" type="email" autoComplete="email" placeholder="you@example.com" className="field mt-1" />
      </label>
      <label className="block">
        <span className="label text-[0.66rem] text-soft">Message</span>
        <textarea required maxLength={5000} name="message" rows={3} placeholder="Tell me about your project, idea, or anything..." className="field mt-1 resize-none" />
      </label>
      {/* Hidden from people. Bots that fill it in are ignored. */}
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[999rem] size-px opacity-0" />
      <button type="submit" disabled={pending} className="btn w-full disabled:cursor-wait disabled:opacity-60" data-solid="true">
        <Arrow className="w-4 text-gold" /> {pending ? "Sending..." : "Send Message"}
      </button>
      <p role="status" className={`min-h-4 text-center text-[0.68rem] tracking-wide ${result && !result.ok ? "text-red-300" : "text-gold"}`}>
        {result?.text}
      </p>
    </form>
  );
}
