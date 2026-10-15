-- 025_messages: conversations and messages between a customer and a vendor
-- (docs/SPEC-messages.md, tickets 20 to 23). Safe to run more than once.
-- Run after 002 (events, vendors, bookings) and 005 (vendor owners).
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

-- A. Tables -------------------------------------------------------------

-- One per customer and vendor, created by the database on the first booking.
create table if not exists public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.profiles (id) on delete cascade,
  vendor_id             uuid not null references public.vendors (id) on delete cascade,
  created_at            timestamptz not null default now(),
  last_message_at       timestamptz,
  customer_last_read_at timestamptz not null default now(),
  vendor_last_read_at   timestamptz not null default now(),
  unique (customer_id, vendor_id)
);
create index if not exists conversations_vendor_idx on public.conversations (vendor_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_time_idx on public.messages (conversation_id, created_at desc);

-- 1 to 2,000 characters, already trimmed (the API trims; this stops anything else).
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_check
  check (char_length(body) between 1 and 2000 and body !~ '^\s' and body !~ '\s$');

-- B. Helpers (security definer: vendors can't read events or profiles) ----

-- True when the caller is in the conversation.
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.vendors v on v.id = c.vendor_id
    where c.id = p_conversation_id
      and (c.customer_id = (select auth.uid()) or v.owner = (select auth.uid()))
  )
$$;

-- Open while the pair has a pending or confirmed booking on any of the
-- customer's events. False for anyone outside the conversation.
create or replace function public.conversation_is_open(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_conversation_participant(p_conversation_id) and exists (
    select 1
    from public.conversations c
    join public.events e on e.owner = c.customer_id
    join public.bookings b on b.event_id = e.id and b.vendor_id = c.vendor_id
    where c.id = p_conversation_id
      and b.status in ('pending', 'confirmed')
  )
$$;

-- Unread for the caller: messages from the other side after the caller's read time.
create or replace function public.conversation_unread(p_conversation_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.conversations c
  join public.messages m on m.conversation_id = c.id
  where c.id = p_conversation_id
    and public.is_conversation_participant(c.id)
    and m.sender_id <> (select auth.uid())
    and m.created_at > case when c.customer_id = (select auth.uid())
                            then c.customer_last_read_at
                            else c.vendor_last_read_at end
$$;

-- Marks the conversation read for the caller only; the other side's read time can't be touched.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.conversations c
  set customer_last_read_at = now()
  where c.id = p_conversation_id and c.customer_id = (select auth.uid());
  if found then return; end if;

  update public.conversations c
  set vendor_last_read_at = now()
  where c.id = p_conversation_id
    and exists (select 1 from public.vendors v where v.id = c.vendor_id and v.owner = (select auth.uid()));
  if not found then
    raise exception 'conversation_not_found';
  end if;
end;
$$;

-- The caller's conversations with what the inbox and the conversation page
-- need. Never returns emails, profile ids or owner ids.
drop function if exists public.my_conversations();
create function public.my_conversations()
returns table (
  id              uuid,
  other_name      text,
  category        text,
  open            boolean,
  last_body       text,
  last_created_at timestamptz,
  last_mine       boolean,
  last_message_at timestamptz,
  unread          integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         case when c.customer_id = (select auth.uid()) then v.name else coalesce(p.name, '') end,
         v.category,
         public.conversation_is_open(c.id),
         lm.body,
         lm.created_at,
         lm.sender_id = (select auth.uid()),
         c.last_message_at,
         public.conversation_unread(c.id)
  from public.conversations c
  join public.vendors v on v.id = c.vendor_id
  left join public.profiles p on p.id = c.customer_id
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where c.customer_id = (select auth.uid()) or v.owner = (select auth.uid())
  order by coalesce(c.last_message_at, c.created_at) desc
$$;

-- Each of the caller's bookings with its conversation, for the Message links.
drop function if exists public.my_booking_conversations();
create function public.my_booking_conversations()
returns table (booking_id uuid, conversation_id uuid, unread integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, c.id, public.conversation_unread(c.id)
  from public.bookings b
  join public.events e on e.id = b.event_id
  join public.vendors v on v.id = b.vendor_id
  join public.conversations c on c.customer_id = e.owner and c.vendor_id = b.vendor_id
  where e.owner = (select auth.uid()) or v.owner = (select auth.uid())
$$;

revoke execute on function public.is_conversation_participant(uuid) from public, anon;
revoke execute on function public.conversation_is_open(uuid) from public, anon;
revoke execute on function public.conversation_unread(uuid) from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.my_booking_conversations() from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.conversation_is_open(uuid) to authenticated;
grant execute on function public.conversation_unread(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.my_booking_conversations() to authenticated;

-- C. Row Level Security --------------------------------------------------

alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;
-- No insert, update or delete for anyone in the browser: the triggers and
-- mark_conversation_read do those.

drop policy if exists "conversations: participants read" on public.conversations;
create policy "conversations: participants read"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_participant(id));

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
-- Only these columns: created_at always comes from the database, so nobody
-- can backdate a message.
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
-- No update or delete: messages can't be edited or unsent.

drop policy if exists "messages: participants read" on public.messages;
create policy "messages: participants read"
  on public.messages for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "messages: participants send while open" on public.messages;
create policy "messages: participants send while open"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.conversation_is_open(conversation_id)
  );

-- D. Triggers ------------------------------------------------------------

-- The first booking between a customer and a vendor creates their conversation.
create or replace function public.create_conversation_for_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversations (customer_id, vendor_id)
  select e.owner, new.vendor_id
  from public.events e
  where e.id = new.event_id
  on conflict (customer_id, vendor_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.create_conversation_for_booking() from public, anon, authenticated;

drop trigger if exists bookings_create_conversation on public.bookings;
create trigger bookings_create_conversation
  after insert on public.bookings
  for each row execute function public.create_conversation_for_booking();

-- Keeps conversations.last_message_at for the inbox order.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
revoke execute on function public.touch_conversation_on_message() from public, anon, authenticated;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- E. Backfill: a conversation for every customer and vendor who already have a booking.
insert into public.conversations (customer_id, vendor_id)
select distinct e.owner, b.vendor_id
from public.bookings b
join public.events e on e.id = b.event_id
on conflict (customer_id, vendor_id) do nothing;
