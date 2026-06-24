import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../contexts/AuthContext"

function emptyForm() {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    cover_image_url: "",
    author: "",
  }
}

function slugify(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export default function Blogs() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    loadPosts()
  }, [])

  async function loadPosts() {
    const res = await supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, content, cover_image_url, author, is_published, created_at")
      .order("created_at", { ascending: false })
    setPosts(res.data || [])
    setLoading(false)
  }

  function updateField(field, value) {
    setForm(function (f) {
      const copy = Object.assign({}, f)
      copy[field] = value
      if (field === "title" && !slugTouched) {
        copy.slug = slugify(value)
      }
      if (field === "slug") {
        setSlugTouched(true)
        copy.slug = slugify(value)
      }
      return copy
    })
  }

  function startCreate() {
    setEditingId(null)
    setSlugTouched(false)
    setForm(emptyForm())
    setMessage(null)
    setShowForm(true)
  }

  function startEdit(post) {
    setEditingId(post.id)
    setSlugTouched(true)
    setForm({
      title: post.title || "",
      slug: post.slug || "",
      excerpt: post.excerpt || "",
      content: post.content || "",
      cover_image_url: post.cover_image_url || "",
      author: post.author || "",
    })
    setMessage(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (!form.title || !form.slug || !form.content) {
      setMessage({ type: "error", text: "Jaza kichwa, slug, na maudhui ya chapisho" })
      return
    }

    setBusy(true)

    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt || null,
      content: form.content,
      cover_image_url: form.cover_image_url || null,
      author: form.author || null,
    }

    let res
    if (editingId) {
      res = await supabase.from("blog_posts").update(payload).eq("id", editingId)
    } else {
      res = await supabase.from("blog_posts").insert(Object.assign({}, payload, { created_by: profile.id }))
    }

    setBusy(false)

    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }

    setMessage({ type: "success", text: editingId ? "Chapisho limesasishwa" : "Chapisho limeongezwa" })
    cancelForm()
    await loadPosts()
  }

  async function togglePublished(post) {
    setMessage(null)
    const res = await supabase.from("blog_posts").update({ is_published: !post.is_published }).eq("id", post.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    await loadPosts()
  }

  async function deletePost(post) {
    const confirmed = window.confirm("Una hakika unataka kufuta chapisho '" + post.title + "'?")
    if (!confirmed) {
      return
    }
    setMessage(null)
    const res = await supabase.from("blog_posts").delete().eq("id", post.id)
    if (res.error) {
      setMessage({ type: "error", text: res.error.message })
      return
    }
    setMessage({ type: "success", text: "Chapisho limefutwa" })
    await loadPosts()
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
          <p className="panel-title">Blogs (Makala za Tovuti)</p>
          <div className="header-buttons">
            <button className="btn-approve" onClick={function () { showForm ? cancelForm() : startCreate() }}>
              {showForm ? "Funga fomu" : "Ongeza chapisho"}
            </button>
          </div>
        </div>

        {showForm ? (
          <form className="income-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Kichwa la Habari (Title)
                <input type="text" placeholder="mfano: Why Manned Guarding Still Matters" value={form.title} onChange={function (e) { updateField("title", e.target.value) }} />
              </label>
              <label>
                Slug (URL)
                <input type="text" placeholder="why-manned-guarding-still-matters" value={form.slug} onChange={function (e) { updateField("slug", e.target.value) }} />
              </label>
            </div>

            <div className="form-row">
              <label>
                Mwandishi (Author)
                <input type="text" placeholder="mfano: AJ Plus Team" value={form.author} onChange={function (e) { updateField("author", e.target.value) }} />
              </label>
              <label>
                Picha ya Jalada (Cover Image URL)
                <input type="text" placeholder="https://...jpg" value={form.cover_image_url} onChange={function (e) { updateField("cover_image_url", e.target.value) }} />
              </label>
            </div>

            <label className="full-width">
              Muhtasari Mfupi (Excerpt)
              <input type="text" placeholder="sentensi 1-2 zinazoonekana kwenye orodha ya blogs" value={form.excerpt} onChange={function (e) { updateField("excerpt", e.target.value) }} />
            </label>

            <label className="full-width">
              Maudhui Kamili (Content)
              <textarea placeholder="Andika makala nzima hapa. Unaweza kutumia &lt;p&gt;, &lt;h2&gt;, &lt;strong&gt; n.k. kwa muundo." value={form.content} onChange={function (e) { updateField("content", e.target.value) }} />
            </label>

            <button className="btn-approve submit-income" disabled={busy}>
              {busy ? "Inahifadhi..." : editingId ? "Sasisha chapisho" : "Hifadhi chapisho"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel">
        <p className="panel-title">Machapisho Yote</p>
        {posts.length === 0 ? (
          <p className="panel-empty">Hakuna chapisho lililoongezwa bado.</p>
        ) : (
          <div className="row-list">
            {posts.map(function (p) {
              return (
                <div className="row-item expense-row" key={p.id}>
                  <div>
                    <p className="row-title">{p.title}</p>
                    <p className="row-sub">
                      /blogs/post?slug={p.slug} {p.author ? "· " + p.author : ""}
                    </p>
                  </div>
                  <div className="expense-actions">
                    <span className={"badge " + (p.is_published ? "badge-paid" : "badge-pending")}>
                      {p.is_published ? "Imechapishwa" : "Faragha"}
                    </span>
                    <button className="btn-cancel" onClick={function () { startEdit(p) }}>
                      Hariri
                    </button>
                    <button className="btn-cancel" onClick={function () { togglePublished(p) }}>
                      {p.is_published ? "Ficha" : "Chapisha"}
                    </button>
                    <button className="btn-cancel" style={{ color: "#b3261e" }} onClick={function () { deletePost(p) }}>
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
