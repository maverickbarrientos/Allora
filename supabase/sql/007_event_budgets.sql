-- 007_event_budgets: a budget per service for an event. Safe to run more than once.
-- Run after 006 (events.name) and 004. Needs public.current_user_role() from 001.
-- Run in Supabase -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.event_budgets (
  event_id   uuid not null references public.events (id) on delete cascade,
  category   text not null,
  amount     numeric not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (event_id, category)
);

alter table public.event_budgets enable row level security;
revoke all on public.event_budgets from anon;

-- Owner of the event only. Vendors have no access.
drop policy if exists "event_budgets: read own" on public.event_budgets;
create policy "event_budgets: read own"
  on public.event_budgets for select
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid())));

drop policy if exists "event_budgets: insert own" on public.event_budgets;
create policy "event_budgets: insert own"
  on public.event_budgets for insert
  to authenticated
  with check (
    (select public.current_user_role()) = 'customer'
    and exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid()))
  );

drop policy if exists "event_budgets: update own" on public.event_budgets;
create policy "event_budgets: update own"
  on public.event_budgets for update
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid())))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid())));

drop policy if exists "event_budgets: delete own" on public.event_budgets;
create policy "event_budgets: delete own"
  on public.event_budgets for delete
  to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner = (select auth.uid())));

-- Trigger 1: the sum of an event's service budgets never exceeds the event budget.
-- Locks the event row first, so two requests for the same event run one at a time.
-- Runs with the caller's rights (not security definer).
create or replace function public.check_event_budget_allocation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_budget numeric;
  v_others numeric;
begin
  select e.budget into v_budget from public.events e where e.id = new.event_id for update;
  if v_budget is null then
    raise exception 'event_not_found';
  end if;

  if tg_op = 'INSERT' then
    select coalesce(sum(b.amount), 0) into v_others
    from public.event_budgets b
    where b.event_id = new.event_id and b.category <> new.category;
  else
    -- Everything except the row being replaced (old) and the row being written (new).
    select coalesce(sum(b.amount), 0) into v_others
    from public.event_budgets b
    where b.event_id = new.event_id
      and b.category <> new.category
      and not (b.event_id = old.event_id and b.category = old.category);
  end if;

  if v_others + new.amount > v_budget then
    raise exception 'over_allocated';
  end if;
  return new;
end;
$$;

drop trigger if exists event_budgets_check_allocation on public.event_budgets;
create trigger event_budgets_check_allocation
  before insert or update on public.event_budgets
  for each row execute function public.check_event_budget_allocation();

-- Trigger 2: the event budget can't drop below what is already allocated.
create or replace function public.check_event_budget_not_below_allocations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sum numeric;
begin
  select coalesce(sum(b.amount), 0) into v_sum
  from public.event_budgets b where b.event_id = new.id;
  if new.budget < v_sum then
    raise exception 'budget_below_allocations';
  end if;
  return new;
end;
$$;

drop trigger if exists events_check_budget_not_below_allocations on public.events;
create trigger events_check_budget_not_below_allocations
  before update of budget on public.events
  for each row
  when (new.budget is distinct from old.budget)
  execute function public.check_event_budget_not_below_allocations();

-- Apply a list of service budgets in ONE transaction (a function call is one
-- transaction): all of it applies or none of it does. security invoker, so RLS
-- and the triggers above apply. p_entries: [{ "category": text, "amount": number | null }].
-- Clears run first, then the rest in order of change (smallest first), so moving money
-- between services never trips the limit part-way through.
create or replace function public.set_event_budgets(p_event_id uuid, p_entries jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'invalid_entries';
  end if;

  delete from public.event_budgets b
  where b.event_id = p_event_id
    and b.category in (
      select x ->> 'category'
      from jsonb_array_elements(p_entries) x
      where jsonb_typeof(x -> 'amount') = 'null' or (x -> 'amount') is null
    );

  for r in
    select x ->> 'category' as category, (x ->> 'amount')::numeric as amount
    from jsonb_array_elements(p_entries) x
    where jsonb_typeof(x -> 'amount') = 'number'
    order by (x ->> 'amount')::numeric - coalesce(
      (select b.amount from public.event_budgets b
        where b.event_id = p_event_id and b.category = x ->> 'category'), 0)
  loop
    insert into public.event_budgets (event_id, category, amount)
    values (p_event_id, r.category, r.amount)
    on conflict (event_id, category) do update set amount = excluded.amount;
  end loop;
end;
$$;

revoke execute on function public.set_event_budgets(uuid, jsonb) from public, anon;
grant execute on function public.set_event_budgets(uuid, jsonb) to authenticated;
