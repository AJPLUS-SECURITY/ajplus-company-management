import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { STATUSES, CATEGORIES, daysUntil } from '../lib/equipment'
import MetricCard from '../components/MetricCard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import './MdDashboard.css'

const STATUS_COLORS = {
  active: '#1D9E75',
  maintenance: '#EABF0B',
  damaged: '#D85A30',
  lost: '#A32D2D',
  retired: '#9A9890',
}

const QUICK_LINKS = [
  { to: '/invoices', label: 'Invoices' },
  { to: '/expenses', label: 'Maombi ya Fedha' },
  { to: '/payroll', label: 'Payroll' },
  { to: '/employees', label: 'Wafanyakazi' },
  { to: '/equipment', label: 'Vifaa' },
  { to: '/stock', label: 'Stock' },
  { to: '/reports', label: 'Ripoti' },
  { to: '/settings', label: 'Mipangilio' },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Habari za asubuhi'
  if (h < 18) return 'Habari za mchana'
  return 'Habari za jioni'
}

const fmt = (n) => Number(n || 0).toLocaleString()

export default function MdDashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(null)

  useEffect(() => {
    async function load() {
      const [
        balanceRes, slRes, pendingRes, pendingCountRes, stockRes, stockCountRes,
        invoicesRes, usersCountRes, equipmentRes,
      ] = await Promise.all([
        supabase.from('v_company_balance_to_date').select('*').single(),
        supabase.from('v_balance_by_service_line').select('*'),
        supabase.from('v_pending_expense_requests').select('*').limit(6),
        supabase.from('v_pending_expense_requests').select('*', { count: 'exact', head: true }),
        supabase.from('v_low_stock_alert').select('*').limit(6),
        supabase.from('v_low_stock_alert').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('status, total_amount'),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('equipment').select('id, name, category, status, next_service_date, location, assigned_to'),
      ])

      const invoices = invoicesRes.data ?? []
      const unpaid = invoices.filter((i) => i.status !== 'paid')
      const paid = invoices.filter((i) => i.status === 'paid')

      const equipmentMissing = Boolean(equipmentRes.error)
      const equipment = equipmentRes.data ?? []
      const byStatus = {}
      equipment.forEach((e) => { byStatus[e.status] = (byStatus[e.status] || 0) + 1 })
      const live = equipment.filter((e) => ['active', 'maintenance'].includes(e.status))
      const serviceOverdue = live.filter((e) => { const x = daysUntil(e.next_service_date); return x !== null && x < 0 })
      const serviceSoon = live.filter((e) => { const x = daysUntil(e.next_service_date); return x !== null && x >= 0 && x <= 30 })
      const broken = equipment.filter((e) => ['damaged', 'lost'].includes(e.status))
      const attentionList = [
        ...broken,
        ...serviceOverdue.filter((e) => !broken.includes(e)),
        ...serviceSoon,
      ].slice(0, 6)

      setD({
        balance: balanceRes.data,
        byServiceLine: slRes.data ?? [],
        pending: pendingRes.data ?? [],
        pendingCount: pendingCountRes.count ?? (pendingRes.data ?? []).length,
        lowStock: stockRes.data ?? [],
        lowStockCount: stockCountRes.count ?? (stockRes.data ?? []).length,
        unpaidTotal: unpaid.reduce((s, i) => s + Number(i.total_amount || 0), 0),
        paidTotal: paid.reduce((s, i) => s + Number(i.total_amount || 0), 0),
        unpaidCount: unpaid.length,
        employeeCount: usersCountRes.count ?? 0,
        equipmentMissing,
        equipmentTotal: equipment.length,
        byStatus,
        serviceOverdue: serviceOverdue.length,
        serviceSoon: serviceSoon.length,
        broken: broken.length,
        attentionList,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !d) return <div className="page-loading">Inapakia takwimu...</div>

  const firstName = (profile?.full_name ?? '').split(' ')[0]
  const today = new Date().toLocaleDateString('sw-TZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const chartData = d.byServiceLine.map((sl) => ({
    name: sl.service_line_name,
    Mapato: Number(sl.total_income),
    Matumizi: Number(sl.total_expenses),
  }))

  const alerts = []
  if (d.pendingCount > 0) alerts.push({ tone: 'warn', to: '/expenses', text: `Maombi ya fedha ${d.pendingCount} yanasubiri uamuzi`, cta: 'Angalia' })
  if (d.unpaidCount > 0) alerts.push({ tone: 'warn', to: '/invoices', text: `Invoices ${d.unpaidCount} hazijalipwa (TZS ${fmt(d.unpaidTotal)})`, cta: 'Angalia' })
  if (d.lowStockCount > 0) alerts.push({ tone: 'bad', to: '/stock', text: `Vifaa ${d.lowStockCount} vya stock vinakaribia kuisha`, cta: 'Angalia' })
  if (!d.equipmentMissing) {
    if (d.broken > 0) alerts.push({ tone: 'bad', to: '/equipment', text: `Vifaa ${d.broken} vimeharibika au vimepotea`, cta: 'Angalia' })
    if (d.serviceOverdue > 0) alerts.push({ tone: 'bad', to: '/equipment', text: `Vifaa ${d.serviceOverdue} vimechelewa huduma/ukaguzi`, cta: 'Angalia' })
    if (d.serviceSoon > 0) alerts.push({ tone: 'warn', to: '/equipment', text: `Vifaa ${d.serviceSoon} vinahitaji huduma ndani ya siku 30`, cta: 'Angalia' })
  } else {
    alerts.push({ tone: 'info', to: '/equipment', text: 'Moduli ya Vifaa haijawashwa bado. Endesha supabase_equipment.sql kwenye Supabase.', cta: 'Maelezo' })
  }

  const attentionCount = d.broken + d.serviceOverdue + d.serviceSoon
  const statusTotal = Object.values(d.byStatus).reduce((a, b) => a + b, 0)

  return (
    <div>
      <div className="cc-hero">
        <div>
          <h2>{greeting()}{firstName ? `, ${firstName}` : ''}</h2>
          <p>Muhtasari wa kampuni nzima: fedha, watu, vifaa na maamuzi yanayosubiri.</p>
        </div>
        <span className="cc-hero-date">{today}</span>
      </div>

      <p className="cc-section-label">Hali ya kampuni</p>
      <div className="cc-tiles">
        <Link to="/employees" className="cc-tile">
          <p className="cc-tile-num">{d.employeeCount}</p>
          <p className="cc-tile-label">Wafanyakazi na akaunti</p>
        </Link>
        <Link to="/equipment" className="cc-tile">
          <p className="cc-tile-num">{d.equipmentMissing ? '—' : d.equipmentTotal}</p>
          <p className="cc-tile-label">Vifaa vilivyosajiliwa</p>
        </Link>
        <Link to="/equipment" className="cc-tile">
          <p className={`cc-tile-num ${!d.equipmentMissing && attentionCount > 0 ? 'bad' : ''}`}>
            {d.equipmentMissing ? '—' : attentionCount}
          </p>
          <p className="cc-tile-label">Vifaa vinavyohitaji umakini</p>
        </Link>
        <Link to="/stock" className="cc-tile">
          <p className={`cc-tile-num ${d.lowStockCount > 0 ? 'warn' : ''}`}>{d.lowStockCount}</p>
          <p className="cc-tile-label">Stock inayokaribia kuisha</p>
        </Link>
        <Link to="/expenses" className="cc-tile">
          <p className={`cc-tile-num ${d.pendingCount > 0 ? 'warn' : ''}`}>{d.pendingCount}</p>
          <p className="cc-tile-label">Maombi yanayosubiri</p>
        </Link>
      </div>

      <p className="cc-section-label">Fedha</p>
      <div className="metric-grid">
        <MetricCard label="Mapato (tangu mwanzo)" value={Number(d.balance?.total_income_to_date ?? 0)} />
        <MetricCard label="Matumizi (tangu mwanzo)" value={Number(d.balance?.total_expenses_to_date ?? 0)} />
        <MetricCard label="Salio la sasa" value={Number(d.balance?.current_balance ?? 0)} color="#085041" />
        <MetricCard label="Invoices hazijalipwa (idadi)" value={d.unpaidCount} prefix="" />
        <MetricCard label="Jumla invoices haijalipwa" value={d.unpaidTotal} color="#854f0b" />
        <MetricCard label="Jumla invoices imelipwa" value={d.paidTotal} color="#085041" />
      </div>

      <div className="panel">
        <p className="panel-title">Vinavyohitaji umakini wako</p>
        {alerts.length === 0 ? (
          <div className="cc-alert ok"><span>Hakuna jambo la haraka kwa sasa. Kila kitu kiko sawa.</span></div>
        ) : (
          alerts.map((a, i) => (
            <Link key={i} to={a.to} className={`cc-alert ${a.tone}`}>
              <span>{a.text}</span>
              <span>{a.cta} →</span>
            </Link>
          ))
        )}
      </div>

      {!d.equipmentMissing && statusTotal > 0 && (
        <div className="panel">
          <p className="panel-title">Hali ya vifaa vyote</p>
          <div className="cc-statusbar">
            {Object.entries(STATUSES).map(([key]) => {
              const n = d.byStatus[key] || 0
              return n > 0 ? (
                <div key={key} style={{ width: `${(n / statusTotal) * 100}%`, background: STATUS_COLORS[key] }} />
              ) : null
            })}
          </div>
          <div className="cc-legend">
            {Object.entries(STATUSES).map(([key, label]) => (
              <span key={key}>
                <i style={{ background: STATUS_COLORS[key] }} />
                {label}: {d.byStatus[key] || 0}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <p className="panel-title">Mapato vs matumizi kwa huduma</p>
        {chartData.length === 0 ? (
          <p className="panel-empty">Hakuna takwimu bado.</p>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v / 1000000).toFixed(1) + 'M'} />
                <Tooltip formatter={(v) => Number(v).toLocaleString() + ' TZS'} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Mapato" fill="#1D9E75" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Matumizi" fill="#D85A30" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="panel">
        <p className="panel-title">Maombi yanayosubiri uamuzi</p>
        {d.pending.length === 0 ? (
          <p className="panel-empty">Hakuna maombi yanayosubiri kwa sasa.</p>
        ) : (
          <div className="row-list">
            {d.pending.map((p) => (
              <div className="row-item" key={p.id}>
                <div>
                  <p className="row-title">{p.reason} — {p.service_line_name}</p>
                  <p className="row-sub">{p.requester_name} · approvals {p.current_approvals}/{p.required_approvals}</p>
                </div>
                <span className="row-amount">{fmt(p.amount)} TZS</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {d.attentionList.length > 0 && (
        <div className="panel">
          <p className="panel-title">Vifaa vinavyohitaji umakini</p>
          <div className="row-list">
            {d.attentionList.map((e) => {
              const days = daysUntil(e.next_service_date)
              const broken = ['damaged', 'lost'].includes(e.status)
              return (
                <div className="row-item" key={e.id}>
                  <div>
                    <p className="row-title">{e.name}</p>
                    <p className="row-sub">
                      {[CATEGORIES[e.category] ?? e.category, e.location, e.assigned_to].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {broken ? (
                    <span className="badge badge-rejected">{STATUSES[e.status]}</span>
                  ) : days !== null && days < 0 ? (
                    <span className="badge badge-rejected">Huduma imechelewa siku {Math.abs(days)}</span>
                  ) : (
                    <span className="badge badge-pending">Huduma baada ya siku {days}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {d.lowStock.length > 0 && (
        <div className="panel">
          <p className="panel-title">Stock inayokaribia kuisha</p>
          <div className="row-list">
            {d.lowStock.map((s) => (
              <div className="row-item" key={s.id}>
                <div>
                  <p className="row-title">{s.item_name} — {s.service_line_name}</p>
                  <p className="row-sub">Kiwango cha chini: {s.reorder_level} {s.unit}</p>
                </div>
                <span className="badge badge-rejected">{s.current_quantity} {s.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <p className="panel-title">Nenda haraka</p>
        <div className="cc-quick">
          {QUICK_LINKS.map((l) => (
            <Link key={l.to} to={l.to}>{l.label}</Link>
          ))}
        </div>
      </div>
    </div>
  )
}
