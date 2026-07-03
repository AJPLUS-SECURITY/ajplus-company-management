import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"

const STATUS_LABEL = {
  draft: "Rasimu",
  unpaid: "Haijalipwa",
  partially_paid: "Imelipwa Kiasi",
  paid: "Imelipwa",
  overdue: "Imechelewa",
  cancelled: "Imefutwa",
}

function makeVerificationCode(invoiceNumber, totalAmount) {
  const raw = String(invoiceNumber) + "|" + String(Math.round(Number(totalAmount) || 0))
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  }
  return hash.toString(36).toUpperCase().padStart(8, "0").slice(0, 8)
}

export default function PublicInvoice() {
  const { token } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(function () {
    async function load() {
      const res = await supabase.rpc("get_public_invoice", { p_token: token })
      if (res.error || !res.data || res.data.length === 0) {
        setError("Invoice haikupatikana au link si sahihi.")
        setLoading(false)
        return
      }
      setInvoice(res.data[0])
      setLoading(false)
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.loadingText}>Inapakia invoice...</p>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.errorText}>{error || "Invoice haikupatikana."}</p>
        </div>
      </div>
    )
  }

  const items = invoice.items || []
  const isPaid = invoice.status === "paid"
  const documentTitle = isPaid ? "RISITI YA MALIPO" : "INVOICE"
  const verifyCode = makeVerificationCode(invoice.invoice_number, invoice.total_amount)
  const subtotal = Number(invoice.subtotal) || 0
  const grandTotal = Number(invoice.total_amount) || 0
  const vatAmount = grandTotal - subtotal

  return (
    <div style={styles.page}>
      <div style={styles.card} id="printable">
        <div style={styles.header}>
          <div>
            <h1 style={styles.companyName}>AJ PLUS COMPANY LIMITED</h1>
            <p style={styles.tagline}>Fikiri Kimataifa &mdash; Zungumza Kitanzania</p>
          </div>
          <img src="/logo.png" alt="AJ PLUS" style={styles.logo} />
        </div>

        <h2 style={styles.docTitle}>{documentTitle} &mdash; {invoice.invoice_number}</h2>
        <span style={{ ...styles.statusPill, color: isPaid ? "#085041" : "#854f0b", background: isPaid ? "#e1f5ee" : "#faeeda" }}>
          {(STATUS_LABEL[invoice.status] || invoice.status).toUpperCase()}
        </span>

        <div style={styles.infoBlock}>
          <p><strong>Mteja:</strong> {invoice.client_name || "-"}</p>
          <p><strong>Simu:</strong> {invoice.client_phone || "-"}</p>
          <p><strong>Huduma:</strong> {invoice.service_line_name || "-"}</p>
          <p><strong>Tarehe ya kutoa:</strong> {invoice.issue_date || "-"} &nbsp;&nbsp; <strong>Inadaiwa:</strong> {invoice.due_date || "Haijawekwa"}</p>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Maelezo</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Idadi</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Bei</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Jumla</th>
            </tr>
          </thead>
          <tbody>
            {items.map(function (item, idx) {
              return (
                <tr key={idx}>
                  <td style={styles.td}>{item.description}</td>
                  <td style={{ ...styles.td, textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{Number(item.unit_price).toLocaleString()}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{Number(item.line_total).toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <p style={styles.vatRow}>Jumla ndogo: {subtotal.toLocaleString()} TZS</p>
        <p style={styles.vatRow}>VAT (18%): {vatAmount.toLocaleString()} TZS</p>
        <p style={styles.totalRow}>JUMLA KUU: {grandTotal.toLocaleString()} TZS</p>

        <div style={styles.verifyBox}>
          <p style={styles.verifyLabel}>Namba ya Uthibitisho (Verification Code)</p>
          <p style={styles.verifyCode}>{verifyCode}</p>
          <p style={styles.verifyNote}>
            Hii ni nakala ya mtandaoni ya invoice hii, iliyotolewa na AJ PLUS COMPANY LIMITED.
          </p>
        </div>

        <button style={styles.printBtn} onClick={function () { window.print() }}>
          Chapisha / Pakua PDF
        </button>

        <p style={styles.footer}>Asante kwa kufanya kazi na AJ PLUS COMPANY LIMITED.</p>
      </div>

      <style>{"@media print{ button{ display:none; } body{ background:#fff; } }"}</style>
    </div>
  )
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f3f6f4",
    display: "flex",
    justifyContent: "center",
    padding: "24px 12px",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#1a1a1a",
  },
  loadingText: { marginTop: 60, color: "#555" },
  card: {
    background: "#fff",
    maxWidth: 640,
    width: "100%",
    padding: 32,
    borderRadius: 10,
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    height: "fit-content",
  },
  errorText: { color: "#b3261e", fontWeight: "bold" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "3px solid #1D9E75",
    paddingBottom: 16,
    marginBottom: 20,
  },
  companyName: { color: "#085041", fontSize: 20, margin: 0 },
  tagline: { margin: "4px 0", fontSize: 12, color: "#555" },
  logo: { height: 56 },
  docTitle: { fontSize: 17, marginTop: 8 },
  statusPill: { display: "inline-block", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: "bold", marginTop: 6 },
  infoBlock: { marginTop: 14, fontSize: 13, lineHeight: 1.6 },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 16 },
  th: { padding: 8, borderBottom: "1px solid #ddd", fontSize: 13, textAlign: "left", background: "#f3f6f4" },
  td: { padding: 8, borderBottom: "1px solid #ddd", fontSize: 13 },
  vatRow: { fontSize: 13, textAlign: "right", margin: "2px 0" },
  totalRow: { fontWeight: "bold", fontSize: 16, marginTop: 10, textAlign: "right" },
  verifyBox: {
    marginTop: 24,
    border: "1px dashed #1D9E75",
    borderRadius: 8,
    padding: "14px 16px",
    background: "#f3f6f4",
    textAlign: "center",
  },
  verifyLabel: { fontSize: 11, color: "#085041", margin: "2px 0" },
  verifyCode: { fontFamily: "monospace", fontWeight: "bold", fontSize: 18, letterSpacing: 2, margin: "6px 0" },
  verifyNote: { fontSize: 11, color: "#666", margin: "6px 0 0 0" },
  printBtn: {
    marginTop: 20,
    width: "100%",
    padding: "10px 0",
    background: "#1D9E75",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "bold",
    cursor: "pointer",
  },
  footer: { marginTop: 18, fontSize: 11, color: "#666", textAlign: "center" },
}
