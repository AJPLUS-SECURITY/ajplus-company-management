import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { isMissingTable, todayStr } from '../lib/db'
import MetricCard from '../components/MetricCard'
import SetupNotice from '../components/SetupNotice'

const OPTIONS = [
  { key: 'P', label: 'Yupo' },
  { key: 'L', label: 'Amechelewa' },
  { key: 'A', label: 'Hayupo' },
]

export default function Attendance() {
  const { profile } = useAuth()
  const [date, setDate] = useState(todayStr())
  const [guards, setGuards] = useState([])
  const [marks, setMarks] = useState({})
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [message, setMessage] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [gRes, aRes] = await Promise.all([
        supabase.from('guards').select('id, code, full_name, contract:contracts(site_name, client:clients(name))').eq('status', 'kazini').order('code'),
        supabase.from('guard_attendance').select('guard_id, status').eq('att_date', date),
      ])
      if (cancelled) return
      const err = gRes.error || aRes.error
      if (err) {
        if (isMissingTable(gRes.error, 'guards') || isMissingTable(aRes.error, 'guard_attendance')) setMissing(true)
        else setMessage({ type: 'error', text: err.message })
      } else {
        setGuards(gRes.data ?? [])
        const m = {}
        ;(aRes.data ?? []).forEach((r) => { m[r.guard_id] = r.status })
        setMarks(m)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [date])

  async function mark(guardId, status) {
    setMessage(null)
    const previous = marks[guardId]
    setMarks((m) => ({ ...m, [guardId]: status }))
    const res = await supabase
      .from('guard_attendance')
      .upsert({ guard_id: guardId, att_date: date, status, marked_by: profile?.id }, { onConflict: 'guard_id,att_date' })
    if (res.error) {
      setMarks((m) => {
        const copy = { ...m }
        if (previous) copy[guardId] = previous
        else delete copy[guardId]
        return copy
      })
      setMessage({ type: 'error', text: res.error.message })
    }
  }

  async function markAllPresent() {
    const pending = guards.filter((g) => !marks[g.id])
    if (pending.length === 0) return
    setMessage(null)
    const rows = pending.map((g) => ({ guard_id: g.id, att_date: date, status: 'P', marked_by: profile?.id }))
    const res = await supabase.from('guard_attendance').upsert(rows, { onConflict: 'guard_id,att_date' })
    if (res.error) { setMessage({ type: 'error', text: res.error.message }); return }
    setMarks((m) => {
      const copy = { ...m }
      pending.forEach((g) => { copy[g.id] = 'P' })
      return copy
    })
    setMessage({ type: 'success', text: `Walinzi ${pending.length} wamewekwa "Yupo"` })
  }

  if (loading) return <div className="page-loading">Inapakia...</div>
  if (missing) return <SetupNotice title="Moduli ya Mahudhurio bado haijawashwa" file="supabase_operations.sql" />

  const count = (k) => guards.filter((g) => marks[g.id] === k).length
  const unmarked = guards.filter((g) => !marks[g.id]).length
  const term = q.trim().toLowerCase()
  const visible = guards.filter((g) =>
    !term || [g.code, g.full_name, g.contract?.site_name, g.contract?.client?.name].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)),
  )

  return (
    <div>
      {message ? <p className={message.type === 'error' ? 'login-error' : 'reset-success'}>{message.text}</p> : null}

      <div className="metric-grid">
        <MetricCard label="Wapo" value={count('P')} prefix="" color="#085041" />
        <MetricCard label="Wamechelewa" value={count('L')} prefix="" color="#854f0b" />
        <MetricCard label="Hawapo" value={count('A')} prefix="" color="#a32d2d" />
        <MetricCard label="Hawajawekwa" value={unmarked} prefix="" />
      </div>

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Mahudhurio ya walinzi</p>
          <div className="header-buttons">
            <button className="btn-approve" onClick={markAllPresent} disabled={unmarked === 0}>Weka wote waliobaki "Yupo"</button>
          </div>
        </div>
        <div className="eq-filters">
          <input type="date" max={todayStr()} value={date} onChange={(e) => { setLoading(true); setDate(e.target.value || todayStr()) }} />
          <input type="text" placeholder="Tafuta mlinzi au kituo..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {visible.length === 0 ? (
          <p className="panel-empty">{guards.length === 0 ? 'Hakuna walinzi walio "Kazini" bado. Waongeze kwenye ukurasa wa Walinzi.' : 'Hakuna mlinzi anayelingana.'}</p>
        ) : (
          <div className="row-list">
            {visible.map((g) => (
              <div className="row-item eq-row" key={g.id}>
                <div>
                  <p className="row-title">{g.code} · {g.full_name}</p>
                  <p className="row-sub">
                    {g.contract ? `${g.contract.client?.name ? g.contract.client.name + ' — ' : ''}${g.contract.site_name}` : 'Hajapangiwa kituo'}
                  </p>
                </div>
                <div className="eq-actions">
                  {OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      className={marks[g.id] === o.key ? 'btn-approve' : 'btn-cancel'}
                      onClick={() => mark(g.id, o.key)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
