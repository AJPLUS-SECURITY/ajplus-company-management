import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeUserId, setActiveUserId] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email, status, role:roles(name), service_line:service_lines(name)')
        .order('full_name', { ascending: true })
      setUsers(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function openReset(userId) {
    setActiveUserId(userId)
    setNewPassword('')
    setMessage(null)
  }

  function closeReset() {
    setActiveUserId(null)
    setNewPassword('')
  }

  async function submitReset(userId) {
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password lazima iwe na herufi 8 au zaidi' })
      return
    }
    setBusy(true)
    setMessage(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    try {
      const res = await fetch('/api/admin-reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_user_id: userId, new_password: newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Imeshindwa kubadilisha password' })
      } else {
        setMessage({ type: 'success', text: data.message })
        setActiveUserId(null)
        setNewPassword('')
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Tatizo la mtandao, jaribu tena' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="page-loading">Inapakia wafanyakazi...</div>

  return (
    <div>
      <div className="panel">
        <p className="panel-title">Wafanyakazi wote</p>
        {message && (
          <p className={message.type === 'error' ? 'login-error' : 'reset-success'}>
            {message.text}
          </p>
        )}
        <div className="row-list">
          {users.map((u) => (
            <div key={u.id} className="row-item user-row">
              <div>
                <p className="row-title">{u.full_name}</p>
                <p className="row-sub">
                  {u.email} · {u.role?.name}
                  {u.service_line?.name ? ` · ${u.service_line.name}` : ''}
                </p>
              </div>

              {activeUserId === u.id ? (
                <div className="reset-inline">
                  <input
                    type="password"
                    placeholder="Password mpya"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <button className="btn-approve" disabled={busy} onClick={() => submitReset(u.id)}>
                    {busy ? '...' : 'Hifadhi'}
                  </button>
                  <button className="btn-cancel" onClick={closeReset}>
                    Ghairi
                  </button>
                </div>
              ) : (
                <button className="btn-approve" onClick={() => openReset(u.id)}>
                  Badilisha password
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
