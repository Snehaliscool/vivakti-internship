-- Task discussion threads. Run after 0001 and 0002.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.task_assignments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default '',
  author_role public.app_role not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_assignment on public.comments(assignment_id, created_at);
alter table public.comments enable row level security;

drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select to authenticated
using (public.is_admin() or exists (select 1 from public.task_assignments a where a.id = assignment_id and a.intern_id = auth.uid()));

drop policy if exists "comments insert" on public.comments;
create policy "comments insert" on public.comments for insert to authenticated
with check (
  author_id = auth.uid()
  and author_role = public.current_app_role()
  and (public.is_admin() or exists (select 1 from public.task_assignments a where a.id = assignment_id and a.intern_id = auth.uid()))
);

drop policy if exists "comments admin delete" on public.comments;
create policy "comments admin delete" on public.comments for delete to authenticated using (public.is_admin());
