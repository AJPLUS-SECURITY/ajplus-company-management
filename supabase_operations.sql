-- =========================================================
-- AJPLUS Company Management: Operesheni za Ulinzi
-- Wateja na Mikataba (contracts), Walinzi (guards), Mahudhurio (guard_attendance)
-- Endesha SQL hii kwenye Supabase SQL Editor (project: veptsbhbvmxpefmivmqc)
-- Inahitaji: clients, service_lines, users, na function current_user_role()
-- Ni salama kuiendesha mara nyingi (if not exists / drop policy if exists)
-- =========================================================

-- 1) MIKATABA
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  service_line_id uuid references service_lines(id),
  site_name text not null,
  guards_required integer not null default 1 check (guards_required >= 0),
  monthly_fee numeric(14,2) not null default 0,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active','suspended','ended')),
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists contracts_end_date_idx on contracts (end_date);
alter table contracts enable row level security;

drop policy if exists "contracts_select" on contracts;
create policy "contracts_select" on contracts for select to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin','fao','supervisor','hr']));

drop policy if exists "contracts_insert" on contracts;
create policy "contracts_insert" on contracts for insert to authenticated
  with check (current_user_role() = ANY (ARRAY['md','admin','fao']));

drop policy if exists "contracts_update" on contracts;
create policy "contracts_update" on contracts for update to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin','fao']))
  with check (current_user_role() = ANY (ARRAY['md','admin','fao']));

drop policy if exists "contracts_delete" on contracts;
create policy "contracts_delete" on contracts for delete to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin']));

-- 2) WALINZI
create table if not exists guards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  phone text,
  contract_id uuid references contracts(id) on delete set null,
  status text not null default 'kazini' check (status in ('kazini','likizo','amesimamishwa')),
  hire_date date,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists guards_contract_idx on guards (contract_id);
alter table guards enable row level security;

drop policy if exists "guards_select" on guards;
create policy "guards_select" on guards for select to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin','fao','supervisor','hr']));

drop policy if exists "guards_insert" on guards;
create policy "guards_insert" on guards for insert to authenticated
  with check (current_user_role() = ANY (ARRAY['md','admin','supervisor','hr']));

drop policy if exists "guards_update" on guards;
create policy "guards_update" on guards for update to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin','supervisor','hr']))
  with check (current_user_role() = ANY (ARRAY['md','admin','supervisor','hr']));

drop policy if exists "guards_delete" on guards;
create policy "guards_delete" on guards for delete to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin']));

-- 3) MAHUDHURIO (rekodi moja kwa mlinzi kwa siku)
create table if not exists guard_attendance (
  id uuid primary key default gen_random_uuid(),
  guard_id uuid not null references guards(id) on delete cascade,
  att_date date not null,
  status text not null check (status in ('P','L','A')),
  note text,
  marked_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (guard_id, att_date)
);
create index if not exists guard_attendance_date_idx on guard_attendance (att_date);
alter table guard_attendance enable row level security;

drop policy if exists "guard_attendance_select" on guard_attendance;
create policy "guard_attendance_select" on guard_attendance for select to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin','fao','supervisor','hr']));

drop policy if exists "guard_attendance_insert" on guard_attendance;
create policy "guard_attendance_insert" on guard_attendance for insert to authenticated
  with check (current_user_role() = ANY (ARRAY['md','admin','supervisor','hr']));

drop policy if exists "guard_attendance_update" on guard_attendance;
create policy "guard_attendance_update" on guard_attendance for update to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin','supervisor','hr']))
  with check (current_user_role() = ANY (ARRAY['md','admin','supervisor','hr']));

drop policy if exists "guard_attendance_delete" on guard_attendance;
create policy "guard_attendance_delete" on guard_attendance for delete to authenticated
  using (current_user_role() = ANY (ARRAY['md','admin']));
