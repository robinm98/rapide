-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run)

create table if not exists rooms (
  code text primary key,
  host_id uuid not null,
  config jsonb not null,
  state jsonb not null default '{}'::jsonb,
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Allow public read so players can see room state via the browser client
alter table rooms enable row level security;

create policy "rooms are readable by anyone"
  on rooms for select
  using (true);

-- Enable realtime so the browser subscribes to UPDATEs
alter publication supabase_realtime add table rooms;

-- Auto-delete rooms older than 24h (optional, clean housekeeping)
create or replace function delete_old_rooms() returns void as $$
  delete from rooms where created_at < now() - interval '24 hours';
$$ language sql;
