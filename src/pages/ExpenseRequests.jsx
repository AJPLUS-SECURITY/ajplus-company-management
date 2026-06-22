import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const STATUS_BADGE = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  paid: 'badge-paid',
}

const STATUS_LABEL = {
  pending: 'Inasubiri',
  approved: 'Imekubaliwa',
  rejected: 'Imekataliwa',
  paid: 'Imelipwa',
}

// ───────────────────────────────────────────────────────────
// THRESHOLD YA APPROVAL — badilisha namba hizi kulingana na uamuzi wa MD
// ───────────────────────────────────────────────────────────
const THRESHOLDS = {
  SUPERVISOR_MAX: 100000,   // chini ya TZS 100,000 -> Supervisor anaweza approve
  FAO_MAX: 1000000,         // TZS 100,000 - 1,000,000 -> FAO anaweza approve
  // zaidi ya TZS 1,000,000 -> MD/Admin tu
}

// Ngazi inayohitajika kuapprove kiasi fulani (kwa ajili ya kuonyesha kwenye UI)
function getRequiredLevel(amount) {
  const n = Number(amount)
  if (n < THRESHOLDS.SUPERVISOR_MAX) return 'Supervisor'
  if (n <= THRESHOLDS.FAO_MAX) return 'FAO'
  return 'MD'
}

// Je mtumiaji huyu (kwa role yake) anaweza kuapprove kiasi hiki?
// MD/Admin wanaweza kuapprove kila kitu. FAO anaweza hadi FAO_MAX.
// Supervisor anaweza tu chini ya SUPERVISOR_MAX.
function canUserApprove(role, amount) {
  const n = Number(amount)
  if (role === 'admin' || role === 'md') return true
  if (role === 'fao') return n <= THRESHOLDS.FAO_MAX
  if (role === 'supervisor') return n < THRESHOLDS.SUPERVISOR_MAX
  return false
}

