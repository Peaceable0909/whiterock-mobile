-- Records when a user accepted the Privacy & Company policies at signup.
alter table public.users add column if not exists privacy_accepted_at timestamptz;
