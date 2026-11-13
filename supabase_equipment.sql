-- =========================================================
-- AJPLUS Company Management: Vifaa (Equipment / Assets register)
-- Endesha SQL hii kwenye Supabase SQL Editor (project: veptsbhbvmxpefmivmqc)
-- Inahitaji: jedwali service_lines, users, na function current_user_role()
-- =========================================================

create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'nyingine'
    check (category in ('mawasiliano','cctv','usafiri','ulinzi','silaha','usafi','ofisi','media','nyingine')),
  serial_number text,
  service_line_id uuid references service_lines(id),
  location text,
  assigned_to text,
  status text not null default 'active'
    check (status in ('active','maintenance','damaged','lost','retired')),
  purchase_date date,
  purchase_cost numeric(14,2),
  next_service_date date,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_status_idx on equipment (status);
create index if not exists equipment_service_line_idx on equipment (service_line_id);

alter table equipment enable row level security;

-- Kusoma: MD, Admin, FAO, Supervisor
drop policy if exists "equipment_select" on equipment;
create policy "equipment_select"
  on equipment for select
  to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin','fao','supervisor']));

-- Kuongeza na kuhariri: MD, Admin, Supervisor
drop policy if exists "equipment_insert" on equipment;
create policy "equipment_insert"
  on equipment for insert
  to authenticated
  with check (current_user_role() = ANY (ARRAY['md','admin','supervisor']));

drop policy if exists "equipment_update" on equipment;
create policy "equipment_update"
  on equipment for update
  to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin','supervisor']))
  with check (current_user_role() = ANY (ARRAY['md','admin','supervisor']));

-- Kufuta: MD na Admin pekee
drop policy if exists "equipment_delete" on equipment;
create policy "equipment_delete"
  on equipment for delete
  to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin']));

-- Weka updated_at kiotomatiki
create or replace function equipment_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists equipment_touch on equipment;
create trigger equipment_touch
  before update on equipment
  for each row execute function equipment_touch_updated_at();
