-- Fix tasks RLS so the Daily Tasks feature works for every role.
--
-- Before this migration:
--   INSERT  only agent/counselor/admin  -> students could not create tasks
--   UPDATE  only assignee or counselor/admin -> creators could not toggle their own tasks
--   DELETE  no policy -> nobody could delete anything
--
-- After: any authenticated user manages their own tasks; staff keep broader powers.

drop policy if exists tsk_ins on public.tasks;
create policy tsk_ins on public.tasks
  for insert
  with check (
    created_by = auth.uid()
    or get_my_role() = any (array['agent','counselor','admin'])
  );

drop policy if exists tsk_upd on public.tasks;
create policy tsk_upd on public.tasks
  for update
  using (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or get_my_role() = any (array['counselor','admin'])
  );

drop policy if exists tsk_del on public.tasks;
create policy tsk_del on public.tasks
  for delete
  using (
    created_by = auth.uid()
    or get_my_role() = 'admin'
  );