export default function ExpenseRequests() {
  const { profile, role } = useAuth()
  const [serviceLines, setServiceLines] = useState([])
  const [categories, setCategories] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showRejected, setShowRejected] = useState(false)

  const [form, setForm] = useState({
    service_line_id: '',
    category_id: '',
    amount: '',
    reason: '',
  })

  const canCreate = ['employee', 'supervisor', 'md', 'admin'].includes(role)
  // canApprove hapa ni "ruhusa ya kimsingi ya kuwa approver" — kiasi maalum
  // kinachagua kama mtu huyu anaweza kuapprove ombi LILE kupitia canUserApprove()
  const canApproveRole = ['supervisor', 'fao', 'md', 'admin'].includes(role)
  const canMarkPaid = ['fao', 'md', 'admin'].includes(role)
  const canViewRejectedHistory = ['md', 'admin'].includes(role)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [slRes, catRes] = await Promise.all([
      supabase.from('service_lines').select('id, name').order('name'),
      supabase.from('expense_categories').select('id, name').order('name'),
    ])
    setServiceLines(slRes.data ?? [])
    setCategories(catRes.data ?? [])
    if (slRes.data?.length) {
      setForm((f) => ({ ...f, service_line_id: f.service_line_id || (profile?.service_line_id ?? slRes.data[0].id) }))
    }
    if (catRes.data?.length) {
      setForm((f) => ({ ...f, category_id: f.category_id || catRes.data[0].id }))
    }
    await loadRequests()
    setLoading(false)
  }

  async function loadRequests() {
    let query = supabase
      .from('expense_requests')
      .select(
        'id, reason, amount, status, required_approvals, current_approvals, created_at, paid_at, service_line:service_lines(id, name), requester:requester_id(full_name), category:expense_categories(name)'
      )
      .order('created_at', { ascending: false })
      .limit(30)

    const { data } = await query
    setRequests(data ?? [])
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (!form.service_line_id || !form.amount || !form.reason) {
      setMessage({ type: 'error', text: 'Jaza huduma, kiasi, na sababu' })
      return
    }
    if (Number(form.amount) <= 0) {
      setMessage({ type: 'error', text: 'Kiasi lazima kiwe kikubwa kuliko sifuri' })
      return
    }

    setBusy(true)
    const { error } = await supabase.from('expense_requests').insert({
      requester_id: profile.id,
      service_line_id: form.service_line_id,
      category_id: form.category_id || null,
      amount: Number(form.amount),
      reason: form.reason,
    })
    setBusy(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: 'Ombi limetumwa kikamilifu' })
    setForm((f) => ({ ...f, amount: '', reason: '' }))
    setShowForm(false)
    await loadRequests()
  }

  async function handleApprove(requestId, decision, amount) {
    setMessage(null)

    // Ulinzi wa ziada upande wa frontend: hata kama button imeonekana kwa
    // bahati, hatuhitaji kuruhusu approve kama role haifai kwa kiasi hiki.
    if (decision === 'approved' && !canUserApprove(role, amount)) {
      setMessage({ type: 'error', text: 'Huna ruhusa ya kuapprove kiasi hiki. Inahitaji: ' + getRequiredLevel(amount) })
      return
    }

    const { error } = await supabase.from('expense_approvals').insert({
      expense_request_id: requestId,
      approver_id: profile.id,
      approver_role: role,
      decision,
    })

    if (error) {
      const friendly = error.message?.includes('duplicate key')
        ? 'Tayari umeshatoa uamuzi kwenye ombi hili - haiwezi kubadilishwa.'
        : error.message
      setMessage({ type: 'error', text: friendly })
      return
    }

    setMessage({ type: 'success', text: decision === 'approved' ? 'Umekubali ombi' : 'Umekataa ombi' })
    await loadRequests()
  }

  async function handleMarkPaid(requestId) {
    setMessage(null)
    const { error } = await supabase
      .from('expense_requests')
      .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: profile.id })
      .eq('id', requestId)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: 'Ombi limewekwa kama limelipwa' })
    await loadRequests()
  }

  if (loading) return <div className="page-loading">Inapakia...</div>

  return (
    <div>
      {message && (
        <p className={message.type === 'error' ? 'login-error' : 'reset-success'}>
          {message.text}
        </p>
      )}

      {canCreate && (
        <div className="panel">
          <div className="panel-header-row">
            <p className="panel-title">Maombi ya fedha</p>
            <button className="btn-approve" onClick={() => setShowForm((s) => !s)}>
              {showForm ? 'Funga fomu' : 'Ongeza ombi jipya'}
            </button>
          </div>

          {showForm && (
            <form className="income-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <label>
                  Huduma
                  <select
                    value={form.service_line_id}
                    onChange={(e) => updateField('service_line_id', e.target.value)}
                  >
                    {serviceLines.map((sl) => (
                      <option key={sl.id} value={sl.id}>
                        {sl.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Aina ya matumizi
                  <select
                    value={form.category_id}
                    onChange={(e) => updateField('category_id', e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Kiasi (TZS)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => updateField('amount', e.target.value)}
                  />
                </label>

                <label>
                  Sababu
                  <input
                    type="text"
                    placeholder="mfano: Mafuta ya gari la doria"
                    value={form.reason}
                    onChange={(e) => updateField('reason', e.target.value)}
                  />
                </label>
              </div>

              {form.amount && (
                <p className="row-sub">
                  Kiasi hiki kitahitaji approval ya: <strong>{getRequiredLevel(form.amount)}</strong>
                </p>
              )}

              <button className="btn-approve submit-income" disabled={busy}>
                {busy ? 'Inatuma...' : 'Tuma ombi'}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Maombi yote</p>
          {canViewRejectedHistory && (
            <button className="btn-cancel" onClick={() => setShowRejected((s) => !s)}>
              {showRejected ? 'Ficha yaliyokataliwa' : 'Onyesha yaliyokataliwa'}
            </button>
          )}
        </div>
        {requests.length === 0 ? (
          <p className="panel-empty">Hakuna maombi bado.</p>
        ) : (
          <div className="row-list">
            {requests
              .filter((r) => showRejected || r.status !== 'rejected')
              .map((r) => {
              const requiredLevel = getRequiredLevel(r.amount)
              const userCanApproveThis = canApproveRole && canUserApprove(role, r.amount)

              return (
                <div className="row-item expense-row" key={r.id}>
                  <div>
                    <p className="row-title">{r.reason}</p>
                    <p className="row-sub">
                      {r.service_line?.name} · {r.requester?.full_name} · {r.category?.name ?? 'Bila aina'}
                    </p>
                    <p className="row-sub">
                      Approvals: {r.current_approvals}/{r.required_approvals} · Inahitaji: {requiredLevel}
                    </p>
                  </div>

                  <div className="expense-actions">
                    <span className="row-amount">{Number(r.amount).toLocaleString()} TZS</span>
                    <span className={'badge ' + (STATUS_BADGE[r.status] ?? 'badge-pending')}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>

                    {r.status === 'pending' && canApproveRole && (
                      userCanApproveThis ? (
                        <div className="expense-buttons">
                          <button className="btn-approve" onClick={() => handleApprove(r.id, 'approved', r.amount)}>
                            Kubali
                          </button>
                          <button className="btn-cancel" onClick={() => handleApprove(r.id, 'rejected', r.amount)}>
                            Kataa
                          </button>
                        </div>
                      ) : (
                        <span className="row-sub">Inasubiri {requiredLevel}</span>
                      )
                    )}

                    {canMarkPaid && r.status === 'approved' && (
                      <button className="btn-approve" onClick={() => handleMarkPaid(r.id)}>
                        Weka kama imelipwa
                      </button>
                    )}
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
