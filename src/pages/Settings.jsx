import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

function emptyForm() {
  return {
    type: "bank",
    bank_name: "",
    branch: "",
    account_number: "",
    account_name: "",
  }
}

export default function Settings() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts() {
    setLoading(true)
    const res = await supabase
      .from("payment_accounts")
      .select("id, type, bank_name, branch, account_number, account_name, is_active, sort_order")
      .order("sort_order")
    setAccounts(res.data || [])
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

    if (!form.account_number || !form.account_name || (form.type === "bank" && !form.bank_name)) {
      setMessage({ type: "error", text: "Jaza taarifa zote muhimu" })
      return
    }

    setBusy(true)
    const res = await supabase.from("payment_accounts").insert({
      type: form.type,
      bank_name: form.type === "bank" ? form.bank_name : form.bank_name || null,
      branch: form.type === "bank" ? form.branch || null : null,
      account_number: form.account_number,
      account_name: form.account_name,
      sort_order: accounts.length + 1,
    })
    setBusy(false)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: "Akaunti imeongezwa" })
    setForm(emptyForm())
    setShowForm(false)
    await loadAccounts()
  }

  async function toggleActive(account) {
    setMessage(null)
    const res = await supabase.from("payment_accounts").update({ is_active: !account.is_active }).eq("id", account.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    await loadAccounts()
  }

  async function deleteAccount(account) {
    const label = account.bank_name || account.account_name
    const confirmed = window.confirm("Una hakika unataka kufuta '" + label + "'?")
    if (!confirmed) {
      return
    }
    setMessage(null)
    const res = await supabase.from("payment_accounts").delete().eq("id", account.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    setMessage({ type: "success", text: "Imefutwa" })
    await loadAccounts()
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
          <p className="panel-title">Akaunti za Malipo (Bank / Mobile Money)</p>
          <div className="header-buttons">
            <button className="btn-approve" onClick={function () { setShowForm(!showForm) }}>
              {showForm ? "Funga fomu" : "Ongeza akaunti"}
            </button>
          </div>
        </div>

        {showForm ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Aina
                <select value={form.type} onChange={function (e) { updateField("type", e.target.value) }}>
                  <option value="bank">Benki</option>
                  <option value="mobile_money">Mobile Money (Lipa Namba)</option>
                </select>
              </label>
              <label>
                {form.type === "bank" ? "Jina la Benki" : "Jina la Huduma"}
                <input
                  type="text"
                  placeholder={form.type === "bank" ? "mfano: CRDB Bank" : "mfano: Lipa by Mixx by Yas"}
                  value={form.bank_name}
                  onChange={function (e) { updateField("bank_name", e.target.value) }}
                />
              </label>
            </div>

            <div className="form-row">
              {form.type === "bank" ? (
                <label>
                  Tawi (Branch)
                  <input type="text" placeholder="mfano: Tegeta Branch" value={form.branch} onChange={function (e) { updateField("branch", e.target.value) }} />
                </label>
              ) : null}
              <label>
                {form.type === "bank" ? "Namba ya Akaunti" : "Lipa Namba"}
                <input type="text" placeholder="0000000000000" value={form.account_number} onChange={function (e) { updateField("account_number", e.target.value) }} />
              </label>
            </div>

            <label className="full-width">
              Jina la Akaunti
              <input type="text" placeholder="mfano: John F. Mfoi" value={form.account_name} onChange={function (e) { updateField("account_name", e.target.value) }} />
            </label>

            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? "Inaongeza..." : "Hifadhi akaunti"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <p className="panel-title">Orodha ya Akaunti</p>
        {accounts.length === 0 ? (
          <p className="panel-empty">Hakuna akaunti iliyowekwa bado.</p>
        ) : (
          <div className="row-list">
            {accounts.map(function (account) {
              return (
                <div className="row-item expense-row" key={account.id}>
                  <div>
                    <p className="row-title">
                      {account.bank_name}
                      {account.branch ? ", " + account.branch : ""}
                    </p>
                    <p className="row-sub">
                      {account.type === "bank" ? "Namba ya Akaunti" : "Lipa Namba"}: {account.account_number} · {account.account_name}
                    </p>
                  </div>
                  <div className="expense-actions">
                    <span className={"badge " + (account.is_active ? "badge-paid" : "badge-rejected")}>
                      {account.is_active ? "Inaonekana" : "Imefichwa"}
                    </span>
                    <button className="btn-cancel" onClick={function () { toggleActive(account) }}>
                      {account.is_active ? "Ficha" : "Onyesha"}
                    </button>
                    <button className="btn-cancel" style={{ color: "#b3261e" }} onClick={function () { deleteAccount(account) }}>
                      Futa
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="panel-empty" style={{ marginTop: "10px" }}>
          Akaunti "Inaonekana" ndizo zitakazoonekana kwenye Invoice, Quotation, Receipt na Statement.
        </p>
      </div>
    </div>
  )
}
