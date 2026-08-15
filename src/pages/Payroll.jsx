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

const EDITABLE_FIELDS = [
  { key: "basic_salary", label: "Basic" },
  { key: "earnings", label: "Earnings" },
  { key: "overtime", label: "Overtime" },
  { key: "hospital", label: "Hospital" },
  { key: "fare", label: "Fare" },
  { key: "nssf", label: "NSSF" },
]

function currentMonth() {
  const now = new Date()
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0")
}

function monthLabel(monthStr) {
  if (!monthStr) return ""
  const parts = monthStr.split("-")
  const months = [
    "Januari", "Februari", "Machi", "Aprili", "Mei", "Juni",
    "Julai", "Agosti", "Septemba", "Oktoba", "Novemba", "Desemba",
  ]
  const idx = Number(parts[1]) - 1
  return (months[idx] || parts[1]) + " " + parts[0]
}

function emptyRow(basicDefault) {
  return {
    basic_salary: basicDefault || "",
    earnings: "",
    overtime: "",
    hospital: "",
    fare: "",
    nssf: "",
  }
}

function rowTotalDeduction(row) {
  return (Number(row.hospital) || 0) + (Number(row.fare) || 0) + (Number(row.nssf) || 0)
}

function rowNet(row) {
  const basic = Number(row.basic_salary) || 0
  const earnings = Number(row.earnings) || 0
  const overtime = Number(row.overtime) || 0
  return basic + earnings + overtime - rowTotalDeduction(row)
}

