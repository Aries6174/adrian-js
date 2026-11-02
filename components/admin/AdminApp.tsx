"use client";

import Image from "next/image";
import { type ReactNode, useActionState, useState, useTransition } from "react";
import {
  login,
  logout,
  removeMessage,
  removeProject,
  saveAbout,
  saveHome,
  saveProfile,
  saveProject,
  type SaveResult,
} from "@/app/admin/actions";
import {
  type About,
  type HomeCards,
  ICON_OPTIONS,
  newestFirst,
  type Profile,
  type Project,
  type ProjectCategory,
  projectFilters,
  type SiteContent,
} from "@/lib/content";
import type { StoredMessage } from "@/lib/store";

const CATEGORIES = projectFilters.filter((filter) => filter.id !== "all");

function lines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function commas(value: string) {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <form action={action} className="hud-panel w-full max-w-sm p-6">
        <h1 className="display text-[1.3rem] text-gold">Admin</h1>
        <label className="mt-5 block">
          <span className="label text-soft">Password</span>
          <input required autoFocus name="password" type="password" autoComplete="current-password" className="field mt-1" />
        </label>
        <button type="submit" disabled={pending} className="btn mt-4 w-full" data-solid="true">
          {pending ? "Checking..." : "Log in"}
        </button>
        <p role="alert" className="mt-3 min-h-5 text-center text-sm text-red-300">
          {error}
        </p>
      </form>
    </main>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label text-soft">{label}</span>
      <input required={required} type={type} step={type === "number" ? "any" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="field mt-1" />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Area({
  label,
  hint,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="label text-soft">{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="field mt-1 resize-y" />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function IconSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="field">
      {ICON_OPTIONS.map((name) => (
        <option key={name} value={name} className="bg-ink">
          {name}
        </option>
      ))}
    </select>
  );
}

/** Uploads straight away and hands back the file's address, ready to be saved with the form. */
function Upload({
  label,
  kind = "image",
  value,
  onChange,
  onClear,
}: {
  label: string;
  kind?: "image" | "pdf";
  value: string;
  onChange: (url: string) => void;
  onClear?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const response = await fetch("/admin/upload", { method: "POST", body: form });
      const data = (await response.json()) as { url?: string; error?: string };
      if (data.url) onChange(data.url);
      else setError(data.error ?? "Upload failed.");
    } catch {
      setError("Upload failed. Files can be up to 4 MB.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="label text-soft">{label}</span>
      <div className="mt-1 flex items-center gap-3">
        {kind === "image" ? (
          <div className="relative h-16 w-24 shrink-0 overflow-hidden border border-gold-faint bg-black/40">
            {value && <Image src={value} alt="" fill unoptimized sizes="96px" className="object-cover" />}
          </div>
        ) : (
          <a href={value} target="_blank" rel="noreferrer" className="text-sm text-gold underline">
            View current file
          </a>
        )}
        <label className="btn cursor-pointer">
          {busy ? "Uploading..." : "Choose file"}
          <input
            type="file"
            accept={kind === "pdf" ? "application/pdf" : "image/*"}
            className="sr-only"
            onChange={(event) => {
              send(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {onClear && value && (
          <button type="button" onClick={onClear} className="cursor-pointer text-sm text-muted underline hover:text-text">
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function SaveBar({ busy, status }: { busy: boolean; status: Status }) {
  return (
    <div className="sticky bottom-0 -mx-1 mt-5 flex items-center gap-4 bg-ink/90 px-1 py-3">
      <button type="submit" disabled={busy} className="btn" data-solid="true">
        {busy ? "Saving..." : "Save"}
      </button>
      {status && (
        <p role="status" className={`text-sm ${status.ok ? "text-gold" : "text-red-300"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}

type Status = { ok: boolean; text: string } | null;

/** Runs a save, reports the outcome and passes fresh content up. */
function useSaver(onSaved: (content: SiteContent) => void) {
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const run = (action: () => Promise<SaveResult>, done?: () => void) => {
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await action();
        if ("error" in result) {
          setStatus({ ok: false, text: result.error });
        } else {
          onSaved(result.content);
          setStatus({ ok: true, text: "Saved. The site is updated." });
          done?.();
        }
      } catch {
        setStatus({ ok: false, text: "Could not save. Check your connection and try again." });
      }
    });
  };
  return { busy, status, run };
}

type ProjectDraft = {
  id?: string;
  title: string;
  headline: string;
  tagline: string;
  summary: string;
  overview: string;
  tags: string;
  features: string;
  categories: ProjectCategory[];
  image: string;
  second: string;
  logo: boolean;
  imagePosition: string;
  credit: string;
  live: string;
  github: string;
};

function toDraft(project?: Project): ProjectDraft {
  return {
    id: project?.id,
    title: project?.title ?? "",
    // A heading that only repeats the title stays empty, so renaming the project updates it too.
    headline: project && project.headline.join(" ") !== project.title ? project.headline.join("\n") : "",
    tagline: project?.tagline ?? "",
    summary: project?.summary ?? "",
    overview: project?.overview ?? "",
    tags: project?.tags.join(", ") ?? "",
    features: project?.features.join("\n") ?? "",
    categories: project?.categories ?? [],
    image: project?.image ?? "",
    second: project?.gallery[1] ?? "",
    logo: project?.fit === "contain",
    imagePosition: project?.imagePosition ?? "",
    credit: project?.credit ?? "",
    live: project?.live ?? "",
    github: project?.github ?? "",
  };
}

function ProjectForm({
  project,
  onSaved,
  onDone,
}: {
  project?: Project;
  onSaved: (content: SiteContent) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(project));
  const { busy, status, run } = useSaver(onSaved);
  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.image) return run(async () => ({ error: "Add a main image first." }));
        run(
          () =>
            saveProject({
              id: draft.id,
              title: draft.title,
              headline: lines(draft.headline),
              tagline: draft.tagline,
              summary: draft.summary,
              overview: draft.overview,
              tags: commas(draft.tags),
              features: lines(draft.features),
              categories: draft.categories,
              image: draft.image,
              gallery: [draft.image, ...(draft.second ? [draft.second] : [])],
              fit: draft.logo ? "contain" : undefined,
              imagePosition: draft.imagePosition,
              credit: draft.credit,
              live: draft.live,
              github: draft.github,
            }),
          onDone,
        );
      }}
      className="hud-panel grid gap-4 p-5 md:grid-cols-2"
    >
      <h2 className="display text-[1.05rem] text-gold md:col-span-2">{project ? `Edit ${project.title}` : "New project"}</h2>
      <Field label="Title" required value={draft.title} onChange={(value) => set("title", value)} />
      <Field label="Short description" hint="Shown on the Home card" value={draft.tagline} onChange={(value) => set("tagline", value)} />
      <Area label="Display heading" hint="One or two lines. Leave empty to use the title." rows={2} value={draft.headline} onChange={(value) => set("headline", value)} />
      <Area label="Summary" rows={2} value={draft.summary} onChange={(value) => set("summary", value)} />
      <div className="md:col-span-2">
        <Area label="Overview" rows={4} value={draft.overview} onChange={(value) => set("overview", value)} />
      </div>
      <Area label="Key features" hint="One per line" rows={4} value={draft.features} onChange={(value) => set("features", value)} />
      <div className="grid content-start gap-4">
        <Field label="Technologies" hint="Separate with commas" value={draft.tags} onChange={(value) => set("tags", value)} />
        <fieldset>
          <legend className="label text-soft">Categories</legend>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {CATEGORIES.map((category) => (
              <label key={category.id} className="flex items-center gap-2 text-sm text-soft">
                <input
                  type="checkbox"
                  checked={draft.categories.includes(category.id as ProjectCategory)}
                  onChange={(event) =>
                    set(
                      "categories",
                      event.target.checked
                        ? [...draft.categories, category.id as ProjectCategory]
                        : draft.categories.filter((item) => item !== category.id),
                    )
                  }
                />
                {category.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <Upload label="Main image" value={draft.image} onChange={(url) => set("image", url)} />
      <Upload label="Second image (optional)" value={draft.second} onChange={(url) => set("second", url)} onClear={() => set("second", "")} />
      <label className="flex items-center gap-2 text-sm text-soft md:col-span-2">
        <input type="checkbox" checked={draft.logo} onChange={(event) => set("logo", event.target.checked)} />
        This image is a logo, so show it whole instead of cropping it
      </label>
      <Field label="Live link" type="url" value={draft.live} onChange={(value) => set("live", value)} />
      <Field label="GitHub link" type="url" value={draft.github} onChange={(value) => set("github", value)} />
      <div className="md:col-span-2">
        <Field label="Image credit (optional)" value={draft.credit} onChange={(value) => set("credit", value)} />
        <div className="flex items-center gap-4">
          <SaveBar busy={busy} status={status} />
          <button type="button" onClick={onDone} className="btn mt-2">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function ProjectsTab({ content, onSaved }: { content: SiteContent; onSaved: (content: SiteContent) => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { status, run } = useSaver(onSaved);
  const projects = newestFirst(content.projects);

  if (editing) {
    const project = projects.find((item) => item.id === editing);
    return <ProjectForm key={editing} project={project} onSaved={onSaved} onDone={() => setEditing(null)} />;
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-soft">Newest projects appear first on Home and Projects.</p>
        <button type="button" onClick={() => setEditing("new")} className="btn" data-solid="true">
          Add project
        </button>
      </div>
      {status && !status.ok && <p className="mb-3 text-sm text-red-300">{status.text}</p>}
      {projects.length === 0 && <p className="text-soft">No projects yet.</p>}
      <ul className="grid gap-2">
        {projects.map((project) => (
          <li key={project.id} className="hud-panel flex items-center gap-4 p-3">
            <div className="relative h-14 w-20 shrink-0 overflow-hidden border border-gold-faint">
              <Image src={project.image} alt="" fill unoptimized sizes="80px" className={project.fit === "contain" ? "object-contain" : "object-cover"} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-text">{project.title}</p>
              <p className="truncate text-sm text-muted">{project.tagline}</p>
            </div>
            <button type="button" onClick={() => setEditing(project.id)} className="btn">
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete "${project.title}"? This can't be undone.`)) {
                  run(() => removeProject(project.id));
                }
              }}
              className="btn"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AboutTab({ about, onSaved }: { about: About; onSaved: (content: SiteContent) => void }) {
  const [draft, setDraft] = useState(about);
  const [journey, setJourney] = useState(about.journey.map((item) => ({ year: item.year, lines: item.lines.join("\n") })));
  const { busy, status, run } = useSaver(onSaved);
  const education = draft.education;
  const setEducation = (key: keyof About["education"], value: string) =>
    setDraft({ ...draft, education: { ...education, [key]: value } });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveAbout({ ...draft, journey: journey.map((item) => ({ year: item.year, lines: lines(item.lines) })) }));
      }}
      className="grid gap-5"
    >
      <Group title="Who am I">
        <Field label="Heading" required value={draft.heading} onChange={(heading) => setDraft({ ...draft, heading })} />
        <Area label="Intro text" rows={4} value={draft.body} onChange={(body) => setDraft({ ...draft, body })} />
        <Upload label="Image" value={draft.image} onChange={(image) => setDraft({ ...draft, image })} />
        <Area label="Image caption" hint="One or two lines" rows={2} value={draft.caption.join("\n")} onChange={(value) => setDraft({ ...draft, caption: value.split("\n").slice(0, 2) })} />
      </Group>

      <Group title="Tech stack">
        {draft.techStack.map((item, index) => (
          <Row
            key={index}
            onRemove={() => setDraft({ ...draft, techStack: draft.techStack.filter((_, i) => i !== index) })}
          >
            <input aria-label="Technology" placeholder="Name" value={item.name} onChange={(event) => setDraft({ ...draft, techStack: draft.techStack.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)) })} className="field" />
            <input aria-label="Note" placeholder="Note, e.g. learning" value={item.note ?? ""} onChange={(event) => setDraft({ ...draft, techStack: draft.techStack.map((row, i) => (i === index ? { ...row, note: event.target.value } : row)) })} className="field" />
            <IconSelect label="Icon" value={item.icon} onChange={(icon) => setDraft({ ...draft, techStack: draft.techStack.map((row, i) => (i === index ? { ...row, icon } : row)) })} />
          </Row>
        ))}
        <button type="button" onClick={() => setDraft({ ...draft, techStack: [...draft.techStack, { name: "", icon: "code" }] })} className="btn w-max">
          Add technology
        </button>
      </Group>

      <Group title="Education">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Degree" value={education.degree} onChange={(value) => setEducation("degree", value)} />
          <Field label="School" value={education.school} onChange={(value) => setEducation("school", value)} />
          <Field label="Place" value={education.place} onChange={(value) => setEducation("place", value)} />
          <Field label="Years" value={education.years} onChange={(value) => setEducation("years", value)} />
          <Field label="Earlier schooling" value={education.earlierTitle} onChange={(value) => setEducation("earlierTitle", value)} />
          <Field label="Earlier school" value={education.earlierSchool} onChange={(value) => setEducation("earlierSchool", value)} />
          <Field label="Earlier years" value={education.earlierYears} onChange={(value) => setEducation("earlierYears", value)} />
          <Field label="Photo credit" value={education.credit} onChange={(value) => setEducation("credit", value)} />
          <Field label="Photo credit link" type="url" value={education.creditLink ?? ""} onChange={(value) => setEducation("creditLink", value)} />
        </div>
        <Upload label="Photo" value={education.image} onChange={(url) => setEducation("image", url)} />
      </Group>

      <Group title="Journey">
        {journey.map((item, index) => (
          <Row key={index} onRemove={() => setJourney(journey.filter((_, i) => i !== index))}>
            <input aria-label="Year" placeholder="Year" value={item.year} onChange={(event) => setJourney(journey.map((row, i) => (i === index ? { ...row, year: event.target.value } : row)))} className="field" />
            <textarea aria-label="Description" rows={2} placeholder="One or two short lines" value={item.lines} onChange={(event) => setJourney(journey.map((row, i) => (i === index ? { ...row, lines: event.target.value } : row)))} className="field md:col-span-2" />
          </Row>
        ))}
        <button type="button" onClick={() => setJourney([...journey, { year: "", lines: "" }])} className="btn w-max">
          Add step
        </button>
      </Group>

      <Group title="Interests">
        {draft.interests.map((item, index) => (
          <Row key={index} onRemove={() => setDraft({ ...draft, interests: draft.interests.filter((_, i) => i !== index) })}>
            <input aria-label="Interest" placeholder="Name" value={item.name} onChange={(event) => setDraft({ ...draft, interests: draft.interests.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)) })} className="field md:col-span-2" />
            <IconSelect label="Icon" value={item.icon} onChange={(icon) => setDraft({ ...draft, interests: draft.interests.map((row, i) => (i === index ? { ...row, icon } : row)) })} />
          </Row>
        ))}
        <button type="button" onClick={() => setDraft({ ...draft, interests: [...draft.interests, { name: "", icon: "code" }] })} className="btn w-max">
          Add interest
        </button>
        <Area label="Quote" rows={2} value={draft.quote} onChange={(quote) => setDraft({ ...draft, quote })} />
      </Group>

      <SaveBar busy={busy} status={status} />
    </form>
  );
}

function HomeTab({ home, onSaved }: { home: HomeCards; onSaved: (content: SiteContent) => void }) {
  const [draft, setDraft] = useState(home);
  const { busy, status, run } = useSaver(onSaved);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveHome(draft));
      }}
      className="hud-panel grid gap-4 p-5"
    >
      <h2 className="display text-[1rem] text-gold">Cards at the bottom of Home</h2>
      <Area label="About Me" value={draft.about} onChange={(about) => setDraft({ ...draft, about })} />
      <Area label="Skills" value={draft.skills} onChange={(skills) => setDraft({ ...draft, skills })} />
      <Area label="Get in Touch" value={draft.contact} onChange={(contact) => setDraft({ ...draft, contact })} />
      <SaveBar busy={busy} status={status} />
    </form>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="hud-panel grid gap-4 p-5">
      <h2 className="display text-[1rem] text-gold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid flex-1 gap-2 md:grid-cols-3">{children}</div>
      <button type="button" onClick={onRemove} className="btn">
        Remove
      </button>
    </div>
  );
}

