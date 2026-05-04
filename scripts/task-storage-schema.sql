do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'task-attachments'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('task-attachments', 'task-attachments', true, 52428800);
  end if;
end $$;
