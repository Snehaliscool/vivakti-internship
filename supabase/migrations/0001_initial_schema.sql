-- Vivakti Internship Workspace schema
-- Run this entire file in Supabase SQL Editor as the project owner.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','intern');
create type public.task_status as enum ('assigned','in_progress','submitted','under_review','revision_requested','approved');
create type public.task_kind as enum ('project','website','youtube','general');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.app_role not null default 'intern',
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  task_type public.task_kind not null default 'general',
  resource_url text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  intern_id uuid not null references public.profiles(id) on delete cascade,
  status public.task_status not null default 'assigned',
  created_at timestamptz not null default now(),
  unique(task_id,intern_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.task_assignments(id) on delete cascade,
  intern_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.task_assignments(id) on delete cascade,
  admin_id uuid not null references public.profiles(id),
  message text not null,
  action text not null check (action in ('approved','revision_requested')),
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_app_role() = 'admin', false) $$;

-- Profile creation trigger: all self-created profiles are interns.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, 'intern')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.feedback enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles: interns can read their own profile; admins can read all. Users cannot alter role.
create policy "profile read self or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
-- Profile role changes are intentionally not exposed to authenticated clients.
-- Promote the first admin manually in the SQL Editor as project owner.

-- Tasks are visible to admins and interns assigned to them.
create policy "task read admin or assigned intern" on public.tasks for select to authenticated
using (public.is_admin() or exists(select 1 from public.task_assignments a where a.task_id=id and a.intern_id=auth.uid()));
create policy "task admin insert" on public.tasks for insert to authenticated
with check (public.is_admin() and created_by=auth.uid());
create policy "task admin update" on public.tasks for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "task admin delete" on public.tasks for delete to authenticated using (public.is_admin());

create policy "assignment read own or admin" on public.task_assignments for select to authenticated
using (public.is_admin() or intern_id=auth.uid());
create policy "assignment admin insert" on public.task_assignments for insert to authenticated
with check (public.is_admin() and exists(select 1 from public.profiles p where p.id=intern_id and p.role='intern'));
create policy "assignment status update" on public.task_assignments for update to authenticated
using (public.is_admin() or intern_id=auth.uid())
with check (public.is_admin() or (intern_id=auth.uid() and status in ('in_progress','submitted')));

create policy "submission read own or admin" on public.submissions for select to authenticated
using (public.is_admin() or intern_id=auth.uid());
create policy "submission insert own assigned" on public.submissions for insert to authenticated
with check (intern_id=auth.uid() and exists(select 1 from public.task_assignments a where a.id=assignment_id and a.intern_id=auth.uid() and a.status='in_progress'));
create policy "submission admin delete" on public.submissions for delete to authenticated using (public.is_admin());

create policy "feedback read intern or admin" on public.feedback for select to authenticated
using (public.is_admin() or exists(select 1 from public.task_assignments a where a.id=assignment_id and a.intern_id=auth.uid()));
create policy "feedback admin insert" on public.feedback for insert to authenticated
with check (public.is_admin() and admin_id=auth.uid());

create policy "activity admin read" on public.activity_logs for select to authenticated using (public.is_admin());
create policy "activity insert self" on public.activity_logs for insert to authenticated with check (actor_id=auth.uid());

-- Private bucket; object keys begin with the authenticated intern UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('intern-submissions','intern-submissions',false,52428800,array['application/zip','application/x-zip-compressed'])
on conflict (id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['application/zip','application/x-zip-compressed'];

create policy "intern upload own folder" on storage.objects for insert to authenticated
with check (bucket_id='intern-submissions' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "intern or admin read submission objects" on storage.objects for select to authenticated
using (bucket_id='intern-submissions' and (
  public.is_admin() or (storage.foldername(name))[1]=auth.uid()::text
));
create policy "intern delete own object" on storage.objects for delete to authenticated
using (bucket_id='intern-submissions' and (storage.foldername(name))[1]=auth.uid()::text);

-- Bootstrap the first administrator manually after creating their Auth account:
-- update public.profiles set role='admin' where email='YOUR_ADMIN_EMAIL';
-- Do this only in the Supabase SQL Editor as project owner.