function ContactsTab({ profile, onSaved }: { profile: Profile; onSaved: (content: SiteContent) => void }) {
  const [draft, setDraft] = useState({ ...profile, lat: String(profile.lat), lon: String(profile.lon) });
  const { busy, status, run } = useSaver(onSaved);
  const field = (key: keyof typeof draft) => ({
    value: draft[key],
    onChange: (value: string) => setDraft({ ...draft, [key]: value }),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveProfile({ ...draft, lat: Number(draft.lat), lon: Number(draft.lon) }));
      }}
      className="hud-panel grid gap-4 p-5 md:grid-cols-2"
    >
      <Field label="Name" required {...field("name")} />
      <Field label="Email" hint="Contact form messages go here" type="email" required {...field("email")} />
      <Field label="GitHub link" type="url" {...field("github")} />
      <Field label="GitHub name" {...field("githubHandle")} />
      <Field label="LinkedIn link" type="url" {...field("linkedin")} />
      <Field label="LinkedIn name" {...field("linkedinHandle")} />
      <Field label="X link" type="url" {...field("x")} />
      <Field label="X name" {...field("xHandle")} />
      <Field label="Discord" {...field("discord")} />
      <Upload label="Resume (PDF)" kind="pdf" value={draft.resume} onChange={(resume) => setDraft({ ...draft, resume })} />
      <Field label="City" {...field("city")} />
      <Field label="Country" {...field("country")} />
      <Field label="Latitude" type="number" {...field("lat")} />
      <Field label="Longitude" type="number" {...field("lon")} />
      <div className="md:col-span-2">
        <SaveBar busy={busy} status={status} />
      </div>
    </form>
  );
}

