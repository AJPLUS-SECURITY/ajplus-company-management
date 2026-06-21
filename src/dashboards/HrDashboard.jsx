import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MetricCard from '../components/MetricCard'

export default function HrDashboard() {
  const [employeeCount, setEmployeeCount] = useState(0)
  const [activePeriod, setActivePeriod] = useState(null)
  const [recentPayroll, setRecentPayroll] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [usersRes, periodRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase
          .from('payroll_periods')
          .select('id, period_month, period_year, status')
          .order('period_year', { ascending: false })
          .order('period_month', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      setEmployeeCount(usersRes.count ?? 0)
      setActivePeriod(periodRes.data)

      if (periodRes.data) {
        const { data: entries } = await supabase
          .from('payroll_entries')
          .select('id, net_salary, status, user:users(full_name)')
          .eq('payroll_period_id', periodRes.data.id)
          .limit(8)
        setRecentPayroll(entries ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="page-loading">Inapakia takwimu...</div>

  const totalNet = recentPayroll.reduce((sum, e) => sum + Number(e.net_salary), 0)

  return (
    <div>
      <div className="metric-grid">
        <MetricCard label="Wafanyakazi hai" value={employeeCount} prefix="" />
        <MetricCard label="Jumla ya mishahara (kipindi hiki)" value={totalNet} />
        <MetricCard label="Maingizo ya payroll" value={recentPayroll.length} prefix="" />
      </div>

      <div className="panel">
        <p className="panel-title">
          Payroll ya kipindi {activePeriod ? `${activePeriod.period_month}/${activePeriod.period_year}` : ''}
        </p>
        {recentPayroll.length === 0 ? (
          <p className="panel-empty">Hakuna payroll iliyoandaliwa bado kwa kipindi hiki.</p>
        ) : (
          <div className="row-list">
            {recentPayroll.map((e) => (
              <div className="row-item" key={e.id}>
                <p className="row-title">{e.user?.full_name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="row-amount">{Number(e.net_salary).toLocaleString()} TZS</span>
                  <span className={'badge ' + (STATUS_BADGE[e.status] ?? 'badge-pending')}>{e.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const STATUS_BADGE = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  paid: 'badge-paid',
}
