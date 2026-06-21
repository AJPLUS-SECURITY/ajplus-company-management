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

const STATUS_LABEL_EN = {
  draft: "Draft",
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
}

const DOC_TEXT = {
  sw: {
    client: "Mteja",
    phone: "Simu",
    service: "Huduma",
    issueDate: "Tarehe ya kutoa",
    dueDate: "Inadaiwa",
    notSet: "Haijawekwa",
    description: "Maelezo",
    qty: "Idadi",
    price: "Bei",
    lineTotal: "Jumla",
    subtotal: "Jumla ndogo",
    vatLabel: "VAT (18%)",
    grandTotal: "JUMLA KUU",
    paymentMethods: "Njia za Malipo",
    bankAccNum: "Namba ya Akaunti",
    bankAccName: "Jina la Akaunti",
    scanHint: "Kagua (scan) kupata taarifa za malipo",
    terms:
      "Masharti ya malipo: Tafadhali kamilisha malipo ndani ya siku 14 kuanzia tarehe ya hati hii. " +
      "Malipo yaliyochelewa zaidi ya siku 30 yanaweza kutozwa riba ya ziada ya makubaliano. " +
      "Kwa maswali yoyote kuhusu malipo, tafadhali wasiliana nasi moja kwa moja. " +
      "Asante kwa kuchagua AJ PLUS COMPANY LIMITED &mdash; tunathamini ushirikiano wako.",
    thanksInvoice: "Asante kwa kufanya kazi na AJ PLUS COMPANY LIMITED.",
    invoiceTitle: "INVOICE",
    receiptTitle: "RISITI YA MALIPO",
    quotationTitle: "QUOTATION / MAKADIRIO YA BEI",
    estTotal: "JUMLA YA MAKADIRIO",
    quoteNote:
      "Hii ni quotation/makadirio ya bei, sio invoice. Bei hii ni halali kwa siku 7 kuanzia tarehe ya kutolewa. " +
      "Punguzo au ongezeko linaweza kutokea kulingana na maelezo zaidi ya kazi.",
    thanksQuote: "Asante kwa kufikiria AJ PLUS COMPANY LIMITED.",
    tagline: "Fikiri Kimataifa &mdash; Zungumza Kitanzania",
    date: "Tarehe",
  },
  en: {
    client: "Client",
    phone: "Phone",
    service: "Service",
    issueDate: "Issue Date",
    dueDate: "Due Date",
    notSet: "Not set",
    description: "Description",
    qty: "Qty",
    price: "Price",
    lineTotal: "Total",
    subtotal: "Subtotal",
    vatLabel: "VAT (18%)",
    grandTotal: "GRAND TOTAL",
    paymentMethods: "Payment Methods",
    bankAccNum: "Account Number",
    bankAccName: "Account Name",
    scanHint: "Scan to view payment details",
    terms:
      "Payment Terms: Please complete payment within 14 days from the date of this document. " +
      "Payments delayed beyond 30 days may incur an agreed additional interest charge. " +
      "For any payment questions, please contact us directly. " +
      "Thank you for choosing AJ PLUS COMPANY LIMITED &mdash; we value our partnership with you.",
    thanksInvoice: "Thank you for doing business with AJ PLUS COMPANY LIMITED.",
    invoiceTitle: "INVOICE",
    receiptTitle: "PAYMENT RECEIPT",
    quotationTitle: "QUOTATION",
    estTotal: "ESTIMATED TOTAL",
    quoteNote:
      "This is a price quotation, not an invoice. This price is valid for 7 days from the date issued. " +
      "Adjustments may apply depending on further work details.",
    thanksQuote: "Thank you for considering AJ PLUS COMPANY LIMITED.",
    tagline: "Global Thinking, Tanzanian Service",
    date: "Date",
  },
}

const VAT_RATE = 0.18

function companyHeaderHtml(logoUrl, lang) {
  const t = DOC_TEXT[lang] || DOC_TEXT.sw
  return (
    "<div class='header'>" +
    "<div>" +
    "<h1>AJ PLUS COMPANY LIMITED</h1>" +
    "<p style='margin:4px 0;font-size:12px;'>" + t.tagline + "</p>" +
    "<p style='margin:2px 0;font-size:11px;color:#1D9E75;font-weight:600;letter-spacing:0.5px;'>SECURITY &middot; CLEANING &middot; ICT-MEDIA</p>" +
    "</div>" +
    "<img src='" + logoUrl + "' />" +
    "</div>"
  )
}

