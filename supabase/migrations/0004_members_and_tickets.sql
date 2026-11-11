-- Members + tickets. Run after 0001, 0002 and 0003 (0003 is optional).
-- If the first statement errors about a transaction, run it alone first, then run the rest.

alter type public.app_role add value if not exists 'member';

alter table public.tasks add column if not exists created_by_name text not null default '';

-- ---------- helpers (security definer, so policies never recurse) ----------
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_app_role()::text = 'member', false) $$;

create or replace function public.owns_task(t uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_member() and exists (select 1 from public.tasks where id = t and created_by = auth.uid()) $$;

create or replace function public.owns_assignment(a uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_member() and exists (
  select 1 from public.task_assignments ta join public.tasks t on t.id = ta.task_id
  where ta.id = a and t.created_by = auth.uid()) $$;

-- ---------- members can work with the tasks they create ----------
drop policy if exists "profiles member read interns" on public.profiles;
create policy "profiles member read interns" on public.profiles for select to authenticated
using (public.is_member() and role::text = 'intern');

drop policy if exists "task member read own" on public.tasks;
create policy "task member read own" on public.tasks for select to authenticated
using (public.is_member() and created_by = auth.uid());
drop policy if exists "task member insert" on public.tasks;
create policy "task member insert" on public.tasks for insert to authenticated
with check (public.is_member() and created_by = auth.uid());
drop policy if exists "task member update own" on public.tasks;
create policy "task member update own" on public.tasks for update to authenticated
using (public.is_member() and created_by = auth.uid()) with check (public.is_member() and created_by = auth.uid());
drop policy if exists "task member delete own" on public.tasks;
create policy "task member delete own" on public.tasks for delete to authenticated
using (public.is_member() and created_by = auth.uid());

drop policy if exists "assignment member read" on public.task_assignments;
create policy "assignment member read" on public.task_assignments for select to authenticated
using (public.owns_task(task_id));
drop policy if exists "assignment member insert" on public.task_assignments;
create policy "assignment member insert" on public.task_assignments for insert to authenticated
with check (public.owns_task(task_id) and exists (select 1 from public.profiles p where p.id = intern_id and p.role::text = 'intern'));
drop policy if exists "assignment member update" on public.task_assignments;
create policy "assignment member update" on public.task_assignments for update to authenticated
using (public.owns_task(task_id)) with check (public.owns_task(task_id));

drop policy if exists "submission member read" on public.submissions;
create policy "submission member read" on public.submissions for select to authenticated
using (public.owns_assignment(assignment_id));

drop policy if exists "feedback member read" on public.feedback;
create policy "feedback member read" on public.feedback for select to authenticated
using (public.owns_assignment(assignment_id));
drop policy if exists "feedback member insert" on public.feedback;
create policy "feedback member insert" on public.feedback for insert to authenticated
with check (public.owns_assignment(assignment_id) and admin_id = auth.uid());

drop policy if exists "member read submission objects" on storage.objects;
create policy "member read submission objects" on storage.objects for select to authenticated
using (bucket_id = 'intern-submissions' and case
  when (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$' then public.owns_assignment(((storage.foldername(name))[2])::uuid)
  else false end);

-- The intern status guard from 0002 must let task owners (members) review work.
create or replace function public.guard_assignment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() or public.owns_task(new.task_id) then return new; end if;
  if new.task_id <> old.task_id or new.intern_id <> old.intern_id or new.created_at <> old.created_at then
    raise exception 'Assignment identity cannot be changed';
  end if;
  if new.status = old.status then return new; end if;
  if (old.status, new.status) in (('assigned','in_progress'),('revision_requested','in_progress')) then return new; end if;
  if old.status = 'in_progress' and new.status = 'submitted' then
    if not exists (select 1 from public.submissions s where s.assignment_id = new.id) then
      raise exception 'Upload a ZIP before submitting';
    end if;
    return new;
  end if;
  raise exception 'Status change from % to % is not allowed', old.status, new.status;
end $$;

-- Discussion threads (only if 0003 was applied)
do $$ begin
  if to_regclass('public.comments') is not null then
    execute 'drop policy if exists "comments member read" on public.comments';
    execute 'create policy "comments member read" on public.comments for select to authenticated using (public.owns_assignment(assignment_id))';
    execute 'drop policy if exists "comments member insert" on public.comments';
    execute 'create policy "comments member insert" on public.comments for insert to authenticated
      with check (author_id = auth.uid() and author_role = public.current_app_role() and public.owns_assignment(assignment_id))';
  end if;
end $$;

-- ---------- tickets: raised by admins, worked on by selected members / interns ----------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  application text not null check (char_length(application) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  kind text not null default 'bug' check (kind in ('bug','improvement','feature','build')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  reference_url text,
  due_date date,
  created_by uuid not null references public.profiles(id),
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ticket_assignees (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null default '',
  user_role text not null default 'intern',
  primary key (ticket_id, user_id)
);
create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default '',
  author_role text not null default 'intern',
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_assignees_user on public.ticket_assignees(user_id);
create index if not exists idx_ticket_comments_ticket on public.ticket_comments(ticket_id, created_at);
create index if not exists idx_tickets_created on public.tickets(created_at desc);

create or replace function public.is_ticket_assignee(t uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.ticket_assignees where ticket_id = t and user_id = auth.uid()) $$;

alter table public.tickets enable row level security;
alter table public.ticket_assignees enable row level security;
alter table public.ticket_comments enable row level security;

drop policy if exists "tickets read" on public.tickets;
create policy "tickets read" on public.tickets for select to authenticated using (public.is_admin() or public.is_ticket_assignee(id));
drop policy if exists "tickets admin insert" on public.tickets;
create policy "tickets admin insert" on public.tickets for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
drop policy if exists "tickets update" on public.tickets;
create policy "tickets update" on public.tickets for update to authenticated
using (public.is_admin() or public.is_ticket_assignee(id)) with check (public.is_admin() or public.is_ticket_assignee(id));
drop policy if exists "tickets admin delete" on public.tickets;
create policy "tickets admin delete" on public.tickets for delete to authenticated using (public.is_admin());

drop policy if exists "ticket assignees read" on public.ticket_assignees;
create policy "ticket assignees read" on public.ticket_assignees for select to authenticated using (public.is_admin() or public.is_ticket_assignee(ticket_id));
drop policy if exists "ticket assignees admin write" on public.ticket_assignees;
create policy "ticket assignees admin write" on public.ticket_assignees for insert to authenticated with check (public.is_admin());
drop policy if exists "ticket assignees admin delete" on public.ticket_assignees;
create policy "ticket assignees admin delete" on public.ticket_assignees for delete to authenticated using (public.is_admin());

drop policy if exists "ticket comments read" on public.ticket_comments;
create policy "ticket comments read" on public.ticket_comments for select to authenticated using (public.is_admin() or public.is_ticket_assignee(ticket_id));
drop policy if exists "ticket comments insert" on public.ticket_comments;
create policy "ticket comments insert" on public.ticket_comments for insert to authenticated
with check (author_id = auth.uid() and (public.is_admin() or public.is_ticket_assignee(ticket_id)));
drop policy if exists "ticket comments admin delete" on public.ticket_comments;
create policy "ticket comments admin delete" on public.ticket_comments for delete to authenticated using (public.is_admin());

-- Assignees may only move a ticket between open / in_progress / resolved; only admins edit anything else or close it.
create or replace function public.guard_ticket_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is null or public.is_admin() then return new; end if;
  if (new.application, new.title, new.description, new.kind, new.priority, new.reference_url, new.due_date, new.created_by)
     is distinct from (old.application, old.title, old.description, old.kind, old.priority, old.reference_url, old.due_date, old.created_by) then
    raise exception 'Only admins can edit ticket details';
  end if;
  if old.status = 'closed' then raise exception 'This ticket is closed'; end if;
  if new.status not in ('open','in_progress','resolved') then raise exception 'Only admins can close tickets'; end if;
  return new;
end $$;
drop trigger if exists guard_ticket_update on public.tickets;
create trigger guard_ticket_update before update on public.tickets for each row execute procedure public.guard_ticket_update();

-- To make an existing user a member (run separately, after the enum value exists):
-- update public.profiles set role = 'member' where email = 'person@example.com';
