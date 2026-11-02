import "server-only";

import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { connection } from "next/server";
import { cache } from "react";
import { DEFAULT_CONTENT, type SiteContent } from "./content";

export type StoredMessage = {
  id: string;
  name: string;
  email: string;
  body: string;
  emailed: boolean;
  createdAt: string;
};

type Media = { type: string; bytes: Uint8Array };

type Driver = {
  readContent(): Promise<string | null>;
  writeContent(json: string): Promise<void>;
  addMedia(id: string, type: string, bytes: Uint8Array, createdAt: string): Promise<void>;
  getMedia(id: string): Promise<Media | null>;
  pruneMedia(keep: string[], olderThan: string): Promise<void>;
  addMessage(message: StoredMessage): Promise<void>;
  listMessages(): Promise<StoredMessage[]>;
  deleteMessage(id: string): Promise<void>;
};

const MESSAGE_LIMIT = 500;

/** Local file database: the default, for running on your own machine or a server with a disk. */
async function sqliteDriver(): Promise<Driver> {
  const { DatabaseSync } = await import("node:sqlite");
  const dir = process.env.SITE_DATA_DIR || path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "site.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS site (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, body TEXT NOT NULL, emailed INTEGER NOT NULL, created_at TEXT NOT NULL);
  `);
  return {
    async readContent() {
      const row = db.prepare("SELECT value FROM site WHERE id = 'content'").get() as { value: string } | undefined;
      return row?.value ?? null;
    },
    async writeContent(json) {
      db.prepare("INSERT INTO site (id, value) VALUES ('content', ?) ON CONFLICT (id) DO UPDATE SET value = excluded.value").run(json);
    },
    async addMedia(id, type, bytes, createdAt) {
      db.prepare("INSERT INTO media (id, type, bytes, created_at) VALUES (?, ?, ?, ?)").run(id, type, bytes, createdAt);
    },
    async getMedia(id) {
      const row = db.prepare("SELECT type, bytes FROM media WHERE id = ?").get(id) as Media | undefined;
      return row ? { type: row.type, bytes: row.bytes } : null;
    },
    async pruneMedia(keep, olderThan) {
      const rows = db.prepare("SELECT id FROM media WHERE created_at < ?").all(olderThan) as { id: string }[];
      for (const { id } of rows) {
        if (!keep.includes(id)) db.prepare("DELETE FROM media WHERE id = ?").run(id);
      }
    },
    async addMessage(message) {
      db.prepare("INSERT INTO messages (id, name, email, body, emailed, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        message.id,
        message.name,
        message.email,
        message.body,
        message.emailed ? 1 : 0,
        message.createdAt,
      );
      db.prepare("DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY created_at DESC LIMIT ?)").run(MESSAGE_LIMIT);
    },
    async listMessages() {
      const rows = db.prepare("SELECT id, name, email, body, emailed, created_at FROM messages ORDER BY created_at DESC").all() as {
        id: string;
        name: string;
        email: string;
        body: string;
        emailed: number;
        created_at: string;
      }[];
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        body: row.body,
        emailed: Boolean(row.emailed),
        createdAt: row.created_at,
      }));
    },
    async deleteMessage(id) {
      db.prepare("DELETE FROM messages WHERE id = ?").run(id);
    },
  };
}

/** Hosted database: used whenever DATABASE_URL is set, as hosts like Vercel have no lasting disk. */
async function postgresDriver(url: string): Promise<Driver> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, { max: 3, prepare: false, onnotice: () => {} });
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS site (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT NOT NULL, bytes BYTEA NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, body TEXT NOT NULL, emailed BOOLEAN NOT NULL, created_at TEXT NOT NULL);
  `);
  return {
    async readContent() {
      const rows = await sql`SELECT value FROM site WHERE id = 'content'`;
      return (rows[0]?.value as string | undefined) ?? null;
    },
    async writeContent(json) {
      await sql`INSERT INTO site (id, value) VALUES ('content', ${json}) ON CONFLICT (id) DO UPDATE SET value = excluded.value`;
    },
    async addMedia(id, type, bytes, createdAt) {
      await sql`INSERT INTO media (id, type, bytes, created_at) VALUES (${id}, ${type}, ${Buffer.from(bytes)}, ${createdAt})`;
    },
    async getMedia(id) {
      const rows = await sql`SELECT type, bytes FROM media WHERE id = ${id}`;
      return rows[0] ? { type: rows[0].type as string, bytes: rows[0].bytes as Uint8Array } : null;
    },
    async pruneMedia(keep, olderThan) {
      const rows = await sql`SELECT id FROM media WHERE created_at < ${olderThan}`;
      for (const { id } of rows) {
        if (!keep.includes(id as string)) await sql`DELETE FROM media WHERE id = ${id as string}`;
      }
    },
    async addMessage(message) {
      await sql`INSERT INTO messages (id, name, email, body, emailed, created_at) VALUES (${message.id}, ${message.name}, ${message.email}, ${message.body}, ${message.emailed}, ${message.createdAt})`;
      await sql`DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY created_at DESC LIMIT ${MESSAGE_LIMIT})`;
    },
    async listMessages() {
      const rows = await sql`SELECT id, name, email, body, emailed, created_at FROM messages ORDER BY created_at DESC`;
      return rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        email: row.email as string,
        body: row.body as string,
        emailed: row.emailed as boolean,
        createdAt: row.created_at as string,
      }));
    },
    async deleteMessage(id) {
      await sql`DELETE FROM messages WHERE id = ${id}`;
    },
  };
}

