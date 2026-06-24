import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../contexts/AuthContext"

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = "AJP-"
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function emptyForm() {
  return {
    code: randomCode(),
    discount_type: "percentage",
    discount_value: "",
    valid_until: "",
    max_uses: "",
  }
}

export default function Vouchers() {
  const { profile } = useAuth()
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    loadVouchers()
  }, [])

  async function loadVouchers() {
    const res = await supabase
      .from("vouchers")
      .select("id, code, discount_type, discount_value, valid_until, max_uses, used_count, is_active, created_at")
      .order("created_at", { ascending: false })
    setVouchers(res.data || [])
    setLoading(false)
  }

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

    if (!form.code || !form.discount_value) {
      setMessage({ type: "error", text: "Jaza kodi na kiasi cha punguzo" })
      return
    }

    setBusy(true)
    const res = await supabase.from("vouchers").insert({
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      valid_until: form.valid_until || null,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      created_by: profile.id,
    })
    setBusy(false)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: "Voucher imeongezwa" })
    setForm(emptyForm())
    setShowForm(false)
    await loadVouchers()
  }

  async function toggleActive(voucher) {
    setMessage(null)
    const res = await supabase.from("vouchers").update({ is_active: !voucher.is_active }).eq("id", voucher.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    await loadVouchers()
  }

  async function deleteVoucher(voucher) {
    const confirmed = window.confirm("Una hakika unataka kufuta voucher '" + voucher.code + "'?")
    if (!confirmed) {
      return
    }
    setMessage(null)
    const res = await supabase.from("vouchers").delete().eq("id", voucher.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    setMessage({ type: "success", text: "Voucher imefutwa" })
    await loadVouchers()
  }

  function isExpired(voucher) {
    if (!voucher.valid_until) {
      return false
    }
    return new Date(voucher.valid_until) < new Date(new Date().toDateString())
  }

  function isExhausted(voucher) {
    if (!voucher.max_uses) {
      return false
    }
    return voucher.used_count >= voucher.max_uses
  }

  if (loading) {
    return <div className="page-loading">Inapakia...</div>
  }

  return (
    <div>
      {message ? (
        <p className={message.type === "error" ? "login-error" : "reset-success"}>{message.text}</p>
      ) : null}

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Vouchers (Punguzo)</p>
          <div className="header-buttons">
            <button className="btn-approve" onClick={function () { setShowForm(!showForm) }}>
              {showForm ? "Funga fomu" : "Tengeneza voucher"}
            </button>
          </div>
        </div>

        {showForm ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Kodi ya Voucher
                <input
                  type="text"
                  value={form.code}
                  onChange={function (e) { updateField("code", e.target.value) }}
                  style={{ textTransform: "uppercase" }}
                />
              </label>
              <label>
                Aina ya Punguzo
                <select value={form.discount_type} onChange={function (e) { updateField("discount_type", e.target.value) }}>
                  <option value="percentage">Asilimia (%)</option>
                  <option value="fixed">Kiasi Maalum (TZS)</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                {form.discount_type === "percentage" ? "Punguzo (%)" : "Punguzo (TZS)"}
                <input type="number" min="0" placeholder="0" value={form.discount_value} onChange={function (e) { updateField("discount_value", e.target.value) }} />
              </label>
              <label>
                Tarehe ya Mwisho (hiari)
                <input type="date" value={form.valid_until} onChange={function (e) { updateField("valid_until", e.target.value) }} />
              </label>
            </div>

            <label className="full-width">
              Idadi ya Matumizi Yanayoruhusiwa (hiari, ondoa kama haina kikomo)
              <input type="number" min="1" placeholder="bila kikomo" value={form.max_uses} onChange={function (e) { updateField("max_uses", e.target.value) }} />
            </label>

            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? "Inatengeneza..." : "Hifadhi voucher"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <p className="panel-title">Vouchers Zote</p>
        {vouchers.length === 0 ? (
          <p className="panel-empty">Hakuna voucher iliyotengenezwa bado.</p>
        ) : (
          <div className="row-list">
            {vouchers.map(function (v) {
              const expired = isExpired(v)
              const exhausted = isExhausted(v)
              const inactive = !v.is_active || expired || exhausted
              return (
                <div className="row-item expense-row" key={v.id}>
                  <div>
                    <p className="row-title">{v.code}</p>
                    <p className="row-sub">
                      {v.discount_type === "percentage" ? v.discount_value + "%" : Number(v.discount_value).toLocaleString() + " TZS"}
                      {v.valid_until ? " · Mwisho: " + v.valid_until : " · Bila tarehe ya mwisho"}
                      {v.max_uses ? " · Matumizi: " + v.used_count + "/" + v.max_uses : " · Matumizi: " + v.used_count}
                    </p>
                  </div>
                  <div className="expense-actions">
                    <span className={"badge " + (inactive ? "badge-rejected" : "badge-paid")}>
                      {expired ? "Imepitwa na Muda" : exhausted ? "Imeishiwa" : v.is_active ? "Hai" : "Imezimwa"}
                    </span>
                    <button className="btn-cancel" onClick={function () { toggleActive(v) }}>
                      {v.is_active ? "Zima" : "Washa"}
                    </button>
                    <button className="btn-cancel" style={{ color: "#b3261e" }} onClick={function () { deleteVoucher(v) }}>
                      Futa
                    </button>
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
