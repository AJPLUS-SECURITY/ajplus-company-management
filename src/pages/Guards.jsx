import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { isMissingTable } from '../lib/db'
import MetricCard from '../components/MetricCard'
import SetupNotice from '../components/SetupNotice'

const STATUS_LABEL = { kazini: 'Kazini', likizo: 'Likizo', amesimamishwa: 'Amesimamishwa' }
const STATUS_BADGE = { kazini: 'badge-approved', likizo: 'badge-pending', amesimamishwa: 'badge-rejected' }

function emptyForm(code) {
  return { code, full_name: '', phone: '', contract_id: '', status: 'kazini', hire_date: '', notes: '' }
}

export default function Guards() {
  const { profile, role } = useAuth()
  const canEdit = ['md', 'admin', 'supervisor', 'hr'].includes(role)
  const canDelete = ['md', 'admin'].includes(role)
  const [items, setItems] = useState([])
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm(''))
  const [filters, setFilters] = useState({ q: '', status: 'all' })

  async function fetchAll() {
    return Promise.all([
      supabase.from('guards').select('*, contract:contracts(site_name, client:clients(name))').order('code'),
      supabase.from('contracts').select('id, site_name, status, client:clients(name)').order('site_name'),
    ])
  }

  function apply(res) {
    const [gRes, cRes] = res
    if (gRes.error) {
      if (isMissingTable(gRes.error, 'guards')) setMissing(true)
      else setMessage({ type: 'error', text: gRes.error.message })
    } else {
      setItems(gRes.data ?? [])
    }
    setContracts(cRes.data ?? [])
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

  async function reload() { apply(await fetchAll()) }
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  function nextCode() {
    const nums = items.map((g) => Number(String(g.code).replace(/\D/g, '')) || 0)
    return 'AJ-' + String(Math.max(0, ...nums) + 1).padStart(3, '0')
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm(nextCode()))
    setShowForm(true)
    setMessage(null)
  }

  function openEdit(g) {
    setEditingId(g.id)
    setForm({
      code: g.code ?? '',
      full_name: g.full_name ?? '',
      phone: g.phone ?? '',
      contract_id: g.contract_id ?? '',
      status: g.status ?? 'kazini',
      hire_date: g.hire_date ?? '',
      notes: g.notes ?? '',
    })
    setShowForm(true)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)
    if (!form.full_name.trim() || !form.code.trim()) { setMessage({ type: 'error', text: 'Jaza namba na jina la mlinzi' }); return }
    const payload = {
      code: form.code.trim(),
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      contract_id: form.contract_id || null,
      status: form.status,
      hire_date: form.hire_date || null,
      notes: form.notes.trim() || null,
    }
    setBusy(true)
    const res = editingId
      ? await supabase.from('guards').update(payload).eq('id', editingId)
      : await supabase.from('guards').insert({ ...payload, created_by: profile?.id })
    setBusy(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error.code === '23505' ? 'Namba hiyo ya mlinzi tayari ipo. Tumia nyingine.' : res.error.message })
      return
    }
    setMessage({ type: 'success', text: editingId ? 'Mlinzi amesasishwa' : 'Mlinzi ameongezwa' })
    setShowForm(false)
    setEditingId(null)
    await reload()
  }

  async function changeStatus(g, status) {
    const res = await supabase.from('guards').update({ status }).eq('id', g.id)
    if (res.error) { setMessage({ type: 'error', text: res.error.message }); return }
    await reload()
  }

  async function handleDelete(g) {
    if (!window.confirm(`Futa mlinzi "${g.full_name}"? Rekodi zake za mahudhurio zitafutwa pia.`)) return
    const res = await supabase.from('guards').delete().eq('id', g.id)
    if (res.error) { setMessage({ type: 'error', text: res.error.message }); return }
    setMessage({ type: 'success', text: 'Mlinzi amefutwa' })
    await reload()
  }

  if (loading) return <div className="page-loading">Inapakia...</div>
  if (missing) return <SetupNotice title="Moduli ya Walinzi bado haijawashwa" file="supabase_operations.sql" />

  const term = filters.q.trim().toLowerCase()
  const visible = items.filter((g) => {
    if (filters.status !== 'all' && g.status !== filters.status) return false
    if (!term) return true
    return [g.code, g.full_name, g.phone, g.contract?.site_name, g.contract?.client?.name]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
  })

  const count = (s) => items.filter((g) => g.status === s).length
  const unassigned = items.filter((g) => g.status === 'kazini' && !g.contract_id).length

  return (
    <div>
      {message ? <p className={message.type === 'error' ? 'login-error' : 'reset-success'}>{message.text}</p> : null}

      <div className="metric-grid">
        <MetricCard label="Walinzi wote" value={items.length} prefix="" />
        <MetricCard label="Kazini" value={count('kazini')} prefix="" color="#085041" />
        <MetricCard label="Likizo" value={count('likizo')} prefix="" color="#854f0b" />
        <MetricCard label="Hawana kituo" value={unassigned} prefix="" color="#a32d2d" />
      </div>

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">{editingId ? 'Hariri mlinzi' : 'Walinzi'}</p>
          {canEdit ? (
            <div className="header-buttons">
              <button className="btn-approve" onClick={showForm ? () => { setShowForm(false); setEditingId(null) } : openNew}>
                {showForm ? 'Funga fomu' : 'Ongeza mlinzi'}
              </button>
            </div>
          ) : null}
        </div>

        {showForm && canEdit ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Namba ya mlinzi
                <input type="text" value={form.code} onChange={(e) => setField('code', e.target.value)} />
              </label>
              <label>
                Jina kamili
                <input type="text" value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Simu
                <input type="text" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
              </label>
              <label>
                Kituo (mkataba)
                <select value={form.contract_id} onChange={(e) => setField('contract_id', e.target.value)}>
                  <option value="">— Hajapangiwa —</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>{c.client?.name ? `${c.client.name} — ` : ''}{c.site_name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Hali
                <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label>
                Tarehe ya kuajiriwa
                <input type="date" value={form.hire_date} onChange={(e) => setField('hire_date', e.target.value)} />
              </label>
            </div>
            <label className="full-width">
              Maelezo
              <textarea style={{ minHeight: 70 }} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </label>
            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? 'Inahifadhi...' : editingId ? 'Hifadhi mabadiliko' : 'Hifadhi mlinzi'}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <div className="eq-filters">
          <input type="text" placeholder="Tafuta kwa jina, namba, simu au kituo..." value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="all">Hali zote</option>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {visible.length === 0 ? (
          <p className="panel-empty">{items.length === 0 ? 'Hakuna walinzi waliosajiliwa bado.' : 'Hakuna mlinzi anayelingana.'}</p>
        ) : (
          <div className="row-list">
            {visible.map((g) => (
              <div className="row-item eq-row" key={g.id}>
                <div>
                  <p className="row-title">{g.code} · {g.full_name}</p>
                  <p className="row-sub">
                    {[
                      g.contract ? `${g.contract.client?.name ? g.contract.client.name + ' — ' : ''}${g.contract.site_name}` : 'Hajapangiwa kituo',
                      g.phone,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="eq-actions">
                  {canEdit ? (
                    <select value={g.status} onChange={(e) => changeStatus(g, e.target.value)}>
                      {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  ) : (
                    <span className={`badge ${STATUS_BADGE[g.status] ?? ''}`}>{STATUS_LABEL[g.status] ?? g.status}</span>
                  )}
                  {canEdit ? <button className="btn-cancel" onClick={() => openEdit(g)}>Hariri</button> : null}
                  {canDelete ? <button className="btn-cancel eq-danger" onClick={() => handleDelete(g)}>Futa</button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
