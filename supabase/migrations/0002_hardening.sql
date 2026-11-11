-- Hardening + performance. Run after 0001 in the Supabase SQL Editor.

-- 1. Interns may only move their own assignment along the intended path:
--    assigned -> in_progress -> submitted, and revision_requested -> in_progress.
--    A submission must exist before an assignment can be marked submitted.
--    Admins (and the SQL editor / service role, where auth.uid() is null) are unrestricted.
create or replace function public.guard_assignment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
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

drop trigger if exists guard_assignment_update on public.task_assignments;
create trigger guard_assignment_update before update on public.task_assignments
for each row execute procedure public.guard_assignment_update();

-- 2. Admins can remove stored files (used when a task is deleted or a bad upload is rejected).
drop policy if exists "admin delete submission objects" on storage.objects;
create policy "admin delete submission objects" on storage.objects for delete to authenticated
using (bucket_id = 'intern-submissions' and public.is_admin());

-- 3. Indexes on the foreign keys the app filters and joins on.
create index if not exists idx_assignments_intern on public.task_assignments(intern_id);
create index if not exists idx_assignments_task on public.task_assignments(task_id);
create index if not exists idx_submissions_assignment on public.submissions(assignment_id);
create index if not exists idx_feedback_assignment on public.feedback(assignment_id);
create index if not exists idx_tasks_created on public.tasks(created_at desc);
