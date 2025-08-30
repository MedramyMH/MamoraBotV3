-- Mamorabot Database Schema for Supabase
-- Run this in your Supabase SQL editor

-- Roles via auth metadata
create table public.user_profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'trader' check (role in ('admin','trader','viewer')),
  created_at timestamptz default now()
);

create table public.strategies (
  id bigserial primary key,
  owner uuid references public.user_profiles(id) on delete set null,
  name text not null,
  params jsonb not null default '{}',
  active boolean default true,
  created_at timestamptz default now()
);

create table public.sessions (
  id bigserial primary key,
  user_id uuid references public.user_profiles(id),
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table public.ticks (
  id bigserial primary key,
  symbol text not null,
  ts timestamptz not null,
  price numeric not null
);
create index on public.ticks(symbol, ts);

create table public.candles (
  id bigserial primary key,
  symbol text not null,
  frame text not null, -- '1s','5s','1m','5m'...
  open numeric, high numeric, low numeric, close numeric,
  ts_open timestamptz not null,
  ts_close timestamptz not null
);
create index on public.candles(symbol, frame, ts_open);

create table public.signals (
  id bigserial primary key,
  symbol text not null,
  strategy_id bigint references public.strategies(id) on delete cascade,
  ts timestamptz not null,
  side text check (side in ('long','short')),
  confidence numeric,
  details jsonb
);
create index on public.signals(strategy_id, ts);

create table public.orders (
  id bigserial primary key,
  symbol text not null,
  ts_submit timestamptz not null,
  ts_ack timestamptz,
  side text check (side in ('buy','sell')),
  qty numeric not null,
  price_limit numeric,
  status text not null default 'submitted' check (status in ('submitted','ack','rejected','filled','cancelled')),
  meta jsonb
);

create table public.trades (
  id bigserial primary key,
  order_id bigint references public.orders(id) on delete cascade,
  symbol text not null,
  ts_fill timestamptz not null,
  price numeric not null,
  qty numeric not null
);

-- RLS Policies
alter table public.user_profiles enable row level security;
alter table public.strategies enable row level security;
alter table public.sessions enable row level security;
alter table public.ticks enable row level security;
alter table public.candles enable row level security;
alter table public.signals enable row level security;
alter table public.orders enable row level security;
alter table public.trades enable row level security;

-- Simple policies (adjust to your needs)
create policy "self profile" on public.user_profiles
  for select using (auth.uid() = id);

create policy "read market data" on public.ticks for select using (true);
create policy "read candles" on public.candles for select using (true);

create policy "own strategies" on public.strategies
  for all using (owner = auth.uid()) with check (owner = auth.uid());

create policy "own sessions" on public.sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read signals" on public.signals for select using (true);
create policy "own orders" on public.orders
  for all using (auth.uid() in (select id from public.user_profiles));

create policy "own trades" on public.trades
  for all using (auth.uid() in (select id from public.user_profiles));

-- Function to automatically create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, role)
  values (new.id, 'trader');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seed Admin User (replace with actual user ID after creating auth user)
-- update public.user_profiles set role = 'admin' where id = '<ADMIN_AUTH_USER_ID>';