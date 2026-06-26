import { useState } from "react"
import { supabase } from "../lib/supabase"

const TONES = [
  { key: "professional", label: "Professional" },
  { key: "luxury", label: "Luxury" },
  { key: "friendly", label: "Friendly" },
]

export default function YuccaAIRefine({ text, onRefined }) {
  const [busyTone, setBusyTone] = useState(null)
  const [error, setError] = useState(null)

  async function refine(tone) {
    if (!text || !text.trim()) {
      setError("Andika maneno kwanza kabla ya kuboresha")
      return
    }

    setBusyTone(tone)
    setError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    try {
      const res = await fetch("/api/refine-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ text, tone }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Imeshindwa kuboresha maandishi")
      } else {
        onRefined(data.refined_text)
      }
    } catch (err) {
      setError("Tatizo la mtandao, jaribu tena")
    }

    setBusyTone(null)
  }

  return (
    <div style={{ marginTop: "6px", marginBottom: "16px" }}>
      <span className="row-sub" style={{ marginRight: "8px" }}>✨ AI Refine:</span>
      {TONES.map(function (t) {
        return (
          <button
            key={t.key}
            type="button"
            className="btn-cancel"
            style={{ marginRight: "6px", fontSize: "12px", padding: "4px 10px" }}
            disabled={busyTone !== null}
            onClick={function () { refine(t.key) }}
          >
            {busyTone === t.key ? "Inaboresha..." : t.label}
          </button>
        )
      })}
      {error ? <p className="login-error" style={{ marginTop: "6px" }}>{error}</p> : null}
    </div>
  )
}
