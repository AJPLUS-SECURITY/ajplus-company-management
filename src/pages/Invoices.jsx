import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../contexts/AuthContext"

const STATUS_BADGE = {
  draft: "badge-pending",
  unpaid: "badge-pending",
  partially_paid: "badge-pending",
  paid: "badge-paid",
  overdue: "badge-rejected",
  cancelled: "badge-rejected",
}

const STATUS_LABEL = {
  draft: "Rasimu",
  unpaid: "Haijalipwa",
  partially_paid: "Imelipwa Kiasi",
  paid: "Imelipwa",
  overdue: "Imechelewa",
  cancelled: "Imefutwa",
}

function emptyItem() {
  return { description: "", quantity: 1, unit_price: "" }
}

export default function Invoices() {
  const { profile } = useAuth()
  const [serviceLines, setServiceLines] = useState([])
  const [clients, setClients] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showClientForm, setShowClientForm] = useState(false)

  const [clientForm, setClientForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  })

  const [form, setForm] = useState({
    client_id: "",
    service_line_id: "",
    due_date: "",
    items: [emptyItem()],
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const slRes = await supabase.from("service_lines").select("id, name").order("name")
    const clientRes = await supabase.from("clients").select("id, name").order("name")

    setServiceLines(slRes.data || [])
    setClients(clientRes.data || [])

    if (slRes.data && slRes.data.length > 0) {
      setForm(function (f) {
        const copy = Object.assign({}, f)
        if (!copy.service_line_id) {
          copy.service_line_id = slRes.data[0].id
        }
        return copy
      })
    }
    if (clientRes.data && clientRes.data.length > 0) {
      setForm(function (f) {
        const copy = Object.assign({}, f)
        if (!copy.client_id) {
          copy.client_id = clientRes.data[0].id
        }
        return copy
      })
    }

    await loadInvoices()
    setLoading(false)
  }

  async function loadInvoices() {
    const res = await supabase
      .from("invoices")
      .select("id, invoice_number, status, total_amount, amount_paid, due_date, issue_date, client:clients(name), service_line:service_lines(name)")
      .order("created_at", { ascending: false })
      .limit(30)
    setInvoices(res.data || [])
  }

  function updateClientField(field, value) {
    setClientForm(function (f) {
      const copy = Object.assign({}, f)
      copy[field] = value
      return copy
    })
  }

  async function handleAddClient(e) {
    e.preventDefault()
    setMessage(null)

    if (!clientForm.name) {
      setMessage({ type: "error", text: "Jaza jina la mteja" })
      return
    }

    setBusy(true)
    const res = await supabase
      .from("clients")
      .insert({
        name: clientForm.name,
        phone: clientForm.phone || null,
        email: clientForm.email || null,
        address: clientForm.address || null,
      })
      .select("id, name")
      .single()
    setBusy(false)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setClients(function (prev) {
      return prev.concat([res.data])
    })
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy.client_id = res.data.id
      return copy
    })
    setClientForm({ name: "", phone: "", email: "", address: "" })
    setShowClientForm(false)
    setMessage({ type: "success", text: "Mteja ameongezwa" })
  }

  function updateField(field, value) {
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy[field] = value
      return copy
    })
  }

  function updateItem(index, field, value) {
    setForm(function (f) {
      const copy = Object.assign({}, f)
      const items = copy.items.slice()
      items[index] = Object.assign({}, items[index])
      items[index][field] = value
      copy.items = items
      return copy
    })
  }

  function addItemRow() {
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy.items = copy.items.concat([emptyItem()])
      return copy
    })
  }

  function removeItemRow(index) {
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy.items = copy.items.filter(function (_, i) {
        return i !== index
      })
      return copy
    })
  }

  function calculateTotal() {
    return form.items.reduce(function (sum, item) {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unit_price) || 0
      return sum + qty * price
    }, 0)
  }

  function generateInvoiceNumber() {
    const now = new Date()
    const stamp = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, "0") + now.getDate().toString().padStart(2, "0")
    const rand = Math.floor(Math.random() * 9000 + 1000)
    return "INV-" + stamp + "-" + rand
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (!form.client_id || !form.service_line_id) {
      setMessage({ type: "error", text: "Chagua mteja na huduma" })
      return
    }

    const validItems = form.items.filter(function (item) {
      return item.description && Number(item.unit_price) > 0
    })

    if (validItems.length === 0) {
      setMessage({ type: "error", text: "Ongeza angalau kitu kimoja chenye bei" })
      return
    }

    setBusy(true)

    const total = calculateTotal()
    const invoiceNumber = generateInvoiceNumber()

    const invoiceRes = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        client_id: form.client_id,
        service_line_id: form.service_line_id,
        due_date: form.due_date || null,
        subtotal: total,
        total_amount: total,
        status: "unpaid",
        created_by: profile.id,
      })
      .select("id")
      .single()

    if (invoiceRes.error) {
      setBusy(false)
      setMessage({ type: "error", text: invoiceRes.error.message })
      return
    }

    const itemsToInsert = validItems.map(function (item) {
      const qty = Number(item.quantity) || 1
      const price = Number(item.unit_price) || 0
      return {
        invoice_id: invoiceRes.data.id,
        description: item.description,
        quantity: qty,
        unit_price: price,
        line_total: qty * price,
      }
    })

    const itemsRes = await supabase.from("invoice_items").insert(itemsToInsert)
    setBusy(false)

    if (itemsRes.error) {
      setMessage({ type: "error", text: itemsRes.error.message })
      return
    }

    setMessage({ type: "success", text: "Invoice " + invoiceNumber + " imetengenezwa" })
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy.due_date = ""
      copy.items = [emptyItem()]
      return copy
    })
    setShowForm(false)
    await loadInvoices()
  }

  async function markAsPaid(invoiceId, totalAmount) {
    setMessage(null)
    const res = await supabase
      .from("invoices")
      .update({ status: "paid", amount_paid: totalAmount })
      .eq("id", invoiceId)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: "Invoice imewekwa kama imelipwa" })
    await loadInvoices()
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
          <p className="panel-title">Invoices</p>
          <div className="header-buttons">
            <button className="btn-cancel" onClick={function () { setShowClientForm(!showClientForm) }}>
              {showClientForm ? "Funga" : "Ongeza mteja"}
            </button>
            <button className="btn-approve" onClick={function () { setShowForm(!showForm) }}>
              {showForm ? "Funga fomu" : "Tengeneza invoice"}
            </button>
          </div>
        </div>

        {showClientForm ? (
          <form className="income-form client-form" onSubmit={handleAddClient}>
            <div className="form-row">
              <label>
                Jina la mteja
                <input
                  type="text"
                  placeholder="mfano: Hero Masai Company"
                  value={clientForm.name}
                  onChange={function (e) { updateClientField("name", e.target.value) }}
                />
              </label>
              <label>
                Simu
                <input
                  type="text"
                  placeholder="namba ya simu"
                  value={clientForm.phone}
                  onChange={function (e) { updateClientField("phone", e.target.value) }}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Barua pepe
                <input
                  type="email"
                  placeholder="barua pepe ya mteja"
                  value={clientForm.email}
                  onChange={function (e) { updateClientField("email", e.target.value) }}
                />
              </label>
              <label>
                Anuani
                <input
                  type="text"
                  placeholder="mahali"
                  value={clientForm.address}
                  onChange={function (e) { updateClientField("address", e.target.value) }}
                />
              </label>
            </div>
            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? "Inaongeza..." : "Hifadhi mteja"}
            </button>
          </form>
        ) : null}

        {showForm ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Mteja
                <select
                  value={form.client_id}
                  onChange={function (e) { updateField("client_id", e.target.value) }}
                >
                  {clients.map(function (c) {
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label>
                Huduma
                <select
                  value={form.service_line_id}
                  onChange={function (e) { updateField("service_line_id", e.target.value) }}
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

            <label>
              Tarehe ya malipo (hiari)
              <input
                type="date"
                value={form.due_date}
                onChange={function (e) { updateField("due_date", e.target.value) }}
              />
            </label>

            <p className="items-title">Vitu vya invoice</p>
            {form.items.map(function (item, index) {
              return (
                <div className="item-row" key={index}>
                  <input
                    type="text"
                    placeholder="maelezo ya kitu"
                    value={item.description}
                    onChange={function (e) { updateItem(index, "description", e.target.value) }}
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="idadi"
                    value={item.quantity}
                    onChange={function (e) { updateItem(index, "quantity", e.target.value) }}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="bei"
                    value={item.unit_price}
                    onChange={function (e) { updateItem(index, "unit_price", e.target.value) }}
                  />
                  {form.items.length > 1 ? (
                    <button type="button" className="btn-cancel" onClick={function () { removeItemRow(index) }}>
                      Toa
                    </button>
                  ) : null}
                </div>
              )
            })}

            <button type="button" className="btn-cancel add-item-btn" onClick={addItemRow}>
              Ongeza kitu kingine
            </button>

            <p className="invoice-total">Jumla: {calculateTotal().toLocaleString()} TZS</p>

            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? "Inatengeneza..." : "Tengeneza invoice"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <p className="panel-title">Invoices zote</p>
        {invoices.length === 0 ? (
          <p className="panel-empty">Hakuna invoice bado.</p>
        ) : (
          <div className="row-list">
            {invoices.map(function (inv) {
              return (
                <div className="row-item expense-row" key={inv.id}>
                  <div>
                    <p className="row-title">{inv.invoice_number} - {inv.client ? inv.client.name : ""}</p>
                    <p className="row-sub">
                      {inv.service_line ? inv.service_line.name : ""} - Inadaiwa: {inv.due_date || "Haijawekwa"}
                    </p>
                  </div>
                  <div className="expense-actions">
                    <span className="row-amount">{Number(inv.total_amount).toLocaleString()} TZS</span>
                    <span className={"badge " + (STATUS_BADGE[inv.status] || "badge-pending")}>
                      {STATUS_LABEL[inv.status] || inv.status}
                    </span>
                    {inv.status !== "paid" ? (
                      <button className="btn-approve" onClick={function () { markAsPaid(inv.id, inv.total_amount) }}>
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
