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

function monthLabel(monthStr) {
  if (!monthStr) {
    return ""
  }
  const parts = monthStr.split("-")
  const months = [
    "Januari", "Februari", "Machi", "Aprili", "Mei", "Juni",
    "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba",
  ]
  const idx = Number(parts[1]) - 1
  return (months[idx] || parts[1]) + " " + parts[0]
}

export default function Payroll() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showBatch, setShowBatch] = useState(false)

  const [form, setForm] = useState({
    user_id: "",
    month: currentMonth(),
    basic_salary: "",
    allowances: "",
    deductions: "",
  })

  const [batchMonth, setBatchMonth] = useState(currentMonth())
  const [batchRows, setBatchRows] = useState({})
  const [printMonth, setPrintMonth] = useState(currentMonth())

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
      .limit(200)
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

  function updateBatchRow(employeeId, field, value) {
    setBatchRows(function (prev) {
      const copy = Object.assign({}, prev)
      const existing = copy[employeeId] || { basic_salary: "", allowances: "", deductions: "" }
      const updated = Object.assign({}, existing)
      updated[field] = value
      copy[employeeId] = updated
      return copy
    })
  }

  function batchNet(employeeId) {
    const row = batchRows[employeeId] || {}
    const basic = Number(row.basic_salary) || 0
    const allow = Number(row.allowances) || 0
    const deduct = Number(row.deductions) || 0
    return basic + allow - deduct
  }

  async function handleBatchSave() {
    setMessage(null)

    const toInsert = []
    employees.forEach(function (emp) {
      const row = batchRows[emp.id]
      if (row && Number(row.basic_salary) > 0) {
        toInsert.push({
          user_id: emp.id,
          month: batchMonth,
          basic_salary: Number(row.basic_salary) || 0,
          allowances: Number(row.allowances) || 0,
          deductions: Number(row.deductions) || 0,
          net_salary: (Number(row.basic_salary) || 0) + (Number(row.allowances) || 0) - (Number(row.deductions) || 0),
          status: "pending",
          created_by: profile.id,
        })
      }
    })

    if (toInsert.length === 0) {
      setMessage({ type: "error", text: "Weka angalau mshahara wa mfanyakazi mmoja kabla ya kuhifadhi" })
      return
    }

    setBusy(true)
    const res = await supabase.from("payroll_records").insert(toInsert)
    setBusy(false)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: "Payroll ya wafanyakazi " + toInsert.length + " imehifadhiwa kwa mwezi wa " + monthLabel(batchMonth) })
    setBatchRows({})
    setShowBatch(false)
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

  function printPayrollSheet() {
    setMessage(null)

    const monthRecords = records.filter(function (r) {
      return r.month === printMonth
    })

    if (monthRecords.length === 0) {
      setMessage({ type: "error", text: "Hakuna payroll ya mwezi huo kuchapisha. Tengeneza payroll kwanza." })
      return
    }

    const logoUrl = window.location.origin + "/logo.png"
    let grandTotal = 0

    const rowsHtml = monthRecords
      .map(function (r, idx) {
        grandTotal += Number(r.net_salary) || 0
        return (
          "<tr>" +
          "<td>" + (idx + 1) + "</td>" +
          "<td>" + employeeName(r.user_id) + "</td>" +
          "<td style='text-align:right'>" + Number(r.basic_salary).toLocaleString() + "</td>" +
          "<td style='text-align:right'>" + Number(r.allowances).toLocaleString() + "</td>" +
          "<td style='text-align:right'>" + Number(r.deductions).toLocaleString() + "</td>" +
          "<td style='text-align:right;font-weight:bold;'>" + Number(r.net_salary).toLocaleString() + "</td>" +
          "<td class='sign-cell'></td>" +
          "</tr>"
        )
      })
      .join("")

    const html =
      "<html><head><title>Payroll Sheet - " + printMonth + "</title>" +
      "<style>" +
      "body{font-family:Arial,Helvetica,sans-serif;padding:30px;color:#1a1a1a;}" +
      ".header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1D9E75;padding-bottom:14px;margin-bottom:20px;}" +
      ".header img{height:55px;}" +
      "h1{color:#085041;font-size:18px;margin:0;}" +
      "h2{font-size:15px;margin-top:18px;}" +
      "table{width:100%;border-collapse:collapse;margin-top:14px;}" +
      "th,td{padding:7px;border:1px solid #ccc;font-size:12px;}" +
      "th{text-align:left;background:#f3f6f4;}" +
      ".sign-cell{min-width:90px;height:34px;}" +
      ".total-row td{font-weight:bold;background:#f7f7f7;}" +
      ".footer{margin-top:30px;font-size:11px;color:#666;display:flex;justify-content:space-between;}" +
      ".footer div{width:30%;border-top:1px solid #999;padding-top:6px;text-align:center;}" +
      "@media print{button{display:none;}}" +
      "</style></head><body>" +
      "<div class='header'>" +
      "<div><h1>AJ PLUS COMPANY LIMITED</h1><p style='margin:4px 0;font-size:11px;'>SECURITY &middot; CLEANING &middot; ICT-MEDIA</p></div>" +
      "<img src='" + logoUrl + "' />" +
      "</div>" +
      "<h2>PAYROLL SHEET &mdash; " + monthLabel(printMonth) + "</h2>" +
      "<table><thead><tr><th>#</th><th>Jina la Mfanyakazi</th><th>Msingi</th><th>Posho</th><th>Makato</th><th>Jumla (Net)</th><th>Sahihi</th></tr></thead>" +
      "<tbody>" + rowsHtml +
      "<tr class='total-row'><td colspan='5'>JUMLA KUU</td><td style='text-align:right'>" + grandTotal.toLocaleString() + "</td><td></td></tr>" +
      "</tbody></table>" +
      "<div class='footer'>" +
      "<div>Mtayarishaji (HR)</div>" +
      "<div>Mthibitishaji (MD/FAO)</div>" +
      "<div>Tarehe</div>" +
      "</div>" +
      "<script>window.onload = function(){ window.print(); }</script>" +
      "</body></html>"

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      setMessage({ type: "error", text: "Browser imezuia dirisha jipya. Ruhusu pop-ups kisha jaribu tena." })
      return
    }
    printWindow.document.write(html)
    printWindow.document.close()
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
              className="btn-cancel"
              onClick={function () {
                setShowForm(!showForm)
                setShowBatch(false)
              }}
            >
              {showForm ? "Funga fomu" : "Ongeza mmoja"}
            </button>
            <button
              className="btn-approve"
              onClick={function () {
                setShowBatch(!showBatch)
                setShowForm(false)
              }}
            >
              {showBatch ? "Funga" : "Tengeneza Payroll ya Mwezi (Wote)"}
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

        {showBatch ? (
          <div className="income-form">
            <div className="form-row">
              <label className="full-width">
                Mwezi wa Payroll
                <input
                  type="month"
                  value={batchMonth}
                  onChange={function (e) {
                    setBatchMonth(e.target.value)
                  }}
                />
              </label>
            </div>

            <div className="row-list" style={{ marginTop: "12px" }}>
              {employees.map(function (emp) {
                const row = batchRows[emp.id] || { basic_salary: "", allowances: "", deductions: "" }
                return (
                  <div className="row-item expense-row" key={emp.id}>
                    <div style={{ minWidth: "140px" }}>
                      <p className="row-title">{emp.full_name}</p>
                      <p className="row-sub">Jumla: {batchNet(emp.id).toLocaleString()} TZS</p>
                    </div>
                    <div className="expense-actions" style={{ flexWrap: "wrap", gap: "6px" }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="Msingi"
                        style={{ width: "90px" }}
                        value={row.basic_salary}
                        onChange={function (e) {
                          updateBatchRow(emp.id, "basic_salary", e.target.value)
                        }}
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Posho"
                        style={{ width: "80px" }}
                        value={row.allowances}
                        onChange={function (e) {
                          updateBatchRow(emp.id, "allowances", e.target.value)
                        }}
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Makato"
                        style={{ width: "80px" }}
                        value={row.deductions}
                        onChange={function (e) {
                          updateBatchRow(emp.id, "deductions", e.target.value)
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              className="btn-approve submit-income"
              style={{ marginTop: "14px" }}
              disabled={busy}
              onClick={handleBatchSave}
            >
              {busy ? "Inahifadhi..." : "Hifadhi Payroll ya Wote"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Chapisha Payroll Sheet (kwa kusaini)</p>
          <div className="header-buttons">
            <input
              type="month"
              value={printMonth}
              onChange={function (e) {
                setPrintMonth(e.target.value)
              }}
            />
            <button className="btn-cancel" onClick={printPayrollSheet}>
              Chapisha / Pakua PDF
            </button>
          </div>
        </div>
        <p className="panel-empty" style={{ textAlign: "left" }}>
          Chagua mwezi hapo juu kisha bonyeza Chapisha — itatoa karatasi yenye safu ya "Sahihi" kwa kila mfanyakazi.
        </p>
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
                      {employeeName(r.user_id)} — {monthLabel(r.month)}
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
