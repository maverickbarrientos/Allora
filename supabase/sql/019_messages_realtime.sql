-- 019_messages_realtime: new messages are sent to open conversations instantly
-- (docs/SPEC-messages.md, ticket 21). Run after 018_messages.sql. Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.
--
-- Supabase Realtime sends each insert only to subscribers allowed to read the
-- row, using the "messages: participants read" policy from 018. Nobody else
-- receives anything. Only messages are published; conversations are not.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Logged-out listeners: without SELECT, Realtime still sends them an empty
-- event for every insert (no content, but it shows that something was sent).
-- With SELECT, Realtime checks RLS instead, and no policy is for anon, so they get nothing.
grant select on public.messages to anon;
-- Never add a messages read policy that applies to everyone (`to public`, `using (true)`): with this
-- grant it would expose messages to logged-out users. Keep a logged-out read check in the tests.
