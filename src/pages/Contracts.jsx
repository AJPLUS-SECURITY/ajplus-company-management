import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { contractState } from '../lib/ops'
import { isMissingTable, fmtTzs } from '../lib/db'
import MetricCard from '../components/MetricCard'
import SetupNotice from '../components/SetupNotice'

const STATUS_LABEL = { active: 'Hai', suspended: 'Imesimamishwa', ended: 'Imeisha' }

function emptyForm(serviceLineId, clientId) {
  return {
    client_id: clientId || '',
    new_client_name: '',
    new_client_phone: '',
    site_name: '',
    service_line_id: serviceLineId || '',
    guards_required: '1',
    monthly_fee: '',
    start_date: '',
    end_date: '',
    status: 'active',
    notes: '',
  }
}

export default function Contracts() {
  const { profile, role } = useAuth()
  const canDelete = ['md', 'admin'].includes(role)
  const [items, setItems] = useState([])
  const [clients, setClients] = useState([])
  const [serviceLines, setServiceLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [q, setQ] = useState('')

  async function fetchAll() {
    return Promise.all([
      supabase.from('contracts').select('*, client:clients(name, phone), service_line:service_lines(name)').order('end_date', { ascending: true, nullsFirst: false }),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('service_lines').select('id, name').order('name'),
    ])
  }

  function apply(res) {
    const [cRes, clRes, slRes] = res
    if (cRes.error) {
      if (isMissingTable(cRes.error, 'contracts')) setMissing(true)
      else setMessage({ type: 'error', text: cRes.error.message })
    } else {
      setItems(cRes.data ?? [])
    }
    setClients(clRes.data ?? [])
    setServiceLines(slRes.data ?? [])
    setForm((f) => (f.service_line_id ? f : { ...f, service_line_id: slRes.data?.[0]?.id ?? '' }))
  }

  useEffect(() => {
    let cancelled = false
    fetchAll().then((res) => {
      if (cancelled) return
      apply(res)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  async function reload() {
    apply(await fetchAll())
  }

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm(serviceLines[0]?.id, clients[0]?.id))
    setShowForm(true)
    setMessage(null)
  }

  function openEdit(c) {
    setEditingId(c.id)
    setForm({
      client_id: c.client_id ?? '',
      new_client_name: '',
      new_client_phone: '',
      site_name: c.site_name ?? '',
      service_line_id: c.service_line_id ?? '',
      guards_required: String(c.guards_required ?? 1),
      monthly_fee: c.monthly_fee ?? '',
      start_date: c.start_date ?? '',
      end_date: c.end_date ?? '',
      status: c.status ?? 'active',
      notes: c.notes ?? '',
    })
    setShowForm(true)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)
    if (!form.site_name.trim()) { setMessage({ type: 'error', text: 'Jaza jina la kituo/site' }); return }
    if (form.client_id === '__new' && !form.new_client_name.trim()) { setMessage({ type: 'error', text: 'Jaza jina la mteja mpya' }); return }
    if (!form.client_id) { setMessage({ type: 'error', text: 'Chagua mteja' }); return }
    if (form.start_date && form.end_date && form.end_date < form.start_date) { setMessage({ type: 'error', text: 'Tarehe ya mwisho iwe baada ya ya kuanza' }); return }

    setBusy(true)
    let clientId = form.client_id
    if (clientId === '__new') {
      const cRes = await supabase.from('clients').insert({ name: form.new_client_name.trim(), phone: form.new_client_phone.trim() || null }).select('id').single()
      if (cRes.error) { setBusy(false); setMessage({ type: 'error', text: cRes.error.message }); return }
      clientId = cRes.data.id
    }

    const payload = {
      client_id: clientId,
      site_name: form.site_name.trim(),
      service_line_id: form.service_line_id || null,
      guards_required: Number(form.guards_required) || 0,
      monthly_fee: Number(form.monthly_fee) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    }
    const res = editingId
      ? await supabase.from('contracts').update(payload).eq('id', editingId)
      : await supabase.from('contracts').insert({ ...payload, created_by: profile?.id })
    setBusy(false)
    if (res.error) { setMessage({ type: 'error', text: res.error.message }); return }
    setMessage({ type: 'success', text: editingId ? 'Mkataba umesasishwa' : 'Mkataba umeongezwa' })
    setShowForm(false)
    setEditingId(null)
    await reload()
  }

  async function handleDelete(c) {
    if (!window.confirm(`Futa mkataba wa "${c.site_name}"? Walinzi waliounganishwa watabaki bila kituo.`)) return
    const res = await supabase.from('contracts').delete().eq('id', c.id)
    if (res.error) { setMessage({ type: 'error', text: res.error.message }); return }
    setMessage({ type: 'success', text: 'Mkataba umefutwa' })
    await reload()
  }

  if (loading) return <div className="page-loading">Inapakia...</div>
  if (missing) return <SetupNotice title="Moduli ya Mikataba bado haijawashwa" file="supabase_operations.sql" />

  const states = items.map((c) => ({ c, s: contractState(c) }))
  const live = states.filter((x) => ['ok', 'soon'].includes(x.s.key))
  const soon = states.filter((x) => x.s.key === 'soon').length
  const expired = states.filter((x) => x.s.key === 'expired').length
  const monthly = live.reduce((sum, x) => sum + Number(x.c.monthly_fee || 0), 0)

  const term = q.trim().toLowerCase()
  const visible = states.filter(({ c }) =>
    !term || [c.site_name, c.client?.name, c.service_line?.name].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)),
  )

  return (
    <div>
      {message ? <p className={message.type === 'error' ? 'login-error' : 'reset-success'}>{message.text}</p> : null}

      <div className="metric-grid">
        <MetricCard label="Mikataba hai" value={live.length} prefix="" color="#085041" />
        <MetricCard label="Inaisha ndani ya siku 60" value={soon} prefix="" color="#854f0b" />
        <MetricCard label="Muda umeisha" value={expired} prefix="" color="#a32d2d" />
        <MetricCard label="Ada ya kila mwezi (mikataba hai)" value={monthly} />
      </div>

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">{editingId ? 'Hariri mkataba' : 'Wateja na Mikataba'}</p>
          <div className="header-buttons">
            <button className="btn-approve" onClick={showForm ? () => { setShowForm(false); setEditingId(null) } : openNew}>
              {showForm ? 'Funga fomu' : 'Ongeza mkataba'}
            </button>
          </div>
        </div>

        {showForm ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Mteja
                <select value={form.client_id} onChange={(e) => setField('client_id', e.target.value)}>
                  <option value="">— Chagua —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new">+ Mteja mpya</option>
                </select>
              </label>
              <label>
                Kituo / Site
                <input type="text" placeholder="mfano: Tawi la Tegeta" value={form.site_name} onChange={(e) => setField('site_name', e.target.value)} />
              </label>
            </div>

            {form.client_id === '__new' ? (
              <div className="form-row">
                <label>
                  Jina la mteja mpya
                  <input type="text" value={form.new_client_name} onChange={(e) => setField('new_client_name', e.target.value)} />
                </label>
                <label>
                  Simu ya mteja
                  <input type="text" value={form.new_client_phone} onChange={(e) => setField('new_client_phone', e.target.value)} />
                </label>
              </div>
            ) : null}

            <div className="form-row">
              <label>
                Huduma
                <select value={form.service_line_id} onChange={(e) => setField('service_line_id', e.target.value)}>
                  {serviceLines.map((sl) => <option key={sl.id} value={sl.id}>{sl.name}</option>)}
                </select>
              </label>
              <label>
                Hali ya mkataba
                <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Idadi ya walinzi wanaohitajika
                <input type="number" min="0" value={form.guards_required} onChange={(e) => setField('guards_required', e.target.value)} />
              </label>
              <label>
                Ada kwa mwezi (TZS)
                <input type="number" min="0" value={form.monthly_fee} onChange={(e) => setField('monthly_fee', e.target.value)} />
              </label>
            </div>

            <div className="form-row">
              <label>
                Tarehe ya kuanza
                <input type="date" value={form.start_date} onChange={(e) => setField('start_date', e.target.value)} />
              </label>
              <label>
                Tarehe ya kuisha
                <input type="date" value={form.end_date} onChange={(e) => setField('end_date', e.target.value)} />
              </label>
            </div>

            <label className="full-width">
              Maelezo
              <textarea style={{ minHeight: 70 }} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </label>

            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? 'Inahifadhi...' : editingId ? 'Hifadhi mabadiliko' : 'Hifadhi mkataba'}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <div className="eq-filters">
          <input type="text" placeholder="Tafuta mteja au kituo..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {visible.length === 0 ? (
          <p className="panel-empty">{items.length === 0 ? 'Hakuna mikataba bado.' : 'Hakuna mkataba unaolingana.'}</p>
        ) : (
          <div className="row-list">
            {visible.map(({ c, s }) => (
              <div className="row-item eq-row" key={c.id}>
                <div>
                  <p className="row-title">{c.client?.name ?? 'Mteja'} — {c.site_name}</p>
                  <p className="row-sub">
                    {[
                      c.service_line?.name,
                      `Walinzi ${c.guards_required}`,
                      `TZS ${fmtTzs(c.monthly_fee)}/mwezi`,
                      c.end_date ? `Inaisha ${c.end_date}` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="eq-actions">
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <button className="btn-cancel" onClick={() => openEdit(c)}>Hariri</button>
                  {canDelete ? <button className="btn-cancel eq-danger" onClick={() => handleDelete(c)}>Futa</button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