const holder = globalThis as unknown as { __siteDriver?: Promise<Driver> };

function driver() {
  if (!holder.__siteDriver) {
    const url = process.env.DATABASE_URL;
    holder.__siteDriver =
      !url && process.env.VERCEL
        ? Promise.reject(new Error("Set DATABASE_URL in your host's settings to save changes."))
        : url
          ? postgresDriver(url)
          : sqliteDriver();
    // A failed connection must be retried on the next request rather than cached forever.
    holder.__siteDriver.catch(() => {
      holder.__siteDriver = undefined;
    });
  }
  return holder.__siteDriver;
}

export function newId() {
  return randomBytes(12).toString("hex");
}

/** The public site keeps working from the built-in content if the database is unreachable. */
export async function readContent(): Promise<SiteContent> {
  try {
    const json = await (await driver()).readContent();
    if (!json) return DEFAULT_CONTENT;
    return { ...DEFAULT_CONTENT, ...(JSON.parse(json) as Partial<SiteContent>) };
  } catch (error) {
    console.error("Could not read site content, using the defaults.", error);
    return DEFAULT_CONTENT;
  }
}

/** For Server Components: runs at request time so edits show up without a rebuild. */
export const loadContent = cache(async () => {
  await connection();
  return readContent();
});

export async function saveContent(content: SiteContent) {
  const store = await driver();
  const json = JSON.stringify(content);
  await store.writeContent(json);
  // Files removed from the site stop being reachable. Recent uploads may not be saved yet.
  const keep = [...json.matchAll(/\/media\/([0-9a-f]+)/g)].map((match) => match[1]);
  await store.pruneMedia(keep, new Date(Date.now() - 3600_000).toISOString());
}

export async function addMedia(type: string, bytes: Uint8Array) {
  const id = newId();
  await (await driver()).addMedia(id, type, bytes, new Date().toISOString());
  return `/media/${id}`;
}

export async function getMedia(id: string) {
  return (await driver()).getMedia(id);
}

export async function addMessage(message: Omit<StoredMessage, "id" | "createdAt">) {
  await (await driver()).addMessage({ ...message, id: newId(), createdAt: new Date().toISOString() });
}

export async function listMessages() {
  return (await driver()).listMessages();
}

export async function deleteMessage(id: string) {
  await (await driver()).deleteMessage(id);
}
