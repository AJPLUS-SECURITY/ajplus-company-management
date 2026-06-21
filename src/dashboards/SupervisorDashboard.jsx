import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import MetricCard from '../components/MetricCard'

export default function SupervisorDashboard() {
  const { profile } = useAuth()
  const [pending, setPending] = useState([])
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const serviceLineId = profile?.service_line_id
      if (!serviceLineId) {
        setLoading(false)
        return
      }

      const [pendingRes, stockRes] = await Promise.all([
        supabase
          .from('v_pending_expense_requests')
          .select('*')
          .eq('service_line_name', profile.service_line?.name),
        supabase.from('stock_items').select('*').eq('service_line_id', serviceLineId),
      ])

      setPending(pendingRes.data ?? [])
      setStock(stockRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [profile])

  async function handleApprove(requestId) {
    const { error } = await supabase.from('expense_approvals').insert({
      expense_request_id: requestId,
      approver_id: profile.id,
      approver_role: 'supervisor',
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
        <MetricCard label="Huduma yako" value={0} prefix={profile?.service_line?.name ?? '-'} />
        <MetricCard label="Maombi yanasubiri" value={pending.length} prefix="" />
        <MetricCard label="Vifaa (stock items)" value={stock.length} prefix="" />
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
                  <p className="row-title">{p.reason}</p>
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
        <p className="panel-title">Stock ya huduma yako</p>
        {stock.length === 0 ? (
          <p className="panel-empty">Hakuna vifaa vilivyosajiliwa bado.</p>
        ) : (
          <div className="row-list">
            {stock.map((s) => (
              <div className="row-item" key={s.id}>
                <p className="row-title">{s.name}</p>
                <span className="row-amount">{s.current_quantity} {s.unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
