import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./contexts/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import DashboardLayout from "./components/DashboardLayout"
import Login from "./pages/Login"
import Home from "./pages/Home"
import UserManagement from "./pages/UserManagement"
import Income from "./pages/Income"
import ExpenseRequests from "./pages/ExpenseRequests"
import Invoices from "./pages/Invoices"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute allow={["md", "admin"]}>
                <DashboardLayout>
                  <UserManagement />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/income"
            element={
              <ProtectedRoute allow={["fao", "md", "admin"]}>
                <DashboardLayout>
                  <Income />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute allow={["employee", "supervisor", "fao", "md", "admin"]}>
                <DashboardLayout>
                  <ExpenseRequests />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute allow={["fao", "md", "admin", "supervisor"]}>
                <DashboardLayout>
                  <Invoices />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
