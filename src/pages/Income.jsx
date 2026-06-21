import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../contexts/AuthContext"

const PAYMENT_METHODS = [
  { value: "mpesa", label: "M-Pesa" },
  { value: "tigopesa", label: "Tigo Pesa" },
  { value: "bank", label: "Benki" },
  { value: "cash", label: "Taslimu Cash" },
  { value: "other", label: "Nyingine" },
]

export default function Income() {
  const { profile } = useAuth()
  const [serviceLines, setServiceLines] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const [form, setForm] = useState({
    service_line_id: "",
    source: "",
    amount: "",
    payment_method: "mpesa",
    reference_number: "",
    received_at: new Date().toISOString().slice(0, 10),
    notes: "",
  })

  useEffect(() => {
    async function load() {
      const slRes = await supabase.from("service_lines").select("id, name").order("name")
      const recRes = await supabase
        .from("income_records")
        .select("id, source, amount, payment_method, received_at, service_line:service_lines(name)")
        .order("received_at", { ascending: false })
        .limit(15)

      setServiceLines(slRes.data || [])
      setRecords(recRes.data || [])

      if (slRes.data && slRes.data.length > 0) {
        setForm(function (f) {
          const copy = Object.assign({}, f)
          if (!copy.service_line_id) {
            copy.service_line_id = slRes.data[0].id
          }
          return copy
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  function updateField(field, value) {
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy[field] = value
      return copy
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    const missing = !form.service_line_id || !form.source || !form.amount

    if (missing) {
      setMessage({ type: "error", text: "Jaza huduma na chanzo na kiasi" })
      return
    }

    if (Number(form.amount) <= 0) {
      setMessage({ type: "error", text: "Kiasi lazima kiwe kikubwa kuliko sifuri" })
      return
    }

    setBusy(true)

    const insertResult = await supabase
      .from("income_records")
      .insert({
        service_line_id: form.service_line_id,
        source: form.source,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        reference_number: form.reference_number || null,
        received_at: form.received_at,
        recorded_by: profile.id,
        notes: form.notes || null,
      })
      .select("id, source, amount, payment_method, received_at, service_line:service_lines(name)")
      .single()

    setBusy(false)

    if (insertResult.error) {
      setMessage({ type: "error", text: insertResult.error.message })
      return
    }

    setRecords(function (prev) {
      return [insertResult.data].concat(prev)
    })
    setMessage({ type: "success", text: "Mapato yameongezwa kikamilifu" })
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy.source = ""
      copy.amount = ""
      copy.reference_number = ""
      copy.notes = ""
      return copy
    })
  }

  if (loading) {
    return <div className="page-loading">Inapakia...</div>
  }

  return (
    <div>
      <div className="panel">
        <p className="panel-title">Ongeza mapato mapya</p>

        {message ? (
          <p className={message.type === "error" ? "login-error" : "reset-success"}>
            {message.text}
          </p>
        ) : null}

        <form className="income-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Huduma
              <select
                value={form.service_line_id}
                onChange={function (e) {
                  updateField("service_line_id", e.target.value)
                }}
              >
                {serviceLines.map(function (sl) {
                  return (
                    <option key={sl.id} value={sl.id}>
                      {sl.name}
                    </option>
                  )
                })}
              </select>
            </label>

            <label>
              Njia ya malipo
              <select
                value={form.payment_method}
                onChange={function (e) {
                  updateField("payment_method", e.target.value)
                }}
              >
                {PAYMENT_METHODS.map(function (m) {
                  return (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  )
                })}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label>
              Chanzo au Mteja
              <input
                type="text"
                placeholder="Mteja X malipo ya mwezi"
                value={form.source}
                onChange={function (e) {
                  updateField("source", e.target.value)
                }}
              />
            </label>

            <label>
              Kiasi TZS
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={function (e) {
                  updateField("amount", e.target.value)
                }}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Namba ya rejea
              <input
                type="text"
                placeholder="namba ya muamala"
                value={form.reference_number}
                onChange={function (e) {
                  updateField("reference_number", e.target.value)
                }}
              />
            </label>

            <label>
              Tarehe
              <input
                type="date"
                value={form.received_at}
                onChange={function (e) {
                  updateField("received_at", e.target.value)
                }}
              />
            </label>
          </div>

          <label className="full-width">
            Maelezo
            <input
              type="text"
              placeholder="maelezo ya ziada"
              value={form.notes}
              onChange={function (e) {
                updateField("notes", e.target.value)
              }}
            />
          </label>

          <button className="btn-approve submit-income" disabled={busy}>
            {busy ? "Inaongeza..." : "Ongeza mapato"}
          </button>
        </form>
      </div>

      <div className="panel">
        <p className="panel-title">Mapato ya mwisho</p>
        {records.length === 0 ? (
          <p className="panel-empty">Hakuna mapato yaliyoongezwa bado.</p>
        ) : (
          <div className="row-list">
            {records.map(function (r) {
              return (
                <div className="row-item" key={r.id}>
                  <div>
                    <p className="row-title">{r.source}</p>
                    <p className="row-sub">
                      {r.service_line ? r.service_line.name : ""} - {r.payment_method} - {r.received_at}
                    </p>
                  </div>
                  <span className="row-amount">{Number(r.amount).toLocaleString()} TZS</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
