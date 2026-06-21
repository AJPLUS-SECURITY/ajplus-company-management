import { useAuth } from '../contexts/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import MdDashboard from '../dashboards/MdDashboard'
import FaoDashboard from '../dashboards/FaoDashboard'
import HrDashboard from '../dashboards/HrDashboard'
import SupervisorDashboard from '../dashboards/SupervisorDashboard'

const DASHBOARD_BY_ROLE = {
  md: MdDashboard,
  admin: MdDashboard,
  fao: FaoDashboard,
  hr: HrDashboard,
  supervisor: SupervisorDashboard,
}

export default function Home() {
  const { role } = useAuth()
  const Dashboard = DASHBOARD_BY_ROLE[role]

  return (
    <DashboardLayout>
      {Dashboard ? <Dashboard /> : <p className="panel-empty">Dashboard ya role hii bado haijaandaliwa.</p>}
    </DashboardLayout>
  )
}
