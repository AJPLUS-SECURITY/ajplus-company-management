-- =========================================================
-- AJPLUS Company Management: Payment Accounts (Settings)
-- Endesha SQL hii kwenye Supabase SQL Editor (project: veptsbhbvmxpefmivmqc)
-- =========================================================

-- 1) Jedwali la akaunti za malipo (benki / mobile money) zinazoonyeshwa
--    kwenye invoice, quotation, receipt na statement.
create table if not exists payment_accounts (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'bank' check (type in ('bank', 'mobile_money')),
  bank_name text,
  branch text,
  account_number text not null,
  account_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2) Zima RLS kwa default kisha weka sera (policy) zenye mipaka
alter table payment_accounts enable row level security;

-- Kila mtu aliyeingia (authenticated) anaweza kusoma akaunti zilizo "active"
-- (zinahitajika kuonekana kwenye invoice/quotation zinazotengenezwa na FAO/Supervisor n.k)
drop policy if exists "payment_accounts_select" on payment_accounts;
create policy "payment_accounts_select"
  on payment_accounts for select
  to authenticated
  using (true);

-- Kuongeza/kuhariri/kufuta ni kwa MD na Admin pekee
drop policy if exists "payment_accounts_write" on payment_accounts;
create policy "payment_accounts_write"
  on payment_accounts for all
  to authenticated
  using (current_user_role() = ANY (ARRAY['md', 'admin']))
  with check (current_user_role() = ANY (ARRAY['md', 'admin']));

-- 3) Jaza akaunti zilizopo tayari (NMB, CRDB, Lipa by Mixx by Yas)
insert into payment_accounts (type, bank_name, branch, account_number, account_name, sort_order)
values
  ('bank', 'NMB Bank', 'Tegeta Branch', '23510095544', 'AJPLUS Company Limited', 1),
  ('bank', 'CRDB Bank', 'Tegeta Branch', '0152848501600', 'John F. Mfoi', 2),
  ('mobile_money', 'Lipa by Mixx by Yas', null, '44934738', 'AJPLUS Company Limited', 3)
on conflict do nothing;
