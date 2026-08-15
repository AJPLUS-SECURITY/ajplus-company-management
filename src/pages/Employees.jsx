import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SERVICE_LINE_HINT = 'Tawi la huduma linatoka kwenye Service Lines zilizopo (Settings)'

function emptyDeptForm() {
  return { name: '' }
}

function emptyPosForm() {
  return { title: '', department_id: '', base_salary: '' }
}

export default function Employees() {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const [showDeptForm, setShowDeptForm] = useState(false)
  const [deptForm, setDeptForm] = useState(emptyDeptForm())
  const [showPosForm, setShowPosForm] = useState(false)
  const [posForm, setPosForm] = useState(emptyPosForm())

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [userRes, deptRes, posRes] = await Promise.all([
      supabase
        .from('users')
        .select(
          'id, full_name, email, status, phone, national_id, hire_date, termination_date, bank_name, bank_account_number, nssf_number, tin_number, department_id, position_id, role:roles(name), service_line:service_lines(name)'
        )
        .order('full_name', { ascending: true }),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('positions').select('id, title, department_id, base_salary').order('title'),
    ])
    setUsers(userRes.data || [])
    setDepartments(deptRes.data || [])
    setPositions(posRes.data || [])
    setLoading(false)
  }

  function departmentName(id) {
    return departments.find((d) => d.id === id)?.name || '—'
  }
  function positionTitle(id) {
    return positions.find((p) => p.id === id)?.title || '—'
  }

  function openEdit(u) {
    setEditingId(u.id)
    setEditForm({
      phone: u.phone || '',
      national_id: u.national_id || '',
      hire_date: u.hire_date || '',
      department_id: u.department_id || '',
      position_id: u.position_id || '',
      bank_name: u.bank_name || '',
      bank_account_number: u.bank_account_number || '',
      nssf_number: u.nssf_number || '',
      tin_number: u.tin_number || '',
    })
    setMessage(null)
  }

  function closeEdit() {
    setEditingId(null)
    setEditForm({})
  }

  function updateEditField(field, value) {
    setEditForm((f) => ({ ...f, [field]: value }))
  }

  async function saveEdit(userId) {
    setBusy(true)
    setMessage(null)
    const payload = { ...editForm }
    payload.department_id = payload.department_id || null
    payload.position_id = payload.position_id || null
    payload.hire_date = payload.hire_date || null

    const res = await supabase.from('users').update(payload).eq('id', userId)
    setBusy(false)

    if (res.error) {
      setMessage({ type: 'error', text: res.error.message })
      return
    }
    setMessage({ type: 'success', text: 'Taarifa za mfanyakazi zimehifadhiwa' })
    closeEdit()
    await loadAll()
  }

  async function handleAddDepartment(e) {
    e.preventDefault()
    if (!deptForm.name.trim()) return
    setBusy(true)
    const res = await supabase.from('departments').insert({ name: deptForm.name.trim() })
    setBusy(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error.message })
      return
    }
    setDeptForm(emptyDeptForm())
    setShowDeptForm(false)
    await loadAll()
  }

  async function handleAddPosition(e) {
    e.preventDefault()
    if (!posForm.title.trim()) return
    setBusy(true)
    const res = await supabase.from('positions').insert({
      title: posForm.title.trim(),
      department_id: posForm.department_id || null,
      base_salary: Number(posForm.base_salary) || 0,
    })
    setBusy(false)
    if (res.error) {
      setMessage({ type: 'error', text: res.error.message })
      return
    }
    setPosForm(emptyPosForm())
    setShowPosForm(false)
    await loadAll()
  }

  if (loading) return <div className="page-loading">Inapakia wafanyakazi...</div>

  return (
    <div>
      {message ? (
        <p className={message.type === 'error' ? 'login-error' : 'reset-success'}>{message.text}</p>
      ) : null}

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Idara (Departments)</p>
          <div className="header-buttons">
            <button className="btn-cancel" onClick={() => setShowDeptForm(!showDeptForm)}>
              {showDeptForm ? 'Funga' : '+ Ongeza Idara'}
            </button>
          </div>
        </div>
        {showDeptForm && (
          <form className="income-form" onSubmit={handleAddDepartment}>
            <div className="form-row">
              <label className="full-width">
                Jina la Idara
                <input
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ name: e.target.value })}
                  placeholder="mfano: Operations"
                />
              </label>
            </div>
            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? 'Inaongeza...' : 'Hifadhi Idara'}
            </button>
          </form>
        )}
        {departments.length > 0 && (
          <div className="row-list" style={{ marginTop: 10 }}>
            {departments.map((d) => (
              <div className="row-item" key={d.id}>
                <p className="row-title">{d.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Nafasi za Kazi (Positions)</p>
          <div className="header-buttons">
            <button className="btn-cancel" onClick={() => setShowPosForm(!showPosForm)}>
              {showPosForm ? 'Funga' : '+ Ongeza Nafasi'}
            </button>
          </div>
        </div>
        {showPosForm && (
          <form className="income-form" onSubmit={handleAddPosition}>
            <div className="form-row">
              <label>
                Jina la Nafasi
                <input
                  value={posForm.title}
                  onChange={(e) => setPosForm({ ...posForm, title: e.target.value })}
                  placeholder="mfano: Site Supervisor"
                />
              </label>
              <label>
                Idara
                <select
                  value={posForm.department_id}
                  onChange={(e) => setPosForm({ ...posForm, department_id: e.target.value })}
                >
                  <option value="">— Chagua —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label className="full-width">
                Basic Salary ya kawaida (TZS)
                <input
                  type="number"
                  min="0"
                  value={posForm.base_salary}
                  onChange={(e) => setPosForm({ ...posForm, base_salary: e.target.value })}
                  placeholder="0"
                />
              </label>
            </div>
            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? 'Inaongeza...' : 'Hifadhi Nafasi'}
            </button>
          </form>
        )}
        {positions.length > 0 && (
          <div className="row-list" style={{ marginTop: 10 }}>
            {positions.map((p) => (
              <div className="row-item" key={p.id}>
                <div>
                  <p className="row-title">{p.title}</p>
                  <p className="row-sub">{departmentName(p.department_id)}</p>
                </div>
                <span className="row-amount">{Number(p.base_salary).toLocaleString()} TZS</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <p className="panel-title">Wafanyakazi wote</p>
        <p className="panel-empty" style={{ textAlign: 'left', marginTop: '-8px', marginBottom: '12px' }}>
          {SERVICE_LINE_HINT}
        </p>
        {users.length === 0 ? (
          <p className="panel-empty">Hakuna wafanyakazi.</p>
        ) : (
          <div className="row-list">
            {users.map((u) => (
              <div key={u.id} className="row-item user-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="row-item" style={{ padding: 0, border: 'none' }}>
                  <div>
                    <p className="row-title">{u.full_name}</p>
                    <p className="row-sub">
                      {u.email} · {u.role?.name}
                      {u.service_line?.name ? ` · ${u.service_line.name}` : ''}
                      {' · '}
                      {departmentName(u.department_id)} / {positionTitle(u.position_id)}
                    </p>
                  </div>
                  <div className="expense-actions" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <span className={'badge ' + (u.status === 'active' ? 'badge-approved' : 'badge-rejected')}>
                      {u.status}
                    </span>
                    {editingId === u.id ? (
                      <button className="btn-cancel" onClick={closeEdit}>Funga</button>
                    ) : (
                      <button className="btn-approve" onClick={() => openEdit(u)}>Hariri Taarifa za HR</button>
                    )}
                  </div>
                </div>

                {editingId === u.id && (
                  <form
                    className="income-form"
                    style={{ marginTop: 12, background: '#f4f3ef', padding: 12, borderRadius: 8 }}
                    onSubmit={(e) => {
                      e.preventDefault()
                      saveEdit(u.id)
                    }}
                  >
                    <div className="form-row">
                      <label>
                        Simu
                        <input value={editForm.phone} onChange={(e) => updateEditField('phone', e.target.value)} />
                      </label>
                      <label>
                        NIDA (National ID)
                        <input value={editForm.national_id} onChange={(e) => updateEditField('national_id', e.target.value)} />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Tarehe ya kuajiriwa
                        <input type="date" value={editForm.hire_date} onChange={(e) => updateEditField('hire_date', e.target.value)} />
                      </label>
                      <label>
                        Idara
                        <select value={editForm.department_id} onChange={(e) => updateEditField('department_id', e.target.value)}>
                          <option value="">— Chagua —</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Nafasi
                        <select value={editForm.position_id} onChange={(e) => updateEditField('position_id', e.target.value)}>
                          <option value="">— Chagua —</option>
                          {positions
                            .filter((p) => !editForm.department_id || p.department_id === editForm.department_id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Namba ya NSSF
                        <input value={editForm.nssf_number} onChange={(e) => updateEditField('nssf_number', e.target.value)} />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Namba ya TIN
                        <input value={editForm.tin_number} onChange={(e) => updateEditField('tin_number', e.target.value)} />
                      </label>
                      <label>
                        Benki
                        <input value={editForm.bank_name} onChange={(e) => updateEditField('bank_name', e.target.value)} />
                      </label>
                    </div>
                    <div className="form-row">
                      <label className="full-width">
                        Namba ya Akaunti ya Benki
                        <input value={editForm.bank_account_number} onChange={(e) => updateEditField('bank_account_number', e.target.value)} />
                      </label>
                    </div>
                    <button className="btn-approve submit-income" disabled={busy}>
                      {busy ? 'Inahifadhi...' : 'Hifadhi'}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
