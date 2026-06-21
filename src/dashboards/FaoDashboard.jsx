import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import MetricCard from '../components/MetricCard'

export default function FaoDashboard() {
  const { profile } = useAuth()
  const [balance, setBalance] = useState(null)
  const [pending, setPending] = useState([])
  const [unpaidInvoices, setUnpaidInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [balanceRes, pendingRes, invoiceRes] = await Promise.all([
        supabase.from('v_company_balance_to_date').select('*').single(),
        supabase.from('v_pending_expense_requests').select('*'),
        supabase
          .from('invoices')
          .select('id, invoice_number, total_amount, status, due_date, client:clients(name)')
          .in('status', ['unpaid', 'overdue', 'partially_paid'])
          .order('due_date', { ascending: true })
          .limit(8),
      ])

      setBalance(balanceRes.data)
      setPending(pendingRes.data ?? [])
      setUnpaidInvoices(invoiceRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleApprove(requestId) {
    const { error } = await supabase.from('expense_approvals').insert({
      expense_request_id: requestId,
      approver_id: profile.id,
      approver_role: 'fao',
      decision: 'approved',
    })
    if (!error) {
      setPending((prev) => prev.filter((p) => p.id !== requestId))
    }
  }

  if (loading) return <div className="page-loading">Inapakia takwimu...</div>

  return (
    <div>
      <div className="metric-grid">
        <MetricCard label="Mapato (tangu mwanzo)" value={Number(balance?.total_income_to_date ?? 0)} />
        <MetricCard label="Matumizi (tangu mwanzo)" value={Number(balance?.total_expenses_to_date ?? 0)} />
        <MetricCard label="Salio la sasa" value={Number(balance?.current_balance ?? 0)} color="#085041" />
        <MetricCard label="Invoices hazijalipwa" value={unpaidInvoices.length} prefix="" />
      </div>

      <div className="panel">
        <p className="panel-title">Maombi yanayosubiri uamuzi wako</p>
        {pending.length === 0 ? (
          <p className="panel-empty">Hakuna maombi yanayosubiri kwa sasa.</p>
        ) : (
          <div className="row-list">
            {pending.map((p) => (
              <div className="row-item" key={p.id}>
                <div>
                  <p className="row-title">{p.reason} — {p.service_line_name}</p>
                  <p className="row-sub">{p.requester_name} · {Number(p.amount).toLocaleString()} TZS</p>
                </div>
                <button className="btn-approve" onClick={() => handleApprove(p.id)}>
                  Kubali
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <p className="panel-title">Invoices zinazosubiri malipo</p>
        {unpaidInvoices.length === 0 ? (
          <p className="panel-empty">Hakuna invoice zinazosubiri malipo.</p>
        ) : (
          <div className="row-list">
            {unpaidInvoices.map((inv) => (
              <div className="row-item" key={inv.id}>
                <div>
                  <p className="row-title">{inv.invoice_number} — {inv.client?.name}</p>
                  <p className="row-sub">Inadaiwa: {inv.due_date}</p>
                </div>
                <span className={'badge ' + (STATUS_BADGE[inv.status] ?? 'badge-pending')}>
                  {Number(inv.total_amount).toLocaleString()} TZS
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const STATUS_BADGE = {
  unpaid: 'badge-pending',
  overdue: 'badge-rejected',
  partially_paid: 'badge-pending',
}
