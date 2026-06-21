import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, allow }) {
  const { session, profile, role, loading } = useAuth()

  if (loading) {
    return <div className="page-loading">Inapakia...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <div className="page-loading">Tatizo: profile haipo. Wasiliana na Admin.</div>
  }

  if (allow && !allow.includes(role)) {
    return <div className="page-loading">Huna ruhusa ya kuona ukurasa huu.</div>
  }

  return children
}
