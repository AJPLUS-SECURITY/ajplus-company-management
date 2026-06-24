import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

const UNIT_OPTIONS = ["kwa kazi", "kwa siku", "kwa mwezi", "kwa mwaka", "kwa kipande", "kwa saa"]

function emptyForm(defaultServiceLine) {
  return {
    service_line_id: defaultServiceLine || "",
    name: "",
    price: "",
    unit: "kwa kazi",
    description: "",
  }
}

export default function PriceLists() {
  const [serviceLines, setServiceLines] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const slRes = await supabase.from("service_lines").select("id, name").order("name")
    setServiceLines(slRes.data || [])
    if (slRes.data && slRes.data.length > 0) {
      setForm(emptyForm(slRes.data[0].id))
    }
    await loadItems()
    setLoading(false)
  }

  async function loadItems() {
    const res = await supabase
      .from("price_lists")
      .select("id, name, price, unit, description, is_active, service_line_id, service_line:service_lines(name)")
      .order("created_at", { ascending: false })
    setItems(res.data || [])
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

    if (!form.service_line_id || !form.name || !form.price) {
      setMessage({ type: "error", text: "Jaza huduma, jina la kifurushi na bei" })
      return
    }

    setBusy(true)
    const res = await supabase.from("price_lists").insert({
      service_line_id: form.service_line_id,
      name: form.name,
      price: Number(form.price) || 0,
      unit: form.unit,
      description: form.description || null,
    })
    setBusy(false)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: "Bei imeongezwa" })
    setForm(emptyForm(form.service_line_id))
    setShowForm(false)
    await loadItems()
  }

  async function toggleActive(item) {
    setMessage(null)
    const res = await supabase.from("price_lists").update({ is_active: !item.is_active }).eq("id", item.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    await loadItems()
  }

  async function deleteItem(item) {
    const confirmed = window.confirm("Una hakika unataka kufuta '" + item.name + "'?")
    if (!confirmed) {
      return
    }
    setMessage(null)
    const res = await supabase.from("price_lists").delete().eq("id", item.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    setMessage({ type: "success", text: "Imefutwa" })
    await loadItems()
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
          <p className="panel-title">Price Lists (Bei za Huduma)</p>
          <div className="header-buttons">
            <button className="btn-approve" onClick={function () { setShowForm(!showForm) }}>
              {showForm ? "Funga fomu" : "Ongeza bei"}
            </button>
          </div>
        </div>

        {showForm ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Huduma
                <select value={form.service_line_id} onChange={function (e) { updateField("service_line_id", e.target.value) }}>
                  {serviceLines.map(function (sl) {
                    return <option key={sl.id} value={sl.id}>{sl.name}</option>
                  })}
                </select>
              </label>
              <label>
                Jina la kifurushi
                <input type="text" placeholder="mfano: Ulinzi wa Siku - Mtu Mmoja" value={form.name} onChange={function (e) { updateField("name", e.target.value) }} />
              </label>
            </div>

            <div className="form-row">
              <label>
                Bei (TZS)
                <input type="number" min="0" placeholder="0" value={form.price} onChange={function (e) { updateField("price", e.target.value) }} />
              </label>
              <label>
                Kipimo
                <select value={form.unit} onChange={function (e) { updateField("unit", e.target.value) }}>
                  {UNIT_OPTIONS.map(function (u) {
                    return <option key={u} value={u}>{u}</option>
                  })}
                </select>
              </label>
            </div>

            <label className="full-width">
              Maelezo (hiari)
              <input type="text" placeholder="maelezo zaidi ya kifurushi hiki" value={form.description} onChange={function (e) { updateField("description", e.target.value) }} />
            </label>

            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? "Inaongeza..." : "Hifadhi bei"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <p className="panel-title">Orodha ya Bei</p>
        {items.length === 0 ? (
          <p className="panel-empty">Hakuna bei iliyowekwa bado.</p>
        ) : (
          <div className="row-list">
            {items.map(function (item) {
              return (
                <div className="row-item expense-row" key={item.id}>
                  <div>
                    <p className="row-title">{item.name}</p>
                    <p className="row-sub">
                      {item.service_line ? item.service_line.name : ""} · {item.unit}
                      {item.description ? " · " + item.description : ""}
                    </p>
                  </div>
                  <div className="expense-actions">
                    <span className="row-amount">{Number(item.price).toLocaleString()} TZS</span>
                    <span className={"badge " + (item.is_active ? "badge-paid" : "badge-rejected")}>
                      {item.is_active ? "Hai" : "Imezimwa"}
                    </span>
                    <button className="btn-cancel" onClick={function () { toggleActive(item) }}>
                      {item.is_active ? "Zima" : "Washa"}
                    </button>
                    <button className="btn-cancel" style={{ color: "#b3261e" }} onClick={function () { deleteItem(item) }}>
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
