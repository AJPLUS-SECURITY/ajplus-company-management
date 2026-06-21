# AJ PLUS Company Management System — Frontend

Mfumo wa kusimamia kampuni nzima ya AJ PLUS COMPANY LIMITED (fedha, payroll,
invoice, stock) ukiwa na Dashboard tofauti kwa kila role: MD, FAO, HR, Supervisor.

## Kabla ya kuanza (mazingira ya ndani)

1. `npm install`
2. Copy `.env.example` kuwa `.env`, kisha jaza:
   - `VITE_SUPABASE_URL` — Project URL ya Supabase (Project Settings -> API)
   - `VITE_SUPABASE_ANON_KEY` — anon public key (Project Settings -> API)
3. `npm run dev` — fungua http://localhost:5173

## Kuweka GitHub

```bash
git init
git add .
git commit -m "Mwanzo wa AJ PLUS Company Management frontend"
git branch -M main
git remote add origin <URL ya repo yako mpya kwenye GitHub>
git push -u origin main
```

## Kuweka Vercel

1. Fungua https://vercel.com/new
2. Chagua repo uliyoiweka GitHub
3. Vercel itatambua Vite kiotomatiki (Framework Preset: Vite)
4. Kwenye Environment Variables, ongeza:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
5. Bonyeza Deploy

## Muundo wa mfumo

- src/lib/supabase.js — Supabase client
- src/contexts/AuthContext.jsx — login/logout na kupata profile (role, service_line)
- src/components/ProtectedRoute.jsx — inazuia ufikiaji bila login
- src/components/DashboardLayout.jsx — sidebar + header, navigation hubadilika kwa role
- src/dashboards/ — dashboard maalum kwa kila role (MdDashboard, FaoDashboard, HrDashboard, SupervisorDashboard)
- src/pages/Login.jsx — ukurasa wa kuingia
- src/pages/Home.jsx — inachagua dashboard sahihi kulingana na role ya mtumiaji aliyelogin

## Roles zinazotumika

| Role | Anaona |
|---|---|
| md | Kila kitu - mapato, matumizi, invoices, payroll, stock |
| fao | Mapato, matumizi, invoices, anaweza approve maombi |
| hr | Payroll na wafanyakazi tu |
| supervisor | Maombi na stock ya service_line yake tu |
| employee | (bado haijajengwa UI yake - dashboard ya kuomba fedha) |
km.