function paymentInfoHtml(lang) {
  const t = DOC_TEXT[lang] || DOC_TEXT.sw
  const qrText = "AJ PLUS COMPANY LIMITED | NMB Tegeta: 23510095544 | Lipa Namba (Yas): 44934738"
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=" + encodeURIComponent(qrText)

  return (
    "<div class='pay-section'>" +
    "<h3>" + t.paymentMethods + "</h3>" +
    "<div class='pay-grid'>" +
    "<div class='pay-col'>" +
    "<p><strong>Bank: NMB Bank, Tegeta Branch</strong></p>" +
    "<p>" + t.bankAccNum + ": 23510095544</p>" +
    "<p>" + t.bankAccName + ": AJPLUS Company Limited</p>" +
    "<p style='margin-top:10px;'><strong>Lipa by Mixx by Yas</strong></p>" +
    "<p>Lipa Namba: 44934738</p>" +
    "<p>" + t.bankAccName + ": AJPLUS Company Limited</p>" +
    "</div>" +
    "<div class='pay-col' style='text-align:center;'>" +
    "<img src='" + qrUrl + "' alt='QR' style='width:110px;height:110px;' />" +
    "<p style='font-size:10px;color:#666;margin-top:4px;'>" + t.scanHint + "</p>" +
    "</div>" +
    "</div>" +
    "<p class='terms'><strong>" + t.terms + "</strong></p>" +
    "</div>"
  )
}

