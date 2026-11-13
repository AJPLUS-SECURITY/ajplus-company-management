import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import MetricCard from '../components/MetricCard'
import { CATEGORIES, STATUSES, daysUntil } from '../lib/equipment'
import './Equipment.css'

const STATUS_BADGE = {
  active: 'badge-approved',
  maintenance: 'badge-pending',
  damaged: 'badge-rejected',
  lost: 'badge-rejected',
  retired: 'badge-paid',
}

function emptyForm(serviceLineId) {
  return {
    name: '',
    category: 'nyingine',
    serial_number: '',
    service_line_id: serviceLineId,
    location: '',
    assigned_to: '',
    status: 'active',
    purchase_date: '',
    purchase_cost: '',
    next_service_date: '',
    notes: '',
  }
}

function isMissingTable(error) {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    (msg.includes('equipment') && (msg.includes('schema cache') || msg.includes('does not exist')))
  )
}

export default function Equipment() {
  const { profile, role } = useAuth()
  const isSupervisor = role === 'supervisor'
  const canEdit = ['md', 'admin', 'supervisor'].includes(role)
  const canDelete = ['md', 'admin'].includes(role)
  const lockedServiceLine = isSupervisor ? profile?.service_line_id : null

  const [serviceLines, setServiceLines] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [missingTable, setMissingTable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm(''))
  const [filters, setFilters] = useState({ q: '', category: 'all', status: 'all' })

  const fetchItems = useCallback(async () => {
    let query = supabase
      .from('equipment')
      .select('*, service_line:service_lines(name)')
      .order('name')
    if (lockedServiceLine) query = query.eq('service_line_id', lockedServiceLine)
    return query
  }, [lockedServiceLine])

  useEffect(() => {
    let cancelled = false
    async function init() {
      const [slRes, eqRes] = await Promise.all([
        supabase.from('service_lines').select('id, name').order('name'),
        fetchItems(),
      ])
      if (cancelled) return
      const lines = slRes.data ?? []
      setServiceLines(lines)
      setForm((f) => ({ ...f, service_line_id: lockedServiceLine || lines[0]?.id || '' }))
      if (eqRes.error) {
        if (isMissingTable(eqRes.error)) setMissingTable(true)
        else setMessage({ type: 'error', text: eqRes.error.message })
      } else {
        setItems(eqRes.data ?? [])
      }
      setLoading(false)
    }
    init()
    return () => {
      cancelled = true
    }
  }, [fetchItems, lockedServiceLine])

  async function reload() {
    const res = await fetchItems()
    if (!res.error) setItems(res.data ?? [])
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm(lockedServiceLine || serviceLines[0]?.id || ''))
    setShowForm(true)
    setMessage(null)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setForm({
      name: item.name ?? '',
      category: item.category ?? 'nyingine',
      serial_number: item.serial_number ?? '',
      service_line_id: item.service_line_id ?? '',
      location: item.location ?? '',
      assigned_to: item.assigned_to ?? '',
      status: item.status ?? 'active',
      purchase_date: item.purchase_date ?? '',
      purchase_cost: item.purchase_cost ?? '',
      next_service_date: item.next_service_date ?? '',
      notes: item.notes ?? '',
    })
    setShowForm(true)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (!form.name.trim()) {
      setMessage({ type: 'error', text: 'Jaza jina la kifaa' })
      return
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      serial_number: form.serial_number.trim() || null,
      service_line_id: form.service_line_id || null,
      location: form.location.trim() || null,
      assigned_to: form.assigned_to.trim() || null,
      status: form.status,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost === '' ? null : Number(form.purchase_cost),
      next_service_date: form.next_service_date || null,
      notes: form.notes.trim() || null,
    }

    setBusy(true)
    const res = editingId
      ? await supabase.from('equipment').update(payload).eq('id', editingId)
      : await supabase.from('equipment').insert({ ...payload, created_by: profile?.id })
    setBusy(false)

    if (res.error) {
      setMessage({ type: 'error', text: res.error.message })
      return
    }

    setMessage({ type: 'success', text: editingId ? 'Kifaa kimesasishwa' : 'Kifaa kimeongezwa kwenye register' })
    closeForm()
    await reload()
  }

  async function changeStatus(item, status) {
    setMessage(null)
    const res = await supabase.from('equipment').update({ status }).eq('id', item.id)
    if (res.error) {
      setMessage({ type: 'error', text: res.error.message })
      return
    }
    await reload()
  }

  async function handleDelete(item) {
    if (!window.confirm(`Futa "${item.name}" kutoka kwenye register? Hili haliwezi kurudishwa.`)) return
    const res = await supabase.from('equipment').delete().eq('id', item.id)
    if (res.error) {
      setMessage({ type: 'error', text: res.error.message })
      return
    }
    setMessage({ type: 'success', text: 'Kifaa kimefutwa' })
    await reload()
  }

  if (loading) return <div className="page-loading">Inapakia...</div>

  if (missingTable) {
    return (
      <div className="panel eq-setup">
        <p className="panel-title">Moduli ya Vifaa bado haijawashwa</p>
        <p className="row-sub">
          Jedwali la <code>equipment</code> halipo kwenye Supabase. Fungua Supabase, nenda <strong>SQL Editor</strong>,
          kisha endesha faili <code>supabase_equipment.sql</code> (liko kwenye repo). Ukimaliza, onyesha upya ukurasa huu.
        </p>
      </div>
    )
  }

  const q = filters.q.trim().toLowerCase()
  const visible = items.filter((it) => {
    if (filters.category !== 'all' && it.category !== filters.category) return false
    if (filters.status !== 'all' && it.status !== filters.status) return false
    if (!q) return true
    return [it.name, it.serial_number, it.location, it.assigned_to]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  })

  const total = items.length
  const working = items.filter((i) => i.status === 'active').length
  const attention = items.filter((i) => ['maintenance', 'damaged', 'lost'].includes(i.status)).length
  const serviceDue = items.filter((i) => {
    const d = daysUntil(i.next_service_date)
    return ['active', 'maintenance'].includes(i.status) && d !== null && d <= 30
  }).length

  return (
    <div>
      {message ? (
        <p className={message.type === 'error' ? 'login-error' : 'reset-success'}>{message.text}</p>
      ) : null}

      <div className="metric-grid">
        <MetricCard label="Vifaa vyote" value={total} prefix="" />
        <MetricCard label="Vinafanya kazi" value={working} prefix="" color="#085041" />
        <MetricCard label="Vinahitaji umakini" value={attention} prefix="" color="#a32d2d" />
        <MetricCard label="Huduma siku 30" value={serviceDue} prefix="" color="#854f0b" />
      </div>

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">{editingId ? 'Hariri kifaa' : 'Register ya Vifaa'}</p>
          {canEdit ? (
            <div className="header-buttons">
              <button className="btn-approve" onClick={showForm ? closeForm : openNew}>
                {showForm ? 'Funga fomu' : 'Ongeza kifaa'}
              </button>
            </div>
          ) : null}
        </div>

        {showForm && canEdit ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Jina la kifaa
                <input
                  type="text"
                  placeholder="mfano: Redio ya Motorola #3"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </label>
              <label>
                Aina
                <select value={form.category} onChange={(e) => updateField('category', e.target.value)}>
                  {Object.entries(CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Serial / Namba ya kifaa
                <input
                  type="text"
                  value={form.serial_number}
                  onChange={(e) => updateField('serial_number', e.target.value)}
                />
              </label>
              <label>
                Huduma
                <select
                  value={form.service_line_id}
                  onChange={(e) => updateField('service_line_id', e.target.value)}
                  disabled={isSupervisor}
                >
                  {serviceLines.map((sl) => (
                    <option key={sl.id} value={sl.id}>{sl.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Mahali / Site kilipo
                <input
                  type="text"
                  placeholder="mfano: Ofisi Tegeta, Site ya Mafinga"
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                />
              </label>
              <label>
                Anayekitumia / Aliyekabidhiwa
                <input
                  type="text"
                  value={form.assigned_to}
                  onChange={(e) => updateField('assigned_to', e.target.value)}
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Hali
                <select value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                  {Object.entries(STATUSES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Huduma/ukaguzi unaofuata
                <input
                  type="date"
                  value={form.next_service_date}
                  onChange={(e) => updateField('next_service_date', e.target.value)}
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Tarehe ya kununua
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => updateField('purchase_date', e.target.value)}
                />
              </label>
              <label>
                Gharama ya kununua (TZS)
                <input
                  type="number"
                  min="0"
                  value={form.purchase_cost}
                  onChange={(e) => updateField('purchase_cost', e.target.value)}
                />
              </label>
            </div>

            <label className="full-width">
              Maelezo
              <textarea
                style={{ minHeight: 80 }}
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
            </label>

            <div className="header-buttons">
              <button className="btn-approve submit-income" disabled={busy}>
                {busy ? 'Inahifadhi...' : editingId ? 'Hifadhi mabadiliko' : 'Hifadhi kifaa'}
              </button>
              <button type="button" className="btn-cancel" onClick={closeForm}>Ghairi</button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <div className="eq-filters">
          <input
            type="text"
            placeholder="Tafuta kwa jina, serial, mahali au mtumiaji..."
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="all">Aina zote</option>
            {Object.entries(CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="all">Hali zote</option>
            {Object.entries(STATUSES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {visible.length === 0 ? (
          <p className="panel-empty">
            {items.length === 0 ? 'Hakuna vifaa vilivyosajiliwa bado.' : 'Hakuna kifaa kinacholingana na utafutaji.'}
          </p>
        ) : (
          <div className="row-list">
            {visible.map((item) => {
              const d = daysUntil(item.next_service_date)
              const active = ['active', 'maintenance'].includes(item.status)
              return (
                <div className="row-item eq-row" key={item.id}>
                  <div>
                    <p className="row-title">{item.name}</p>
                    <p className="row-sub">
                      {[
                        CATEGORIES[item.category] ?? item.category,
                        item.serial_number ? `S/N ${item.serial_number}` : null,
                        item.service_line?.name,
                        item.location,
                        item.assigned_to ? `Mtumiaji: ${item.assigned_to}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <div className="eq-actions">
                    {active && d !== null && d < 0 ? (
                      <span className="badge badge-rejected">Huduma imechelewa siku {Math.abs(d)}</span>
                    ) : null}
                    {active && d !== null && d >= 0 && d <= 30 ? (
                      <span className="badge badge-pending">Huduma baada ya siku {d}</span>
                    ) : null}

                    {canEdit ? (
                      <select value={item.status} onChange={(e) => changeStatus(item, e.target.value)}>
                        {Object.entries(STATUSES).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`badge ${STATUS_BADGE[item.status] ?? ''}`}>
                        {STATUSES[item.status] ?? item.status}
                      </span>
                    )}

                    {canEdit ? (
                      <button className="btn-cancel" onClick={() => openEdit(item)}>Hariri</button>
                    ) : null}
                    {canDelete ? (
                      <button className="btn-cancel eq-danger" onClick={() => handleDelete(item)}>Futa</button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
