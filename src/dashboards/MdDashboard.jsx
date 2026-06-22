import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MetricCard from '../components/MetricCard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const STATUS_BADGE = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  paid: 'badge-paid',
}

export default function MdDashboard() {
  const [balance, setBalance] = useState(null)
  const [byServiceLine, setByServiceLine] = useState([])
  const [pending, setPending] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [unpaidTotal, setUnpaidTotal] = useState(0)
  const [paidTotal, setPaidTotal] = useState(0)
  const [unpaidCount, setUnpaidCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [balanceRes, slRes, pendingRes, stockRes, allInvoicesRes] = await Promise.all([
        supabase.from('v_company_balance_to_date').select('*').single(),
        supabase.from('v_balance_by_service_line').select('*'),
        supabase.from('v_pending_expense_requests').select('*').limit(6),
        supabase.from('v_low_stock_alert').select('*').limit(6),
        supabase.from('invoices').select('status, total_amount'),
      ])

      setBalance(balanceRes.data)
      setByServiceLine(slRes.data ?? [])
      setPending(pendingRes.data ?? [])
      setLowStock(stockRes.data ?? [])

      const allInvoices = allInvoicesRes.data ?? []
      const unpaidOnes = allInvoices.filter((inv) => inv.status !== 'paid')
      const paidOnes = allInvoices.filter((inv) => inv.status === 'paid')
      setUnpaidTotal(unpaidOnes.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0))
      setPaidTotal(paidOnes.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0))
      setUnpaidCount(unpaidOnes.length)

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="page-loading">Inapakia takwimu...</div>

  const chartData = byServiceLine.map((sl) => ({
    name: sl.service_line_name,
    Mapato: Number(sl.total_income),
    Matumizi: Number(sl.total_expenses),
  }))

  return (
    <div>
      <div className="metric-grid">
        <MetricCard label="Mapato (tangu mwanzo)" value={Number(balance?.total_income_to_date ?? 0)} />
        <MetricCard label="Matumizi (tangu mwanzo)" value={Number(balance?.total_expenses_to_date ?? 0)} />
        <MetricCard
          label="Salio la sasa"
          value={Number(balance?.current_balance ?? 0)}
          color="#085041"
        />
        <MetricCard label="Maombi yanasubiri" value={pending.length} prefix="" />
        <MetricCard label="Invoices Hazijalipwa (idadi)" value={unpaidCount} prefix="" />
        <MetricCard label="Jumla Invoices Haijalipwa" value={unpaidTotal} color="#854f0b" />
        <MetricCard label="Jumla Invoices Imelipwa" value={paidTotal} color="#085041" />
      </div>

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
        {pending.length === 0 ? (
          <p className="panel-empty">Hakuna maombi yanayosubiri kwa sasa.</p>
        ) : (
          <div className="row-list">
            {pending.map((p) => (
              <div className="row-item" key={p.id}>
                <div>
                  <p className="row-title">{p.reason} — {p.service_line_name}</p>
                  <p className="row-sub">
                    {p.requester_name} · approvals {p.current_approvals}/{p.required_approvals}
                  </p>
                </div>
                <span className="row-amount">{Number(p.amount).toLocaleString()} TZS</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {lowStock.length > 0 && (
        <div className="panel">
          <p className="panel-title">Vifaa vinavyokaribia kuisha</p>
          <div className="row-list">
            {lowStock.map((s) => (
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
    </div>
  )
}
