-- =========================================================
-- AJPLUS Company Management: Public Invoice Link (EFD-style QR)
-- Endesha SQL hii kwenye Supabase SQL Editor (project: veptsbhbvmxpefmivmqc)
-- =========================================================

-- 1) Ongeza safu ya "public_token" kwenye invoices (UUID isiyoweza kukisiwa)
alter table invoices
  add column if not exists public_token uuid default gen_random_uuid() unique;

-- 2) Jaza public_token kwa invoice zilizopo tayari (zisizo na token)
update invoices
  set public_token = gen_random_uuid()
  where public_token is null;

-- 3) Function salama (SECURITY DEFINER) inayorudisha taarifa za invoice moja tu
--    kwa kutumia token, bila kufungua meza nzima kwa anon/public.
create or replace function get_public_invoice(p_token uuid)
returns table (
  id uuid,
  invoice_number text,
  status text,
  subtotal numeric,
  total_amount numeric,
  amount_paid numeric,
  issue_date date,
  due_date date,
  client_name text,
  client_phone text,
  service_line_name text,
  items jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    i.id,
    i.invoice_number,
    i.status,
    i.subtotal,
    i.total_amount,
    i.amount_paid,
    i.issue_date,
    i.due_date,
    c.name as client_name,
    c.phone as client_phone,
    sl.name as service_line_name,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'description', it.description,
          'quantity', it.quantity,
          'unit_price', it.unit_price,
          'line_total', it.line_total
        ))
        from invoice_items it
        where it.invoice_id = i.id
      ),
      '[]'::jsonb
    ) as items
  from invoices i
  left join clients c on c.id = i.client_id
  left join service_lines sl on sl.id = i.service_line_id
  where i.public_token = p_token
  limit 1;
$$;

-- 4) Ruhusu watumiaji wa "anon" (wageni, bila login) kuita function hii tu
--    Meza za invoices/clients/invoice_items ZINABAKI zimefungwa kwa anon —
--    hii function ndiyo njia pekee ya kufikia taarifa, na inahitaji token sahihi.
grant execute on function get_public_invoice(uuid) to anon;

-- =========================================================
-- Baada ya kuendesha hii, link ya mfano itakuwa:
-- https://<domain-yako>/invoice/<public_token-ya-invoice-husika>
-- =========================================================
