# ADRIAN.JS

Portfolio built with Next.js and Three.js.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. For the production version, run `npm run build` then `npm run start`.
Node 22.5 or newer is required.

## Settings

Copy `.env.example` to `.env.local` and fill it in. Restart the server after changing it.

| Setting | What it does |
| --- | --- |
| `ADMIN_PASSWORD` | Password for `/admin`. Admin stays locked until this is set. |
| `RESEND_API_KEY` | Emails contact form messages to you through [Resend](https://resend.com). Without it, messages only go to the admin inbox. |
| `MAIL_FROM` | Sender address for those emails. Needs a domain verified in Resend. |
| `DATABASE_URL` | Postgres connection. Required on hosts with no lasting disk, such as Vercel. |

## Admin

Go to `/admin` to manage projects, the About page, contacts and your resume, and to read contact messages. It isn't linked anywhere on the site.

## Where content is stored

With no `DATABASE_URL`, everything is saved in a local SQLite file at `data/site.db`, which is not committed. Back it up if you rely on it. With `DATABASE_URL`, the same tables are created in Postgres on first use.

Until something is saved from admin, the site shows the content in `lib/content.ts`. Saving copies that content to the database, so moving to a new database starts from these defaults again.

## Going live on Vercel

1. Push this project to a GitHub repository.
2. Create a free Postgres database, for example on [Neon](https://neon.tech), and copy its connection string.
3. Import the repository at [vercel.com/new](https://vercel.com/new).
4. Under Environment Variables, add `DATABASE_URL`, `ADMIN_PASSWORD` (at least 16 characters) and `RESEND_API_KEY`, then deploy.
5. Open `/admin`, log in and check each tab. Your local `data/site.db` isn't copied, so edits made locally need repeating.

Once you have your own domain, verify it in Resend and set `MAIL_FROM` to an address on it.

## Credits

The figures in `public/models` are posed from [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) avatars, used under the MIT License. The notice is kept in `public/models/LICENSE-Rocketbox.md`.
