import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './DashboardLayout.css'

const NAV_BY_ROLE = {
  md: [
    { to: '/', label: 'Muhtasari', icon: 'home' },
    { to: '/expenses', label: 'Maombi ya Fedha', icon: 'cash' },
    { to: '/invoices', label: 'Invoices', icon: 'file' },
    { to: '/payroll', label: 'Payroll', icon: 'users' },
    { to: '/stock', label: 'Stock', icon: 'box' },
    { to: '/reports', label: 'Ripoti', icon: 'chart' },
    { to: '/users', label: 'Wafanyakazi', icon: 'people' },
  ],
  fao: [
    { to: '/', label: 'Muhtasari', icon: 'home' },
    { to: '/expenses', label: 'Maombi ya Fedha', icon: 'cash' },
    { to: '/invoices', label: 'Invoices', icon: 'file' },
    { to: '/income', label: 'Mapato', icon: 'trend' },
    { to: '/reports', label: 'Ripoti', icon: 'chart' },
  ],
  hr: [
    { to: '/', label: 'Muhtasari', icon: 'home' },
    { to: '/payroll', label: 'Payroll', icon: 'users' },
    { to: '/employees', label: 'Wafanyakazi', icon: 'people' },
  ],
  supervisor: [
    { to: '/', label: 'Muhtasari', icon: 'home' },
    { to: '/expenses', label: 'Maombi ya Fedha', icon: 'cash' },
    { to: '/stock', label: 'Stock', icon: 'box' },
  ],
  employee: [
    { to: '/', label: 'Maombi Yangu', icon: 'cash' },
  ],
}

const ROLE_LABELS = {
  md: 'Managing Director',
  fao: 'Finance & Accounts Officer',
  hr: 'Human Resource',
  supervisor: 'Supervisor',
  employee: 'Mfanyakazi',
}

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  cash: 'M3 7h18v10H3zM7 12h0.01M21 9V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  users: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  chart: 'M3 3v18h18M9 17V9M14 17V5M19 17v-3',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
}

function NavIcon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={ICONS[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DashboardLayout({ children }) {
  const { profile, role, logout } = useAuth()
  const navigate = useNavigate()
  const navItems = NAV_BY_ROLE[role] ?? []
  const initials = (profile?.full_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <img src="/logo.png" alt="AJ PLUS" className="dash-brand-logo" />
          <span>AJ PLUS</span>
        </div>

        <nav className="dash-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 'dash-nav-link' + (isActive ? ' active' : '')}
              end={item.to === '/'}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="dash-logout" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Toka</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-user">
            <div className="dash-avatar">{initials}</div>
            <div>
              <p className="dash-user-name">{profile?.full_name}</p>
              <p className="dash-user-role">{ROLE_LABELS[role] ?? role}</p>
            </div>
          </div>
        </header>
        <main className="dash-content">{children}</main>
      </div>
    </div>
  )
}
