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
import Payroll from "./pages/Payroll"
import Stock from "./pages/Stock"
import Reports from "./pages/Reports"
import PriceLists from "./pages/PriceLists"
import Vouchers from "./pages/Vouchers"
import Reviews from "./pages/Reviews"
import Blogs from "./pages/Blogs"

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
          <Route
            path="/payroll"
            element={
              <ProtectedRoute allow={["hr", "fao", "md", "admin"]}>
                <DashboardLayout>
                  <Payroll />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock"
            element={
              <ProtectedRoute allow={["supervisor", "md", "admin"]}>
                <DashboardLayout>
                  <Stock />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allow={["fao", "md", "admin"]}>
                <DashboardLayout>
                  <Reports />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/price-lists"
            element={
              <ProtectedRoute allow={["fao", "md", "admin"]}>
                <DashboardLayout>
                  <PriceLists />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vouchers"
            element={
              <ProtectedRoute allow={["fao", "md", "admin"]}>
                <DashboardLayout>
                  <Vouchers />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviews"
            element={
              <ProtectedRoute allow={["fao", "md", "admin"]}>
                <DashboardLayout>
                  <Reviews />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/blogs"
            element={
              <ProtectedRoute allow={["fao", "md", "admin"]}>
                <DashboardLayout>
                  <Blogs />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
