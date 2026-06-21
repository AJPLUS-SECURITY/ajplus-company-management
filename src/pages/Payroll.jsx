import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../contexts/AuthContext"

const STATUS_BADGE = {
  pending: "badge-pending",
  paid: "badge-paid",
}

const STATUS_LABEL = {
  pending: "Inasubiri",
  paid: "Imelipwa",
}

function currentMonth() {
  const now = new Date()
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0")
}

export default function Payroll() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    user_id: "",
    month: currentMonth(),
    basic_salary: "",
    allowances: "",
    deductions: "",
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const empRes = await supabase
      .from("users")
      .select("id, full_name")
      .eq("status", "active")
      .order("full_name")

    setEmployees(empRes.data || [])

    if (empRes.data && empRes.data.length > 0) {
      setForm(function (f) {
        const copy = Object.assign({}, f)
        if (!copy.user_id) {
          copy.user_id = empRes.data[0].id
        }
        return copy
      })
    }

    await loadRecords()
    setLoading(false)
  }

  async function loadRecords() {
    const res = await supabase
      .from("payroll_records")
      .select("id, user_id, month, basic_salary, allowances, deductions, net_salary, status, paid_at")
      .order("created_at", { ascending: false })
      .limit(30)
    setRecords(res.data || [])
  }

  function employeeName(userId) {
    const emp = employees.find(function (e) {
      return e.id === userId
    })
    return emp ? emp.full_name : "Mfanyakazi"
  }

  function updateField(field, value) {
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy[field] = value
      return copy
    })
  }

  function calculateNet() {
    const basic = Number(form.basic_salary) || 0
    const allow = Number(form.allowances) || 0
    const deduct = Number(form.deductions) || 0
    return basic + allow - deduct
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (!form.user_id || !form.month || !form.basic_salary) {
      setMessage({ type: "error", text: "Chagua mfanyakazi, mwezi na mshahara wa msingi" })
      return
    }

    setBusy(true)

    const net = calculateNet()

    const res = await supabase
      .from("payroll_records")
      .insert({
        user_id: form.user_id,
        month: form.month,
        basic_salary: Number(form.basic_salary) || 0,
        allowances: Number(form.allowances) || 0,
        deductions: Number(form.deductions) || 0,
        net_salary: net,
        status: "pending",
        created_by: profile.id,
      })
      .select("id")
      .single()

    setBusy(false)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: "Malipo ya mshahara yameongezwa" })
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy.basic_salary = ""
      copy.allowances = ""
      copy.deductions = ""
      return copy
    })
    setShowForm(false)
    await loadRecords()
  }

  async function markAsPaid(recordId) {
    setMessage(null)
    const res = await supabase
      .from("payroll_records")
      .update({ status: "paid", paid_at: new Date().toISOString().slice(0, 10) })
      .eq("id", recordId)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: "Mshahara umewekwa kama umelipwa" })
    await loadRecords()
  }

  if (loading) {
    return <div className="page-loading">Inapakia...</div>
  }

  return (
    <div>
      {message ? (
        <p className={message.type === "error" ? "login-error" : "reset-success"}>
          {message.text}
        </p>
      ) : null}

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Payroll</p>
          <div className="header-buttons">
            <button
              className="btn-approve"
              onClick={function () {
                setShowForm(!showForm)
              }}
            >
              {showForm ? "Funga fomu" : "Ongeza malipo"}
            </button>
          </div>
        </div>

        {showForm ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Mfanyakazi
                <select
                  value={form.user_id}
                  onChange={function (e) {
                    updateField("user_id", e.target.value)
                  }}
                >
                  {employees.map(function (emp) {
                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label>
                Mwezi
                <input
                  type="month"
                  value={form.month}
                  onChange={function (e) {
                    updateField("month", e.target.value)
                  }}
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Mshahara wa msingi (TZS)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.basic_salary}
                  onChange={function (e) {
                    updateField("basic_salary", e.target.value)
                  }}
                />
              </label>
              <label>
                Posho (TZS)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.allowances}
                  onChange={function (e) {
                    updateField("allowances", e.target.value)
                  }}
                />
              </label>
            </div>

            <label className="full-width">
              Makato (TZS)
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.deductions}
                onChange={function (e) {
                  updateField("deductions", e.target.value)
                }}
              />
            </label>

            <p className="invoice-total">Jumla ya malipo: {calculateNet().toLocaleString()} TZS</p>

            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? "Inaongeza..." : "Hifadhi malipo"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <p className="panel-title">Malipo ya mishahara</p>
        {records.length === 0 ? (
          <p className="panel-empty">Hakuna malipo yaliyoongezwa bado.</p>
        ) : (
          <div className="row-list">
            {records.map(function (r) {
              return (
                <div className="row-item expense-row" key={r.id}>
                  <div>
                    <p className="row-title">
                      {employeeName(r.user_id)} — {r.month}
                    </p>
                    <p className="row-sub">
                      Msingi: {Number(r.basic_salary).toLocaleString()} · Posho:{" "}
                      {Number(r.allowances).toLocaleString()} · Makato:{" "}
                      {Number(r.deductions).toLocaleString()}
                    </p>
                  </div>
                  <div className="expense-actions">
                    <span className="row-amount">{Number(r.net_salary).toLocaleString()} TZS</span>
                    <span className={"badge " + (STATUS_BADGE[r.status] || "badge-pending")}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                    {r.status !== "paid" ? (
                      <button
                        className="btn-approve"
                        onClick={function () {
                          markAsPaid(r.id)
                        }}
                      >
                        Weka kama imelipwa
                      </button>
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
