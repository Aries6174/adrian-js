"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, endSession, isAdmin, loginLocked, startSession } from "@/lib/auth";
import type { About, HomeCards, Profile, Project, SiteContent } from "@/lib/content";
import {
  deleteMessage,
  listMessages,
  newId,
  readContent,
  saveContent,
  type StoredMessage,
} from "@/lib/store";
import { cleanAbout, cleanHome, cleanProfile, cleanProject } from "@/lib/validate";

export type SaveResult = { content: SiteContent } | { error: string };

export async function login(_previous: string | null, form: FormData) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (loginLocked(ip)) return "Too many attempts. Try again in 15 minutes.";
  if (!checkPassword(String(form.get("password") ?? ""), ip)) return "Wrong password.";
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin");
}

/** Server Actions can be called directly, so each one checks the session itself. */
async function update(change: (content: SiteContent) => SiteContent): Promise<SaveResult> {
  if (!(await isAdmin())) return { error: "Please log in again." };
  try {
    const content = change(await readContent());
    await saveContent(content);
    return { content };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save." };
  }
}

export async function saveProject(input: Partial<Project>) {
  return update((content) => {
    const fields = cleanProject(input);
    const existing = content.projects.find((project) => project.id === input.id);
    return {
      ...content,
      projects: existing
        ? content.projects.map((project) =>
            project.id === existing.id
              ? { ...fields, id: existing.id, createdAt: existing.createdAt, order: existing.order }
              : project,
          )
        : [...content.projects, { ...fields, id: newId(), createdAt: new Date().toISOString() }],
    };
  });
}

export async function removeProject(id: string) {
  return update((content) => ({
    ...content,
    projects: content.projects.filter((project) => project.id !== id),
  }));
}

export async function reorderProjects(ids: string[]) {
  return update((content) => {
    const places = new Map(ids.map((id, index) => [id, index]));
    return {
      ...content,
      projects: content.projects.map((project) => ({ ...project, order: places.get(project.id) })),
    };
  });
}

export async function saveAbout(input: Partial<About>) {
  return update((content) => ({ ...content, about: cleanAbout(input) }));
}

export async function saveProfile(input: Partial<Profile>) {
  return update((content) => ({ ...content, profile: cleanProfile(input) }));
}

export async function saveHome(input: Partial<HomeCards>) {
  return update((content) => ({ ...content, home: cleanHome(input) }));
}

export async function removeMessage(id: string): Promise<StoredMessage[] | null> {
  if (!(await isAdmin())) return null;
  await deleteMessage(id);
  return listMessages();
}
