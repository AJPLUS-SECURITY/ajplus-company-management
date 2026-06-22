import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import MetricCard from "../components/MetricCard"

const INVOICE_STATUS_LABEL = {
  draft: "Rasimu",
  unpaid: "Haijalipwa",
  partially_paid: "Imelipwa Kiasi",
  paid: "Imelipwa",
  overdue: "Imechelewa",
  cancelled: "Imefutwa",
}

function defaultFromDate() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function defaultToDate() {
  return new Date().toISOString().slice(0, 10)
}

function monthLabel(monthStr) {
  if (!monthStr) {
    return ""
  }
  const parts = monthStr.split("-")
  const months = [
    "Jan", "Feb", "Mac", "Apr", "Mei", "Jun",
    "Jul", "Ago", "Sep", "Okt", "Nov", "Des",
  ]
  const idx = Number(parts[1]) - 1
  return (months[idx] || parts[1]) + " " + parts[0]
}

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(defaultFromDate())
  const [toDate, setToDate] = useState(defaultToDate())

  const [incomeTotal, setIncomeTotal] = useState(0)
  const [expenseTotal, setExpenseTotal] = useState(0)

  const [invoicesByStatus, setInvoicesByStatus] = useState({})
  const [payrollByMonth, setPayrollByMonth] = useState([])
  const [stockItems, setStockItems] = useState([])

  useEffect(() => {
    loadReport()
  }, [fromDate, toDate])

  async function loadReport() {
    setLoading(true)

    const [incomeRes, expenseRes, invoicesRes, payrollRes, stockRes] = await Promise.all([
      supabase
        .from("income_records")
        .select("amount, received_at")
        .gte("received_at", fromDate)
        .lte("received_at", toDate),
      supabase
        .from("expense_requests")
        .select("amount, status, paid_at")
        .eq("status", "paid")
        .gte("paid_at", fromDate)
        .lte("paid_at", toDate),
      supabase.from("invoices").select("status, total_amount"),
      supabase.from("payroll_records").select("month, net_salary, status"),
      supabase
        .from("stock_items")
        .select("id, name, current_quantity, unit, reorder_level, service_line:service_lines(name)"),
    ])

    const incomeSum = (incomeRes.data || []).reduce(function (sum, r) {
      return sum + Number(r.amount || 0)
    }, 0)
    setIncomeTotal(incomeSum)

    const expenseSum = (expenseRes.data || []).reduce(function (sum, r) {
      return sum + Number(r.amount || 0)
    }, 0)
    setExpenseTotal(expenseSum)

    const statusMap = {}
    ;(invoicesRes.data || []).forEach(function (inv) {
      const key = inv.status || "unpaid"
      if (!statusMap[key]) {
        statusMap[key] = { count: 0, total: 0 }
      }
      statusMap[key].count += 1
      statusMap[key].total += Number(inv.total_amount || 0)
    })
    setInvoicesByStatus(statusMap)

    const payrollMap = {}
    ;(payrollRes.data || []).forEach(function (p) {
      const key = p.month || "?"
      if (!payrollMap[key]) {
        payrollMap[key] = { paid: 0, pending: 0 }
      }
      if (p.status === "paid") {
        payrollMap[key].paid += Number(p.net_salary || 0)
      } else {
        payrollMap[key].pending += Number(p.net_salary || 0)
      }
    })
    const payrollList = Object.keys(payrollMap)
      .sort(function (a, b) {
        return b.localeCompare(a)
      })
      .slice(0, 6)
      .map(function (month) {
        return Object.assign({ month: month }, payrollMap[month])
      })
    setPayrollByMonth(payrollList)

    setStockItems(stockRes.data || [])

    setLoading(false)
  }

  function invoiceCount(status) {
    return invoicesByStatus[status] ? invoicesByStatus[status].count : 0
  }

  function invoiceTotal(status) {
    return invoicesByStatus[status] ? invoicesByStatus[status].total : 0
  }

  const unpaidStatuses = ["unpaid", "overdue", "partially_paid", "draft"]
  const totalUnpaidAmount = unpaidStatuses.reduce(function (sum, s) {
    return sum + invoiceTotal(s)
  }, 0)
  const totalPaidAmount = invoiceTotal("paid")
  const lowStockItems = stockItems.filter(function (s) {
    return Number(s.current_quantity) <= Number(s.reorder_level)
  })

  function printReport() {
    const logoUrl = window.location.origin + "/logo.png"

    const invoiceRowsHtml = Object.keys(invoicesByStatus)
      .map(function (status) {
        return (
          "<tr><td>" + (INVOICE_STATUS_LABEL[status] || status) + "</td>" +
          "<td style='text-align:center'>" + invoicesByStatus[status].count + "</td>" +
          "<td style='text-align:right'>" + invoicesByStatus[status].total.toLocaleString() + "</td></tr>"
        )
      })
      .join("")

    const payrollRowsHtml = payrollByMonth
      .map(function (p) {
        return (
          "<tr><td>" + monthLabel(p.month) + "</td>" +
          "<td style='text-align:right'>" + p.paid.toLocaleString() + "</td>" +
          "<td style='text-align:right'>" + p.pending.toLocaleString() + "</td></tr>"
        )
      })
      .join("")

    const stockRowsHtml = lowStockItems
      .map(function (s) {
        return (
          "<tr><td>" + s.name + "</td>" +
          "<td>" + (s.service_line ? s.service_line.name : "") + "</td>" +
          "<td style='text-align:right'>" + s.current_quantity + " " + s.unit + "</td>" +
          "<td style='text-align:right'>" + s.reorder_level + " " + s.unit + "</td></tr>"
        )
      })
      .join("")

    const html =
      "<html><head><title>Ripoti ya AJ PLUS</title>" +
      "<style>" +
      "body{font-family:Arial,Helvetica,sans-serif;padding:30px;color:#1a1a1a;}" +
      ".header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1D9E75;padding-bottom:14px;margin-bottom:20px;}" +
      ".header img{height:55px;}" +
      "h1{color:#085041;font-size:18px;margin:0;}" +
      "h2{font-size:14px;margin:18px 0 6px 0;color:#085041;}" +
      "table{width:100%;border-collapse:collapse;margin-bottom:10px;}" +
      "th,td{padding:6px 8px;border:1px solid #ccc;font-size:12px;}" +
      "th{text-align:left;background:#f3f6f4;}" +
      ".summary-row{display:flex;gap:20px;margin-bottom:10px;}" +
      ".summary-box{flex:1;border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center;}" +
      ".summary-box .label{font-size:11px;color:#666;}" +
      ".summary-box .value{font-size:16px;font-weight:bold;margin-top:4px;}" +
      "@media print{button{display:none;}}" +
      "</style></head><body>" +
      "<div class='header'>" +
      "<div><h1>AJ PLUS COMPANY LIMITED</h1><p style='margin:4px 0;font-size:11px;color:#1D9E75;font-weight:600;'>SECURITY &middot; CLEANING &middot; ICT-MEDIA</p></div>" +
      "<img src='" + logoUrl + "' />" +
      "</div>" +
      "<h2>RIPOTI YA BIASHARA &mdash; " + fromDate + " hadi " + toDate + "</h2>" +
      "<div class='summary-row'>" +
      "<div class='summary-box'><div class='label'>Mapato (kipindi)</div><div class='value'>" + incomeTotal.toLocaleString() + " TZS</div></div>" +
      "<div class='summary-box'><div class='label'>Matumizi (kipindi)</div><div class='value'>" + expenseTotal.toLocaleString() + " TZS</div></div>" +
      "<div class='summary-box'><div class='label'>Salio (kipindi)</div><div class='value'>" + (incomeTotal - expenseTotal).toLocaleString() + " TZS</div></div>" +
      "</div>" +
      "<h2>Invoices kwa Status</h2>" +
      "<table><thead><tr><th>Status</th><th>Idadi</th><th>Jumla TZS</th></tr></thead><tbody>" + invoiceRowsHtml + "</tbody></table>" +
      "<h2>Payroll kwa Mwezi (TZS)</h2>" +
      "<table><thead><tr><th>Mwezi</th><th>Imelipwa</th><th>Inasubiri</th></tr></thead><tbody>" + payrollRowsHtml + "</tbody></table>" +
      "<h2>Vifaa vya Stock vinavyokaribia Kuisha</h2>" +
      (lowStockItems.length === 0
        ? "<p style='font-size:12px;color:#666;'>Hakuna kifaa kinachokaribia kuisha kwa sasa.</p>"
        : "<table><thead><tr><th>Kifaa</th><th>Huduma</th><th>Kiasi cha Sasa</th><th>Kiwango cha Chini</th></tr></thead><tbody>" + stockRowsHtml + "</tbody></table>") +
      "<script>window.onload = function(){ window.print(); }</script>" +
      "</body></html>"

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    }
  }

  if (loading) {
    return <div className="page-loading">Inapakia ripoti...</div>
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header-row">
          <p className="panel-title">Ripoti</p>
          <div className="header-buttons">
            <input type="date" value={fromDate} onChange={function (e) { setFromDate(e.target.value) }} />
            <input type="date" value={toDate} onChange={function (e) { setToDate(e.target.value) }} />
            <button className="btn-cancel" onClick={printReport}>
              Chapisha / Pakua PDF
            </button>
          </div>
        </div>

        <div className="metric-grid">
          <MetricCard label="Mapato (kipindi)" value={incomeTotal} />
          <MetricCard label="Matumizi (kipindi)" value={expenseTotal} />
          <MetricCard label="Salio (kipindi)" value={incomeTotal - expenseTotal} color="#085041" />
        </div>
      </div>

      <div className="panel">
        <p className="panel-title">Invoices kwa Status</p>
        <div className="row-list">
          {Object.keys(invoicesByStatus).length === 0 ? (
            <p className="panel-empty">Hakuna invoices bado.</p>
          ) : (
            Object.keys(invoicesByStatus).map(function (status) {
              return (
                <div className="row-item expense-row" key={status}>
                  <div>
                    <p className="row-title">{INVOICE_STATUS_LABEL[status] || status}</p>
                    <p className="row-sub">Idadi: {invoiceCount(status)}</p>
                  </div>
                  <span className="row-amount">{invoiceTotal(status).toLocaleString()} TZS</span>
                </div>
              )
            })
          )}
        </div>
        <p className="invoice-total" style={{ marginTop: "10px" }}>
          Jumla Haijalipwa (zote): {totalUnpaidAmount.toLocaleString()} TZS
        </p>
        <p className="invoice-total" style={{ fontWeight: "bold" }}>
          Jumla Imelipwa (zote): {totalPaidAmount.toLocaleString()} TZS
        </p>
      </div>

      <div className="panel">
        <p className="panel-title">Payroll kwa Mwezi (miezi 6 ya mwisho)</p>
        {payrollByMonth.length === 0 ? (
          <p className="panel-empty">Hakuna payroll bado.</p>
        ) : (
          <div className="row-list">
            {payrollByMonth.map(function (p) {
              return (
                <div className="row-item expense-row" key={p.month}>
                  <div>
                    <p className="row-title">{monthLabel(p.month)}</p>
                    <p className="row-sub">Imelipwa: {p.paid.toLocaleString()} TZS</p>
                  </div>
                  <span className="row-amount">Inasubiri: {p.pending.toLocaleString()} TZS</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="panel">
        <p className="panel-title">Stock Inayokaribia Kuisha</p>
        {lowStockItems.length === 0 ? (
          <p className="panel-empty">Hakuna kifaa kinachokaribia kuisha kwa sasa.</p>
        ) : (
          <div className="row-list">
            {lowStockItems.map(function (s) {
              return (
                <div className="row-item expense-row" key={s.id}>
                  <div>
                    <p className="row-title">{s.name}</p>
                    <p className="row-sub">{s.service_line ? s.service_line.name : ""}</p>
                  </div>
                  <span className="badge badge-rejected">
                    {s.current_quantity} {s.unit} (chini ya {s.reorder_level})
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
