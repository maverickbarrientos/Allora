-- 027_messages_vendor_account: my_conversations() also says whether the vendor
-- has an account (docs/SPEC-messages.md). A seeded vendor has no owner, so
-- nobody reads messages sent to them; the conversation page warns the customer.
-- Run after 025_messages.sql. Safe to run more than once.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

drop function if exists public.my_conversations();
create function public.my_conversations()
returns table (
  id                 uuid,
  other_name         text,
  category           text,
  open               boolean,
  last_body          text,
  last_created_at    timestamptz,
  last_mine          boolean,
  last_message_at    timestamptz,
  unread             integer,
  vendor_has_account boolean
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
         public.conversation_unread(c.id),
         v.owner is not null
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

revoke execute on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;