function MessagesTab({ initial }: { initial: StoredMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [, startTransition] = useTransition();

  if (messages.length === 0) return <p className="text-soft">No messages yet.</p>;
  return (
    <ul className="grid gap-3">
      {messages.map((message) => (
        <li key={message.id} className="hud-panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <p className="text-text">
              {message.name} <a href={`mailto:${message.email}`} className="text-sm text-gold underline">{message.email}</a>
            </p>
            <p className="text-xs text-muted">
              {new Date(message.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
              {message.emailed ? " · emailed" : " · not emailed"}
            </p>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-soft">{message.body}</p>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Delete this message?")) return;
              startTransition(async () => {
                const next = await removeMessage(message.id);
                if (next) setMessages(next);
              });
            }}
            className="mt-2 cursor-pointer text-sm text-muted underline hover:text-text"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}

const TABS = ["Projects", "Home", "About", "Contacts", "Messages"] as const;

export function AdminApp({
  initial,
  initialMessages,
}: {
  initial: SiteContent;
  initialMessages: StoredMessage[];
}) {
  const [content, setContent] = useState(initial);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Projects");

  return (
    <div className="mx-auto max-w-4xl px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[1.3rem] text-gold">Admin</h1>
        <div className="flex items-center gap-3">
          {/* A full page load, so the public pages pick up what was just saved. */}
          <a href="/home" className="btn">
            View site
          </a>
          <form action={logout}>
            <button type="submit" className="btn">
              Log out
            </button>
          </form>
        </div>
      </header>
      <nav aria-label="Admin sections" className="my-5 flex flex-wrap gap-2 border-b border-gold-faint pb-3">
        {TABS.map((name) => (
          <button key={name} type="button" onClick={() => setTab(name)} data-solid={tab === name} aria-current={tab === name} className="btn">
            {name}
            {name === "Messages" && initialMessages.length > 0 && ` (${initialMessages.length})`}
          </button>
        ))}
      </nav>
      {tab === "Projects" && <ProjectsTab content={content} onSaved={setContent} />}
      {tab === "Home" && <HomeTab home={content.home} onSaved={setContent} />}
      {tab === "About" && <AboutTab about={content.about} onSaved={setContent} />}
      {tab === "Contacts" && <ContactsTab profile={content.profile} onSaved={setContent} />}
      {tab === "Messages" && <MessagesTab initial={initialMessages} />}
    </div>
  );
}
