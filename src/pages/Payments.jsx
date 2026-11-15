import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtTzs, todayStr } from '../lib/db'
import MetricCard from '../components/MetricCard'

function paymentState(inv) {
  if (inv.status === 'paid') return { key: 'paid', label: 'Imelipwa', cls: 'badge-paid' }
  if (inv.due_date && inv.due_date < todayStr()) return { key: 'late', label: 'Imechelewa', cls: 'badge-rejected' }
  return { key: 'pending', label: 'Inasubiri', cls: 'badge-pending' }
}

export default function Payments() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [filter, setFilter] = useState('open')
  const [q, setQ] = useState('')

  async function fetchInvoices() {
    return supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, amount_paid, due_date, issue_date, client:clients(name, phone), service_line:service_lines(name)')
      .order('due_date', { ascending: true, nullsFirst: false })
  }

  useEffect(() => {
    let cancelled = false
    fetchInvoices().then((res) => {
      if (cancelled) return
      if (res.error) setMessage({ type: 'error', text: res.error.message })
      else setItems(res.data ?? [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  async function markPaid(inv) {
    if (!window.confirm(`Weka invoice ${inv.invoice_number} kuwa imelipwa (TZS ${fmtTzs(inv.total_amount)})?`)) return
    setMessage(null)
    const res = await supabase.from('invoices').update({ status: 'paid', amount_paid: inv.total_amount }).eq('id', inv.id)
    if (res.error) { setMessage({ type: 'error', text: res.error.message }); return }
    setMessage({ type: 'success', text: `Invoice ${inv.invoice_number} imewekwa imelipwa` })
    const fresh = await fetchInvoices()
    if (!fresh.error) setItems(fresh.data ?? [])
  }

  if (loading) return <div className="page-loading">Inapakia...</div>

  const withState = items.map((inv) => ({ inv, s: paymentState(inv) }))
  const sum = (arr) => arr.reduce((t, x) => t + Number(x.inv.total_amount || 0) - (x.s.key === 'paid' ? 0 : Number(x.inv.amount_paid || 0)), 0)
  const pending = withState.filter((x) => x.s.key === 'pending')
  const late = withState.filter((x) => x.s.key === 'late')
  const paid = withState.filter((x) => x.s.key === 'paid')

  const term = q.trim().toLowerCase()
  const visible = withState.filter(({ inv, s }) => {
    if (filter === 'open' && s.key === 'paid') return false
    if (['pending', 'late', 'paid'].includes(filter) && s.key !== filter) return false
    if (!term) return true
    return [inv.invoice_number, inv.client?.name, inv.service_line?.name].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
  })

  return (
    <div>
      {message ? <p className={message.type === 'error' ? 'login-error' : 'reset-success'}>{message.text}</p> : null}

      <div className="metric-grid">
        <MetricCard label={`Inasubiri (${pending.length})`} value={sum(pending)} color="#854f0b" />
        <MetricCard label={`Imechelewa (${late.length})`} value={sum(late)} color="#a32d2d" />
        <MetricCard label={`Imelipwa (${paid.length})`} value={paid.reduce((t, x) => t + Number(x.inv.total_amount || 0), 0)} color="#085041" />
      </div>

      <div className="panel">
        <p className="panel-title">Malipo ya wateja</p>
        <div className="eq-filters">
          <input type="text" placeholder="Tafuta invoice au mteja..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">Yasiyolipwa (yote)</option>
            <option value="late">Yaliyochelewa</option>
            <option value="pending">Yanayosubiri</option>
            <option value="paid">Yaliyolipwa</option>
            <option value="all">Yote</option>
          </select>
        </div>

        {visible.length === 0 ? (
          <p className="panel-empty">Hakuna invoice zinazolingana.</p>
        ) : (
          <div className="row-list">
            {visible.map(({ inv, s }) => (
              <div className="row-item eq-row" key={inv.id}>
                <div>
                  <p className="row-title">{inv.invoice_number} — {inv.client?.name ?? 'Mteja'}</p>
                  <p className="row-sub">
                    {[
                      inv.service_line?.name,
                      inv.due_date ? `Mwisho ${inv.due_date}` : 'Hakuna tarehe ya mwisho',
                      s.key !== 'paid' && Number(inv.amount_paid) > 0 ? `Imelipwa TZS ${fmtTzs(inv.amount_paid)}` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="eq-actions">
                  <span className="row-amount">TZS {fmtTzs(inv.total_amount)}</span>
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  {s.key !== 'paid' ? <button className="btn-cancel" onClick={() => markPaid(inv)}>Weka imelipwa</button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
