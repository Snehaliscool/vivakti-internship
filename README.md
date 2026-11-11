# Vivakti Internship Workspace

A standalone internship task-management portal for Vivakti. React + TypeScript frontend, Supabase Auth/Postgres/Storage backend, deployable through GitHub to Cloudflare Pages.

## Try it instantly (no setup)
```bash
npm install
npm run dev
```
With no Supabase keys configured, the app opens in **demo mode** with sample interns, tasks, submissions and feedback. You can explore both the admin and intern views; data stays in your browser.

## Roles
| Role | What they can do |
|---|---|
| **Admin** | Everything: create and edit any task, review any submission, invite interns and members, raise and manage **tickets**. Set up manually in SQL. |
| **Member** | Give tasks to selected interns, review those interns' submissions, and work on tickets assigned to them. Admins can edit or review a member's tasks too. |
| **Intern** | Receive tasks, submit ZIP work, and work on tickets assigned to them. |

**Tickets** are for building and improving other applications: bugs, improvements, features and build tasks, each tied to an application name. Admins raise a ticket and assign it to chosen members and interns; assignees update the status (open, in progress, resolved) and discuss in a thread; only admins can edit details or close a ticket.

## Features
- Separate admin and intern experiences, enforced by PostgreSQL RLS.
- Invite-only intern onboarding (admin-only Supabase Edge Function).
- Project, website-reading, YouTube and general task assignments.
- Due dates, priorities, assignment status and ZIP submissions (50 MB cap).
- Admin review, approval and revision feedback.
- Private Supabase Storage bucket and short-lived signed downloads.
- Responsive white / black / orange interface.
- Task detail drawer, search, filters and sorting, overdue / due-soon cues, and progress tracking.
- Revision loop: interns see feedback, start a revision and resubmit; full activity timeline per task.
- Invite and password-reset flows (set a password after accepting an invite).
- Dark mode, Ctrl/Cmd+K quick search, notifications bell, deadline calendar, intern detail pages, CSV export and per-task discussion threads.
- Built-in demo mode, keyboard-accessible dialogs, toasts and loading skeletons.

## Stack
- React, TypeScript, Vite, Tailwind CSS
- Supabase Auth, PostgreSQL, Storage, Edge Functions
- Cloudflare Pages hosting; GitHub source control

## 1. Create Supabase project
Create a free project at https://supabase.com. In Project Settings → API, copy the Project URL and `anon`/publishable key.

```bash
cp .env.example .env.local
```
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.

## 2. Create database and first admin
1. Open Supabase → SQL Editor.
2. Run `supabase/migrations/0001_initial_schema.sql`.
3. In Supabase → Authentication → Users, create the first user with your admin email and password.
4. Run this in SQL Editor, replacing the email:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

The profile trigger assigns all newly registered/invited users the `intern` role. The admin role must only be granted manually by the project owner in SQL Editor.

### 2b. Run the hardening migration
Also run `supabase/migrations/0002_hardening.sql`. It enforces allowed status transitions for interns (e.g. an approved task cannot be reopened, and "submitted" requires an uploaded ZIP), lets admins clean up stored files, and adds indexes.

### 2c. Run the comments migration (optional but recommended)
Run `supabase/migrations/0003_comments.sql` to enable per-task discussion threads between admins and interns. The app keeps working without it; threads simply won't save until it's applied.

### 2d. Members and tickets
Run `supabase/migrations/0004_members_and_tickets.sql`, then redeploy the invite function (`npx supabase functions deploy create-intern`) so admins can invite members. To turn an existing user into a member:
```sql
update public.profiles set role = 'member' where email = 'person@example.com';
```

In Supabase → Authentication → URL Configuration, set the Site URL and add your Cloudflare Pages domain to Redirect URLs so invite and password-reset links return to the app.

## 3. Configure intern invitations
Install Supabase CLI and link the project:
```bash
npm install
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
npx supabase secrets set SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
npx supabase secrets set APP_ORIGIN=https://YOUR_CLOUDFLARE_PAGES_DOMAIN
npx supabase functions deploy create-intern
```
Use the service-role key only as an Edge Function secret. Never put it in `.env.local`, GitHub, or frontend code.

## 4. Run locally
```bash
npm install
npm run dev
```
Open the Vite URL shown in the terminal.

## 5. Push to a separate GitHub repository
Create a new empty repository named `vivakti-internship` on GitHub, then:
```bash
git init
git add .
git commit -m "Initial Vivakti internship workspace"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/vivakti-internship.git
git push -u origin main
```

## 6. Deploy frontend to Cloudflare Pages
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Select `vivakti-internship`.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Deploy.

For SPA routing, this app uses client-side conditional views and does not require custom rewrite rules.

## Security notes
- RLS policies are in the SQL migration; do not disable RLS.
- Supabase anon key is intended for browser use only when RLS is correctly configured.
- Service-role key belongs only in Edge Function secrets.
- Interns cannot self-select admin role; profile trigger always assigns `intern`.
- ZIP storage is private, with per-user folder policies and signed download URLs.
- The browser checks `.zip` extension and 50 MB size; storage bucket enforces the size and MIME type. For stronger file safety, scan uploaded archives before processing or extracting them.
- Configure Supabase Auth email/SMTP and allowed redirect URLs before inviting real interns.