export default function Payroll() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows] = useState({}) // employeeId -> row fields (editable state)
  const [printMonth, setPrintMonth] = useState(currentMonth())

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    // Rebuild the editable rows whenever the selected month or the
    // underlying data changes: prefer a saved record for this month,
    // otherwise start from the employee's position default.
    const next = {}
    employees.forEach(function (emp) {
      const existing = records.find(function (r) {
        return r.user_id === emp.id && r.month === month
      })
      if (existing) {
        next[emp.id] = {
          id: existing.id,
          basic_salary: String(existing.basic_salary ?? ""),
          earnings: String(existing.allowances ?? ""),
          overtime: String(existing.overtime ?? ""),
          hospital: String(existing.hospital ?? ""),
          fare: String(existing.fare ?? ""),
          nssf: String(existing.nssf ?? ""),
          status: existing.status,
          paid_at: existing.paid_at,
        }
      } else {
        const basicDefault = emp.positions && emp.positions.base_salary ? String(emp.positions.base_salary) : ""
        next[emp.id] = Object.assign({ id: null, status: "pending" }, emptyRow(basicDefault))
      }
    })
    setRows(next)
  }, [employees, records, month])

  async function loadAll() {
    setLoading(true)
    const empRes = await supabase
      .from("users")
      .select("id, full_name, department_id, position_id, positions(base_salary), departments(name)")
      .eq("status", "active")
      .order("full_name")

    setEmployees(empRes.data || [])
    await loadRecords()
    setLoading(false)
  }

  async function loadRecords() {
    const res = await supabase
      .from("payroll_records")
      .select(
        "id, user_id, month, basic_salary, allowances, overtime, hospital, fare, nssf, deductions, net_salary, status, paid_at"
      )
      .order("created_at", { ascending: false })
      .limit(500)
    setRecords(res.data || [])
  }

  function updateCell(employeeId, field, value) {
    setRows(function (prev) {
      const copy = Object.assign({}, prev)
      copy[employeeId] = Object.assign({}, copy[employeeId], { [field]: value })
      return copy
    })
  }

  async function saveRow(employeeId) {
    const row = rows[employeeId]
    if (!row || Number(row.basic_salary) <= 0) {
      setMessage({ type: "error", text: "Weka Basic Salary kabla ya kuhifadhi" })
      return
    }
    setBusy(true)
    setMessage(null)

    const payload = {
      user_id: employeeId,
      month,
      basic_salary: Number(row.basic_salary) || 0,
      allowances: Number(row.earnings) || 0,
      overtime: Number(row.overtime) || 0,
      hospital: Number(row.hospital) || 0,
      fare: Number(row.fare) || 0,
      nssf: Number(row.nssf) || 0,
      deductions: rowTotalDeduction(row),
      net_salary: rowNet(row),
      status: row.status || "pending",
      created_by: profile.id,
    }

    let res
    if (row.id) {
      res = await supabase.from("payroll_records").update(payload).eq("id", row.id)
    } else {
      res = await supabase.from("payroll_records").insert(payload)
    }

    setBusy(false)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    setMessage({ type: "success", text: "Imehifadhiwa" })
    await loadRecords()
  }

  async function saveAll() {
    setMessage(null)
    const toSave = Object.keys(rows).filter(function (empId) {
      return Number(rows[empId].basic_salary) > 0
    })
    if (toSave.length === 0) {
      setMessage({ type: "error", text: "Weka angalau Basic Salary ya mfanyakazi mmoja" })
      return
    }
    setBusy(true)
    for (const empId of toSave) {
      const row = rows[empId]
      const payload = {
        user_id: empId,
        month,
        basic_salary: Number(row.basic_salary) || 0,
        allowances: Number(row.earnings) || 0,
        overtime: Number(row.overtime) || 0,
        hospital: Number(row.hospital) || 0,
        fare: Number(row.fare) || 0,
        nssf: Number(row.nssf) || 0,
        deductions: rowTotalDeduction(row),
        net_salary: rowNet(row),
        status: row.status || "pending",
        created_by: profile.id,
      }
      if (row.id) {
        await supabase.from("payroll_records").update(payload).eq("id", row.id)
      } else {
        await supabase.from("payroll_records").insert(payload)
      }
    }
    setBusy(false)
    setMessage({ type: "success", text: "Payroll ya mwezi wa " + monthLabel(month) + " imehifadhiwa" })
    await loadRecords()
  }

  async function markAsPaid(employeeId) {
    const row = rows[employeeId]
    if (!row || !row.id) {
      setMessage({ type: "error", text: "Hifadhi kwanza kabla ya kuweka kama imelipwa" })
      return
    }
    setMessage(null)
    const res = await supabase
      .from("payroll_records")
      .update({ status: "paid", paid_at: new Date().toISOString().slice(0, 10) })
      .eq("id", row.id)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    setMessage({ type: "success", text: "Imewekwa kama imelipwa" })
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

    function employeeName(userId) {
      const emp = employees.find(function (e) {
        return e.id === userId
      })
      return emp ? emp.full_name : "Mfanyakazi"
    }

    const rowsHtml = monthRecords
      .map(function (r, idx) {
        const totalDeduction = Number(r.hospital || 0) + Number(r.fare || 0) + Number(r.nssf || 0)
        grandTotal += Number(r.net_salary) || 0
        return (
          "<tr>" +
          "<td>" + (idx + 1) + "</td>" +
          "<td class='name-cell'>" + employeeName(r.user_id) + "</td>" +
          "<td>" + Number(r.basic_salary).toLocaleString() + "</td>" +
          "<td>" + Number(r.allowances || 0).toLocaleString() + "</td>" +
          "<td>" + Number(r.overtime || 0).toLocaleString() + "</td>" +
          "<td>" + totalDeduction.toLocaleString() + "</td>" +
          "<td>" + Number(r.hospital || 0).toLocaleString() + "</td>" +
          "<td>" + Number(r.fare || 0).toLocaleString() + "</td>" +
          "<td>" + Number(r.nssf || 0).toLocaleString() + "</td>" +
          "<td class='net-cell'>" + Number(r.net_salary).toLocaleString() + "</td>" +
          "<td class='sign-cell'></td>" +
          "</tr>"
        )
      })
      .join("")

    const html =
      "<html><head><title>Payroll Sheet - " + printMonth + "</title>" +
      "<style>" +
      "@page{size:landscape;margin:14mm;}" +
      "body{font-family:Arial,Helvetica,sans-serif;padding:12px;color:#1a1a1a;}" +
      ".header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1D9E75;padding-bottom:10px;margin-bottom:14px;}" +
      ".header img{height:46px;}" +
      "h1{color:#085041;font-size:16px;margin:0;}" +
      "h2{font-size:13px;margin:10px 0;}" +
      "table{width:100%;border-collapse:collapse;font-size:10px;}" +
      "th,td{padding:4px 5px;border:1px solid #bbb;text-align:right;}" +
      "th{text-align:center;background:#f3f6f4;font-size:9.5px;}" +
      "td.name-cell{text-align:left;white-space:nowrap;}" +
      "td.net-cell{font-weight:bold;}" +
      "td.sign-cell{min-width:55px;height:22px;}" +
      ".total-row td{font-weight:bold;background:#f7f7f7;}" +
      ".footer{margin-top:24px;font-size:10px;color:#444;display:flex;justify-content:space-between;}" +
      ".footer div{width:28%;border-top:1px solid #999;padding-top:5px;text-align:center;}" +
      "@media print{button{display:none;}}" +
      "</style></head><body>" +
      "<div class='header'>" +
      "<div><h1>AJ PLUS COMPANY LIMITED</h1><p style='margin:3px 0;font-size:10px;'>SECURITY &middot; CLEANING &middot; ICT-MEDIA</p></div>" +
      "<img src='" + logoUrl + "' />" +
      "</div>" +
      "<h2>PAYROLL SHEET &mdash; " + monthLabel(printMonth) + "</h2>" +
      "<table><thead><tr>" +
      "<th>S/N</th><th>Staff Name</th><th>Basic Salary</th><th>Earnings</th><th>Overtime</th>" +
      "<th>Total Deduction</th><th>Hospital</th><th>Fare</th><th>NSSF</th><th>Net Salary</th><th>Sahihi</th>" +
      "</tr></thead><tbody>" + rowsHtml +
      "<tr class='total-row'><td colspan='9' style='text-align:right'>JUMLA KUU</td><td>" + grandTotal.toLocaleString() + "</td><td></td></tr>" +
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

  const grandNet = Object.values(rows).reduce(function (sum, r) {
    return sum + rowNet(r)
  }, 0)

  return (
    <div>
      {message ? (
        <p className={message.type === "error" ? "login-error" : "reset-success"}>{message.text}</p>
      ) : null}

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Payroll — Chati ya Wafanyakazi Wote</p>
          <div className="header-buttons">
            <input type="month" value={month} onChange={function (e) { setMonth(e.target.value) }} />
            <button className="btn-approve" disabled={busy} onClick={saveAll}>
              {busy ? "Inahifadhi..." : "Hifadhi Wote"}
            </button>
          </div>
        </div>

        <p className="panel-empty" style={{ textAlign: "left", marginTop: "-4px", marginBottom: "12px" }}>
          Mwezi: {monthLabel(month)} · Wafanyakazi {employees.length} · Jumla Net (kwa sasa): {grandNet.toLocaleString()} TZS
        </p>

        {employees.length === 0 ? (
          <p className="panel-empty">Hakuna mfanyakazi active. Ongeza kwenye "HR - Wafanyakazi" kwanza.</p>
        ) : (
          <div className="payroll-table-wrap">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th className="sticky-col">Jina</th>
                  {EDITABLE_FIELDS.map(function (f) {
                    return <th key={f.key}>{f.label}</th>
                  })}
                  <th>Net</th>
                  <th>Status</th>
                  <th>Vitendo</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(function (emp) {
                  const row = rows[emp.id] || emptyRow()
                  const isPaid = row.status === "paid"
                  return (
                    <tr key={emp.id}>
                      <td className="sticky-col">
                        <div className="payroll-emp-name">{emp.full_name}</div>
                        <div className="payroll-emp-dept">{emp.departments ? emp.departments.name : "—"}</div>
                      </td>
                      {EDITABLE_FIELDS.map(function (f) {
                        return (
                          <td key={f.key}>
                            <input
                              type="number"
                              min="0"
                              value={row[f.key]}
                              disabled={isPaid}
                              onChange={function (e) {
                                updateCell(emp.id, f.key, e.target.value)
                              }}
                            />
                          </td>
                        )
                      })}
                      <td className="payroll-net-cell">{rowNet(row).toLocaleString()}</td>
                      <td>
                        <span className={"badge " + (STATUS_BADGE[row.status] || "badge-pending")}>
                          {STATUS_LABEL[row.status] || row.status}
                        </span>
                      </td>
                      <td className="payroll-actions-cell">
                        <button className="btn-cancel" disabled={busy || isPaid} onClick={function () { saveRow(emp.id) }}>
                          Hifadhi
                        </button>
                        {row.id && !isPaid ? (
                          <button className="btn-approve" onClick={function () { markAsPaid(emp.id) }}>
                            Lipa
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Chapisha Payroll Sheet</p>
          <div className="header-buttons">
            <input type="month" value={printMonth} onChange={function (e) { setPrintMonth(e.target.value) }} />
            <button className="btn-cancel" onClick={printPayrollSheet}>
              Chapisha / Pakua PDF
            </button>
          </div>
        </div>
        <p className="panel-empty" style={{ textAlign: "left" }}>
          Karatasi inatumia mpangilio wa "landscape" ili wafanyakazi wengi waonekane kwenye ukurasa mmoja.
        </p>
      </div>
    </div>
  )
}
