import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { STATUSES, CATEGORIES, daysUntil } from '../lib/equipment'
import { contractState } from '../lib/ops'
import { fmtTzs, shiftDate, todayStr } from '../lib/db'
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
  { to: '/payments', label: 'Malipo' },
  { to: '/contracts', label: 'Wateja na Mikataba' },
  { to: '/guards', label: 'Walinzi' },
  { to: '/attendance', label: 'Mahudhurio' },
  { to: '/expenses', label: 'Maombi ya Fedha' },
  { to: '/payroll', label: 'Payroll' },
  { to: '/employees', label: 'Wafanyakazi' },
  { to: '/equipment', label: 'Vifaa' },
  { to: '/stock', label: 'Stock' },
  { to: '/reports', label: 'Ripoti' },
  { to: '/settings', label: 'Mipangilio' },
]

const DAY_NAMES = ['Jpl', 'Jtt', 'Jnn', 'Jtn', 'Alh', 'Ijm', 'Jms']

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Habari za asubuhi'
  if (h < 18) return 'Habari za mchana'
  return 'Habari za jioni'
}

export default function MdDashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(null)

  useEffect(() => {
    async function load() {
      const today = todayStr()
      const weekStart = shiftDate(today, -6)
      const [
        balanceRes, slRes, pendingRes, pendingCountRes, stockRes, stockCountRes,
        invoicesRes, usersCountRes, equipmentRes, guardsRes, contractsRes, attendanceRes,
      ] = await Promise.all([
        supabase.from('v_company_balance_to_date').select('*').single(),
        supabase.from('v_balance_by_service_line').select('*'),
        supabase.from('v_pending_expense_requests').select('*').limit(6),
        supabase.from('v_pending_expense_requests').select('*', { count: 'exact', head: true }),
        supabase.from('v_low_stock_alert').select('*').limit(6),
        supabase.from('v_low_stock_alert').select('*', { count: 'exact', head: true }),
        supabase.from('invoices').select('status, total_amount, amount_paid, due_date'),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('equipment').select('id, name, category, status, next_service_date, location, assigned_to'),
        supabase.from('guards').select('id, status'),
        supabase.from('contracts').select('id, status, end_date, monthly_fee, site_name'),
        supabase.from('guard_attendance').select('guard_id, att_date, status').gte('att_date', weekStart),
      ])

      // ---- fedha / invoices
      const invoices = invoicesRes.data ?? []
      const unpaid = invoices.filter((i) => i.status !== 'paid')
      const paid = invoices.filter((i) => i.status === 'paid')
      const overdue = unpaid.filter((i) => i.due_date && i.due_date < today)

      // ---- vifaa
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

      // ---- walinzi, mikataba, mahudhurio
      const opsMissing = Boolean(guardsRes.error || contractsRes.error || attendanceRes.error)
      const guards = guardsRes.data ?? []
      const guardsOnDuty = guards.filter((g) => g.status === 'kazini')
      const contractStates = (contractsRes.data ?? []).map((c) => ({ c, s: contractState(c) }))
      const liveContracts = contractStates.filter((x) => ['ok', 'soon'].includes(x.s.key))
      const contractsSoon = contractStates.filter((x) => x.s.key === 'soon')
      const contractsExpired = contractStates.filter((x) => x.s.key === 'expired')

      const attendance = attendanceRes.data ?? []
      const dutyIds = new Set(guardsOnDuty.map((g) => g.id))
      const todays = attendance.filter((a) => a.att_date === today && dutyIds.has(a.guard_id))
      const absentToday = todays.filter((a) => a.status === 'A').length
      const markedToday = todays.length
      const attendanceRate = markedToday > 0
        ? Math.round(((markedToday - absentToday) * 100) / markedToday)
        : null
      const unmarkedToday = Math.max(0, guardsOnDuty.length - markedToday)

      const week = []
      for (let i = 6; i >= 0; i--) {
        const day = shiftDate(today, -i)
        const rows = attendance.filter((a) => a.att_date === day)
        const absent = rows.filter((a) => a.status === 'A').length
        week.push({
          name: DAY_NAMES[new Date(day + 'T00:00:00').getDay()],
          rate: rows.length > 0 ? Math.round(((rows.length - absent) * 100) / rows.length) : null,
        })
      }

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
        overdueCount: overdue.length,
        overdueTotal: overdue.reduce((s, i) => s + Number(i.total_amount || 0) - Number(i.amount_paid || 0), 0),
        employeeCount: usersCountRes.count ?? 0,
        equipmentMissing,
        equipmentTotal: equipment.length,
        byStatus,
        serviceOverdue: serviceOverdue.length,
        serviceSoon: serviceSoon.length,
        broken: broken.length,
        attentionList,
        opsMissing,
        guardsOnDuty: guardsOnDuty.length,
        liveContracts: liveContracts.length,
        monthlyRevenue: liveContracts.reduce((s, x) => s + Number(x.c.monthly_fee || 0), 0),
        contractsSoon: contractsSoon.length,
        contractsExpired: contractsExpired.length,
        expiringList: [...contractsExpired, ...contractsSoon].slice(0, 5),
        attendanceRate,
        absentToday,
        unmarkedToday,
        week,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !d) return <div className="page-loading">Inapakia takwimu...</div>

  const firstName = (profile?.full_name ?? '').split(' ')[0]
  const todayLabel = new Date().toLocaleDateString('sw-TZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const chartData = d.byServiceLine.map((sl) => ({
    name: sl.service_line_name,
    Mapato: Number(sl.total_income),
    Matumizi: Number(sl.total_expenses),
  }))

  const alerts = []
  if (d.overdueCount > 0) alerts.push({ tone: 'bad', to: '/payments', text: `Invoices ${d.overdueCount} zimechelewa kulipwa (TZS ${fmtTzs(d.overdueTotal)})`, cta: 'Angalia' })
  if (d.pendingCount > 0) alerts.push({ tone: 'warn', to: '/expenses', text: `Maombi ya fedha ${d.pendingCount} yanasubiri uamuzi`, cta: 'Angalia' })
  if (!d.opsMissing) {
    if (d.contractsExpired > 0) alerts.push({ tone: 'bad', to: '/contracts', text: `Mikataba ${d.contractsExpired} imeisha muda bila kuhuishwa`, cta: 'Angalia' })
    if (d.contractsSoon > 0) alerts.push({ tone: 'warn', to: '/contracts', text: `Mikataba ${d.contractsSoon} inaisha ndani ya siku 60`, cta: 'Angalia' })
    if (d.guardsOnDuty > 0 && d.unmarkedToday > 0) alerts.push({ tone: 'warn', to: '/attendance', text: `Walinzi ${d.unmarkedToday} hawajawekewa mahudhurio ya leo`, cta: 'Weka' })
    if (d.absentToday > 0) alerts.push({ tone: 'warn', to: '/attendance', text: `Walinzi ${d.absentToday} hawapo leo`, cta: 'Angalia' })
  } else {
    alerts.push({ tone: 'info', to: '/guards', text: 'Moduli za Walinzi, Mikataba na Mahudhurio hazijawashwa. Endesha supabase_operations.sql kwenye Supabase.', cta: 'Maelezo' })
  }
  if (d.lowStockCount > 0) alerts.push({ tone: 'bad', to: '/stock', text: `Vifaa ${d.lowStockCount} vya stock vinakaribia kuisha`, cta: 'Angalia' })
  if (!d.equipmentMissing) {
    if (d.broken > 0) alerts.push({ tone: 'bad', to: '/equipment', text: `Vifaa ${d.broken} vimeharibika au vimepotea`, cta: 'Angalia' })
    if (d.serviceOverdue > 0) alerts.push({ tone: 'bad', to: '/equipment', text: `Vifaa ${d.serviceOverdue} vimechelewa huduma/ukaguzi`, cta: 'Angalia' })
    if (d.serviceSoon > 0) alerts.push({ tone: 'warn', to: '/equipment', text: `Vifaa ${d.serviceSoon} vinahitaji huduma ndani ya siku 30`, cta: 'Angalia' })
  } else {
    alerts.push({ tone: 'info', to: '/equipment', text: 'Moduli ya Vifaa haijawashwa bado. Endesha supabase_equipment.sql kwenye Supabase.', cta: 'Maelezo' })
  }

  const equipmentAttention = d.broken + d.serviceOverdue + d.serviceSoon
  const statusTotal = Object.values(d.byStatus).reduce((a, b) => a + b, 0)
  const weekHasData = d.week.some((w) => w.rate !== null)

  return (
    <div>
      <div className="cc-hero">
        <div>
          <h2>{greeting()}{firstName ? `, ${firstName}` : ''}</h2>
          <p>Muhtasari wa kampuni nzima: fedha, walinzi, mikataba, vifaa na maamuzi yanayosubiri.</p>
        </div>
        <span className="cc-hero-date">{todayLabel}</span>
      </div>

      <p className="cc-section-label">Hali ya kampuni</p>
      <div className="cc-tiles">
        <Link to="/guards" className="cc-tile">
          <p className="cc-tile-num">{d.opsMissing ? '—' : d.guardsOnDuty}</p>
          <p className="cc-tile-label">Walinzi kazini</p>
        </Link>
        <Link to="/contracts" className="cc-tile">
          <p className="cc-tile-num">{d.opsMissing ? '—' : d.liveContracts}</p>
          <p className="cc-tile-label">Mikataba hai</p>
        </Link>
        <Link to="/attendance" className="cc-tile">
          <p className="cc-tile-num">{d.opsMissing || d.attendanceRate === null ? '—' : `${d.attendanceRate}%`}</p>
          <p className="cc-tile-label">Mahudhurio leo</p>
        </Link>
        <Link to="/payments" className="cc-tile">
          <p className={`cc-tile-num ${d.overdueCount > 0 ? 'bad' : ''}`}>{d.overdueCount}</p>
          <p className="cc-tile-label">Malipo yaliyochelewa</p>
        </Link>
        <Link to="/employees" className="cc-tile">
          <p className="cc-tile-num">{d.employeeCount}</p>
          <p className="cc-tile-label">Wafanyakazi na akaunti</p>
        </Link>
        <Link to="/equipment" className="cc-tile">
          <p className={`cc-tile-num ${!d.equipmentMissing && equipmentAttention > 0 ? 'bad' : ''}`}>
            {d.equipmentMissing ? '—' : equipmentAttention}
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
        {!d.opsMissing && <MetricCard label="Ada ya kila mwezi (mikataba hai)" value={d.monthlyRevenue} color="#022345" />}
      </div>

      <div className="cc-grid-2">
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

        {!d.opsMissing && (
          <div className="panel">
            <p className="panel-title">Mahudhurio ya walinzi siku 7</p>
            {weekHasData ? (
              <div className="cc-bars">
                {d.week.map((w, i) => (
                  <div key={i}>
                    <i className={w.rate === null ? 'none' : ''} style={{ height: `${w.rate === null ? 3 : w.rate * 1.2}px` }} />
                    {w.rate === null ? '—' : `${w.rate}%`}<br />{w.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-empty">Bado hakuna mahudhurio yaliyowekwa. Anza kwenye ukurasa wa Mahudhurio.</p>
            )}
          </div>
        )}
      </div>

      {!d.opsMissing && d.expiringList.length > 0 && (
        <div className="panel">
          <p className="panel-title">Mikataba inayohitaji kuhuishwa</p>
          <div className="row-list">
            {d.expiringList.map(({ c, s }) => (
              <div className="row-item" key={c.id}>
                <div>
                  <p className="row-title">{c.site_name}</p>
                  <p className="row-sub">Inaisha {c.end_date} · TZS {fmtTzs(c.monthly_fee)}/mwezi</p>
                </div>
                <span className={`badge ${s.cls}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!d.equipmentMissing && statusTotal > 0 && (
        <div className="panel">
          <p className="panel-title">Hali ya vifaa vyote</p>
          <div className="cc-statusbar">
            {Object.keys(STATUSES).map((key) => {
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
                <span className="row-amount">{fmtTzs(p.amount)} TZS</span>
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
              const isBroken = ['damaged', 'lost'].includes(e.status)
              return (
                <div className="row-item" key={e.id}>
                  <div>
                    <p className="row-title">{e.name}</p>
                    <p className="row-sub">
                      {[CATEGORIES[e.category] ?? e.category, e.location, e.assigned_to].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {isBroken ? (
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