const PAYMENT_SECTION_CSS =
  ".pay-section{margin-top:28px;border-top:1px solid #ddd;padding-top:16px;}" +
  ".pay-section h3{font-size:14px;margin:0 0 10px 0;color:#085041;}" +
  ".pay-grid{display:flex;justify-content:space-between;gap:20px;}" +
  ".pay-col p{margin:3px 0;font-size:12px;}" +
  ".terms{font-size:11px;color:#555;margin-top:16px;line-height:1.5;background:#f7f7f7;padding:10px;border-radius:6px;}" +
  ".vat-row{font-size:13px;text-align:right;margin:2px 0;}"

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
  const [docLang, setDocLang] = useState("sw")

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
      .select(
        "id, invoice_number, status, subtotal, total_amount, amount_paid, due_date, issue_date, client_id, client:clients(name, phone), service_line:service_lines(name)"
      )
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

  function calculateVat() {
    return calculateTotal() * VAT_RATE
  }

  function calculateGrandTotal() {
    return calculateTotal() + calculateVat()
  }

  function generateInvoiceNumber() {
    const now = new Date()
    const stamp = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, "0") + now.getDate().toString().padStart(2, "0")
    const rand = Math.floor(Math.random() * 9000 + 1000)
    return "INV-" + stamp + "-" + rand
  }

  function downloadQuotation() {
    setMessage(null)

    const t = DOC_TEXT[docLang] || DOC_TEXT.sw
    const client = clients.find(function (c) { return c.id === form.client_id })
    const serviceLine = serviceLines.find(function (sl) { return sl.id === form.service_line_id })

    const validItems = form.items.filter(function (item) {
      return item.description && Number(item.unit_price) > 0
    })

    if (validItems.length === 0) {
      setMessage({ type: "error", text: "Ongeza angalau kitu kimoja chenye bei kabla ya kupakua quotation" })
      return
    }

    const now = new Date()
    const stamp = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, "0") + now.getDate().toString().padStart(2, "0")
    const quoteNumber = "QTN-" + stamp + "-" + Math.floor(Math.random() * 9000 + 1000)
    const logoUrl = window.location.origin + "/logo.png"
    const subtotalAmount = calculateTotal()
    const vatAmountDisplay = calculateVat()
    const grandTotalAmount = calculateGrandTotal()

    const rowsHtml = validItems
      .map(function (item) {
        const qty = Number(item.quantity) || 1
        const price = Number(item.unit_price) || 0
        return (
          "<tr>" +
          "<td>" + item.description + "</td>" +
          "<td style='text-align:center'>" + qty + "</td>" +
          "<td style='text-align:right'>" + price.toLocaleString() + "</td>" +
          "<td style='text-align:right'>" + (qty * price).toLocaleString() + "</td>" +
          "</tr>"
        )
      })
      .join("")

    const html =
      "<html><head><title>" + quoteNumber + "</title>" +
      "<style>" +
      "body{font-family:Arial,Helvetica,sans-serif;padding:36px;color:#1a1a1a;}" +
      ".header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1D9E75;padding-bottom:16px;margin-bottom:24px;}" +
      ".header img{height:60px;}" +
      "h1{color:#085041;font-size:20px;margin:0;}" +
      "h2{font-size:16px;margin-top:24px;}" +
      "table{width:100%;border-collapse:collapse;margin-top:16px;}" +
      "th,td{padding:8px;border-bottom:1px solid #ddd;font-size:13px;}" +
      "th{text-align:left;background:#f3f6f4;}" +
      ".total-row{font-weight:bold;font-size:16px;margin-top:10px;text-align:right;}" +
      ".info p{margin:4px 0;font-size:13px;}" +
      ".note{margin-top:16px;font-size:12px;color:#854f0b;background:#faeeda;padding:10px;border-radius:6px;}" +
      ".footer{margin-top:24px;font-size:11px;color:#666;text-align:center;}" +
      PAYMENT_SECTION_CSS +
      "@media print{button{display:none;}}" +
      "</style></head><body>" +
      companyHeaderHtml(logoUrl, docLang) +
      "<h2>" + t.quotationTitle + " &mdash; " + quoteNumber + "</h2>" +
      "<div class='info'>" +
      "<p><strong>" + t.client + ":</strong> " + (client ? client.name : "") + "</p>" +
      "<p><strong>" + t.service + ":</strong> " + (serviceLine ? serviceLine.name : "") + "</p>" +
      "<p><strong>" + t.date + ":</strong> " + now.toLocaleDateString("en-GB") + "</p>" +
      "</div>" +
      "<table><thead><tr><th>" + t.description + "</th><th>" + t.qty + "</th><th>" + t.price + "</th><th>" + t.lineTotal + "</th></tr></thead>" +
      "<tbody>" + rowsHtml + "</tbody></table>" +
      "<p class='vat-row'>" + t.subtotal + ": " + subtotalAmount.toLocaleString() + " TZS</p>" +
      "<p class='vat-row'>" + t.vatLabel + ": " + vatAmountDisplay.toLocaleString() + " TZS</p>" +
      "<p class='total-row'>" + t.estTotal + ": " + grandTotalAmount.toLocaleString() + " TZS</p>" +
      "<p class='note'>" + t.quoteNote + "</p>" +
      paymentInfoHtml(docLang) +
      "<p class='footer'>" + t.thanksQuote + "</p>" +
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

    const subtotal = calculateTotal()
    const vatAmount = calculateVat()
    const grandTotal = calculateGrandTotal()
    const invoiceNumber = generateInvoiceNumber()

    const invoiceRes = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        client_id: form.client_id,
        service_line_id: form.service_line_id,
        due_date: form.due_date || null,
        subtotal: subtotal,
        total_amount: grandTotal,
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

  async function downloadReceipt(invoice) {
    setMessage(null)
    const itemsRes = await supabase
      .from("invoice_items")
      .select("description, quantity, unit_price, line_total")
      .eq("invoice_id", invoice.id)

    if (itemsRes.error) {
      setMessage({ type: "error", text: itemsRes.error.message })
      return
    }

    const t = DOC_TEXT[docLang] || DOC_TEXT.sw
    const items = itemsRes.data || []
    const clientName = invoice.client ? invoice.client.name : ""
    const clientPhone = invoice.client ? invoice.client.phone : ""
    const serviceLineName = invoice.service_line ? invoice.service_line.name : ""
    const logoUrl = window.location.origin + "/logo.png"

    const isPaid = invoice.status === "paid"
    const documentTitle = isPaid ? t.receiptTitle : t.invoiceTitle
    const statusLabels = docLang === "en" ? STATUS_LABEL_EN : STATUS_LABEL
    const statusText = statusLabels[invoice.status] || invoice.status
    const statusColor = isPaid ? "#085041" : "#854f0b"
    const statusBg = isPaid ? "#e1f5ee" : "#faeeda"
    const subtotalAmount = Number(invoice.subtotal) || 0
    const grandTotalAmount = Number(invoice.total_amount) || 0
    const vatAmountDisplay = grandTotalAmount - subtotalAmount

    const rowsHtml = items
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" + item.description + "</td>" +
          "<td style='text-align:center'>" + item.quantity + "</td>" +
          "<td style='text-align:right'>" + Number(item.unit_price).toLocaleString() + "</td>" +
          "<td style='text-align:right'>" + Number(item.line_total).toLocaleString() + "</td>" +
          "</tr>"
        )
      })
      .join("")

    const html =
      "<html><head><title>" + documentTitle + " - " + invoice.invoice_number + "</title>" +
      "<style>" +
      "body{font-family:Arial,Helvetica,sans-serif;padding:36px;color:#1a1a1a;}" +
      ".header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1D9E75;padding-bottom:16px;margin-bottom:24px;}" +
      ".header img{height:60px;}" +
      "h1{color:#085041;font-size:20px;margin:0;}" +
      "h2{font-size:18px;margin-top:24px;}" +
      "table{width:100%;border-collapse:collapse;margin-top:16px;}" +
      "th,td{padding:8px;border-bottom:1px solid #ddd;font-size:13px;}" +
      "th{text-align:left;background:#f3f6f4;}" +
      ".total-row{font-weight:bold;font-size:16px;margin-top:10px;text-align:right;}" +
      ".info p{margin:4px 0;font-size:13px;}" +
      ".status-pill{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:bold;color:" + statusColor + ";background:" + statusBg + ";margin-top:6px;}" +
      ".footer{margin-top:24px;font-size:11px;color:#666;text-align:center;}" +
      PAYMENT_SECTION_CSS +
      "@media print{button{display:none;}}" +
      "</style></head><body>" +
      companyHeaderHtml(logoUrl, docLang) +
      "<h2>" + documentTitle + " &mdash; " + invoice.invoice_number + "</h2>" +
      "<span class='status-pill'>" + statusText.toUpperCase() + "</span>" +
      "<div class='info' style='margin-top:14px;'>" +
      "<p><strong>" + t.client + ":</strong> " + clientName + "</p>" +
      "<p><strong>" + t.phone + ":</strong> " + (clientPhone || "-") + "</p>" +
      "<p><strong>" + t.service + ":</strong> " + serviceLineName + "</p>" +
      "<p><strong>" + t.issueDate + ":</strong> " + (invoice.issue_date || "-") + " &nbsp;&nbsp; <strong>" + t.dueDate + ":</strong> " + (invoice.due_date || t.notSet) + "</p>" +
      "</div>" +
      "<table><thead><tr><th>" + t.description + "</th><th>" + t.qty + "</th><th>" + t.price + "</th><th>" + t.lineTotal + "</th></tr></thead>" +
      "<tbody>" + rowsHtml + "</tbody></table>" +
      "<p class='vat-row'>" + t.subtotal + ": " + subtotalAmount.toLocaleString() + " TZS</p>" +
      "<p class='vat-row'>" + t.vatLabel + ": " + vatAmountDisplay.toLocaleString() + " TZS</p>" +
      "<p class='total-row'>" + t.grandTotal + ": " + grandTotalAmount.toLocaleString() + " TZS</p>" +
      paymentInfoHtml(docLang) +
      "<p class='footer'>" + t.thanksInvoice + "</p>" +
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

  function shareWhatsApp(invoice) {
    const clientPhone = invoice.client ? invoice.client.phone : ""
    const clientName = invoice.client ? invoice.client.name : ""
    const text =
      "Habari " + clientName + ", hii ni invoice yako " + invoice.invoice_number +
      " ya jumla TZS " + Number(invoice.total_amount).toLocaleString() +
      " kutoka AJ PLUS COMPANY LIMITED. Tafadhali angalia risiti iliyopakuliwa (PDF) tuliyokutumia."

    let phone = (clientPhone || "").replace(/[^0-9]/g, "")
    if (phone.startsWith("0")) {
      phone = "255" + phone.slice(1)
    }

    const url = phone
      ? "https://wa.me/" + phone + "?text=" + encodeURIComponent(text)
      : "https://wa.me/?text=" + encodeURIComponent(text)

    window.open(url, "_blank")
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
            <select
              value={docLang}
              onChange={function (e) { setDocLang(e.target.value) }}
              style={{ marginRight: "4px" }}
              title="Lugha ya document (Invoice/Risiti/Quotation)"
            >
              <option value="sw">🇹🇿 Kiswahili</option>
              <option value="en">🇬🇧 English</option>
            </select>
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

            <div className="vat-breakdown">
              <p className="invoice-total">Jumla ndogo: {calculateTotal().toLocaleString()} TZS</p>
              <p className="invoice-total">VAT (18%): {calculateVat().toLocaleString()} TZS</p>
              <p className="invoice-total" style={{ fontWeight: "bold" }}>
                Jumla kuu: {calculateGrandTotal().toLocaleString()} TZS
              </p>
            </div>

            <div className="header-buttons">
              <button type="button" className="btn-cancel" onClick={downloadQuotation}>
                Pakua Quotation (PDF)
              </button>
              <button className="btn-approve submit-income" disabled={busy}>
                {busy ? "Inatengeneza..." : "Tengeneza invoice"}
              </button>
            </div>
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
                    <button className="btn-cancel" onClick={function () { downloadReceipt(inv) }}>
                      {inv.status === "paid" ? "Pakua Risiti" : "Pakua Invoice"}
                    </button>
                    <button className="btn-cancel" onClick={function () { shareWhatsApp(inv) }}>
                      Tuma WhatsApp
                    </button>
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
