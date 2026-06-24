import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../contexts/AuthContext"

function emptyForm(defaultServiceLine) {
  return {
    client_name: "",
    rating: "5",
    comment: "",
    service_line_id: defaultServiceLine || "",
  }
}

function Stars({ rating }) {
  const full = Number(rating) || 0
  return (
    <span style={{ color: "#f5a623", letterSpacing: "1px" }}>
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
    </span>
  )
}

export default function Reviews() {
  const { profile } = useAuth()
  const [serviceLines, setServiceLines] = useState([])
  const [reviews, setReviews] = useState([])
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
    await loadReviews()
    setLoading(false)
  }

  async function loadReviews() {
    const res = await supabase
      .from("reviews")
      .select("id, client_name, rating, comment, is_published, service_line_id, service_line:service_lines(name), created_at")
      .order("created_at", { ascending: false })
    setReviews(res.data || [])
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

    if (!form.client_name || !form.comment) {
      setMessage({ type: "error", text: "Jaza jina la mteja na maoni" })
      return
    }

    setBusy(true)
    const res = await supabase.from("reviews").insert({
      client_name: form.client_name,
      rating: Number(form.rating) || 5,
      comment: form.comment,
      service_line_id: form.service_line_id || null,
      created_by: profile.id,
    })
    setBusy(false)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: "Maoni yameongezwa" })
    setForm(emptyForm(form.service_line_id))
    setShowForm(false)
    await loadReviews()
  }

  async function togglePublished(review) {
    setMessage(null)
    const res = await supabase.from("reviews").update({ is_published: !review.is_published }).eq("id", review.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    await loadReviews()
  }

  async function deleteReview(review) {
    const confirmed = window.confirm("Una hakika unataka kufuta maoni ya '" + review.client_name + "'?")
    if (!confirmed) {
      return
    }
    setMessage(null)
    const res = await supabase.from("reviews").delete().eq("id", review.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    setMessage({ type: "success", text: "Maoni yamefutwa" })
    await loadReviews()
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
          <p className="panel-title">Reviews & Ratings (Maoni ya Wateja)</p>
          <div className="header-buttons">
            <button className="btn-approve" onClick={function () { setShowForm(!showForm) }}>
              {showForm ? "Funga fomu" : "Ongeza maoni"}
            </button>
          </div>
        </div>

        {showForm ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Jina la Mteja
                <input type="text" placeholder="mfano: Mr&Mrs Christopher" value={form.client_name} onChange={function (e) { updateField("client_name", e.target.value) }} />
              </label>
              <label>
                Huduma
                <select value={form.service_line_id} onChange={function (e) { updateField("service_line_id", e.target.value) }}>
                  {serviceLines.map(function (sl) {
                    return <option key={sl.id} value={sl.id}>{sl.name}</option>
                  })}
                </select>
              </label>
            </div>

            <label>
              Nyota (Rating)
              <select value={form.rating} onChange={function (e) { updateField("rating", e.target.value) }}>
                <option value="5">★★★★★ (5)</option>
                <option value="4">★★★★☆ (4)</option>
                <option value="3">★★★☆☆ (3)</option>
                <option value="2">★★☆☆☆ (2)</option>
                <option value="1">★☆☆☆☆ (1)</option>
              </select>
            </label>

            <label className="full-width">
              Maoni
              <input type="text" placeholder="andika maoni ya mteja hapa" value={form.comment} onChange={function (e) { updateField("comment", e.target.value) }} />
            </label>

            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? "Inaongeza..." : "Hifadhi maoni"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <p className="panel-title">Maoni Yote</p>
        {reviews.length === 0 ? (
          <p className="panel-empty">Hakuna maoni yaliyoongezwa bado.</p>
        ) : (
          <div className="row-list">
            {reviews.map(function (r) {
              return (
                <div className="row-item expense-row" key={r.id}>
                  <div>
                    <p className="row-title">
                      {r.client_name} &mdash; <Stars rating={r.rating} />
                    </p>
                    <p className="row-sub">
                      {r.service_line ? r.service_line.name : ""} · "{r.comment}"
                    </p>
                  </div>
                  <div className="expense-actions">
                    <span className={"badge " + (r.is_published ? "badge-paid" : "badge-pending")}>
                      {r.is_published ? "Imechapishwa" : "Faragha"}
                    </span>
                    <button className="btn-cancel" onClick={function () { togglePublished(r) }}>
                      {r.is_published ? "Ficha" : "Chapisha"}
                    </button>
                    <button className="btn-cancel" style={{ color: "#b3261e" }} onClick={function () { deleteReview(r) }}>
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
