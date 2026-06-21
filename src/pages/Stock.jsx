import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../contexts/AuthContext"

export default function Stock() {
  const { profile, role } = useAuth()
  const [serviceLines, setServiceLines] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editValues, setEditValues] = useState({})

  const isSupervisor = role === "supervisor"

  const [form, setForm] = useState({
    name: "",
    service_line_id: "",
    current_quantity: "",
    unit: "",
    reorder_level: "",
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const slRes = await supabase.from("service_lines").select("id, name").order("name")
    setServiceLines(slRes.data || [])

    const defaultServiceLine =
      isSupervisor && profile?.service_line_id
        ? profile.service_line_id
        : slRes.data && slRes.data.length > 0
        ? slRes.data[0].id
        : ""

    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy.service_line_id = defaultServiceLine
      return copy
    })

    await loadItems()
    setLoading(false)
  }

  async function loadItems() {
    let query = supabase
      .from("stock_items")
      .select("id, name, current_quantity, unit, reorder_level, service_line_id, service_line:service_lines(name)")
      .order("name")

    if (isSupervisor && profile?.service_line_id) {
      query = query.eq("service_line_id", profile.service_line_id)
    }

    const res = await query
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

    if (!form.name || !form.service_line_id || form.current_quantity === "") {
      setMessage({ type: "error", text: "Jaza jina, huduma na kiasi cha sasa" })
      return
    }

    setBusy(true)

    const res = await supabase
      .from("stock_items")
      .insert({
        name: form.name,
        service_line_id: form.service_line_id,
        current_quantity: Number(form.current_quantity) || 0,
        unit: form.unit || "vipande",
        reorder_level: Number(form.reorder_level) || 0,
      })
      .select("id")
      .single()

    setBusy(false)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: "Kifaa kimeongezwa kwenye stock" })
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy.name = ""
      copy.current_quantity = ""
      copy.unit = ""
      copy.reorder_level = ""
      return copy
    })
    setShowForm(false)
    await loadItems()
  }

  function startEdit(itemId, currentValue) {
    setEditValues(function (prev) {
      const copy = Object.assign({}, prev)
      copy[itemId] = currentValue
      return copy
    })
  }

  function updateEditValue(itemId, value) {
    setEditValues(function (prev) {
      const copy = Object.assign({}, prev)
      copy[itemId] = value
      return copy
    })
  }

  function cancelEdit(itemId) {
    setEditValues(function (prev) {
      const copy = Object.assign({}, prev)
      delete copy[itemId]
      return copy
    })
  }

  async function saveQuantity(itemId) {
    setMessage(null)
    const newQty = Number(editValues[itemId])

    if (Number.isNaN(newQty) || newQty < 0) {
      setMessage({ type: "error", text: "Weka kiasi sahihi" })
      return
    }

    const res = await supabase.from("stock_items").update({ current_quantity: newQty }).eq("id", itemId)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    cancelEdit(itemId)
    setMessage({ type: "success", text: "Kiasi cha stock kimesasishwa" })
    await loadItems()
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
          <p className="panel-title">Stock</p>
          <div className="header-buttons">
            <button
              className="btn-approve"
              onClick={function () {
                setShowForm(!showForm)
              }}
            >
              {showForm ? "Funga fomu" : "Ongeza kifaa"}
            </button>
          </div>
        </div>

        {showForm ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Jina la kifaa
                <input
                  type="text"
                  placeholder="mfano: Sare ya Mlinzi"
                  value={form.name}
                  onChange={function (e) {
                    updateField("name", e.target.value)
                  }}
                />
              </label>
              <label>
                Huduma
                <select
                  value={form.service_line_id}
                  onChange={function (e) {
                    updateField("service_line_id", e.target.value)
                  }}
                  disabled={isSupervisor}
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
            </div>

            <div className="form-row">
              <label>
                Kiasi cha sasa
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.current_quantity}
                  onChange={function (e) {
                    updateField("current_quantity", e.target.value)
                  }}
                />
              </label>
              <label>
                Kipimo (unit)
                <input
                  type="text"
                  placeholder="mfano: vipande, lita, kg"
                  value={form.unit}
                  onChange={function (e) {
                    updateField("unit", e.target.value)
                  }}
                />
              </label>
            </div>

            <label className="full-width">
              Kiwango cha chini cha kuonya (reorder level)
              <input
                type="number"
                min="0"
                placeholder="0"
                value={form.reorder_level}
                onChange={function (e) {
                  updateField("reorder_level", e.target.value)
                }}
              />
            </label>

            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? "Inaongeza..." : "Hifadhi kifaa"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <p className="panel-title">Vifaa vya stock</p>
        {items.length === 0 ? (
          <p className="panel-empty">Hakuna vifaa vilivyosajiliwa bado.</p>
        ) : (
          <div className="row-list">
            {items.map(function (item) {
              const isLow = Number(item.current_quantity) <= Number(item.reorder_level)
              const isEditing = Object.prototype.hasOwnProperty.call(editValues, item.id)
              return (
                <div className="row-item expense-row" key={item.id}>
                  <div>
                    <p className="row-title">{item.name}</p>
                    <p className="row-sub">
                      {item.service_line ? item.service_line.name : ""} · Kiwango cha chini:{" "}
                      {item.reorder_level} {item.unit}
                    </p>
                  </div>
                  <div className="expense-actions">
                    {isEditing ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          style={{ width: "80px" }}
                          value={editValues[item.id]}
                          onChange={function (e) {
                            updateEditValue(item.id, e.target.value)
                          }}
                        />
                        <button
                          className="btn-approve"
                          onClick={function () {
                            saveQuantity(item.id)
                          }}
                        >
                          Hifadhi
                        </button>
                        <button
                          className="btn-cancel"
                          onClick={function () {
                            cancelEdit(item.id)
                          }}
                        >
                          Ghairi
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={isLow ? "badge badge-rejected" : "row-amount"}>
                          {item.current_quantity} {item.unit}
                        </span>
                        <button
                          className="btn-cancel"
                          onClick={function () {
                            startEdit(item.id, item.current_quantity)
                          }}
                        >
                          Sasisha kiasi
                        </button>
                      </>
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
