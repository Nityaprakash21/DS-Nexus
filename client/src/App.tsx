import { Suspense, lazy } from 'react'
import { Toaster } from 'react-hot-toast'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './pages/Layout'
import Loading from './components/Loading'

// Route Lazy Loading for Optimized Code Splitting & Fast Initial Page Load
const LoginLanding = lazy(() => import('./pages/LoginLanding'))
const LoginForm = lazy(() => import('./components/LoginForm'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Departments = lazy(() => import('./pages/Departments'))
const Holidays = lazy(() => import('./pages/Holidays'))
const Incentives = lazy(() => import('./pages/Incentives'))
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'))
const Authorization = lazy(() => import('./pages/Authorization'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Leave = lazy(() => import('./pages/Leave'))
const Payslips = lazy(() => import('./pages/Payslips'))
const PrintPayslip = lazy(() => import('./pages/PrintPayslip'))
const KpaDashboard = lazy(() => import('./pages/KpaDashboard'))
const KpaScorecard = lazy(() => import('./pages/KpaScorecard'))
const Feedback = lazy(() => import('./pages/Feedback'))
const Settings = lazy(() => import('./pages/Settings'))

const App = () => {
  return (
    <>
      <Toaster />
      <Suspense fallback={<Loading fullScreen />}>
        <Routes>
          <Route path="/login" element={<LoginLanding />} />

          <Route
            path="/login/admin"
            element={
              <LoginForm
                role="admin"
                title="Admin Portal"
                subtitle="Sign in to manage the organization"
              />
            }
          />
          <Route
            path="/login/employee"
            element={
              <LoginForm
                role="employee"
                title="Employee Portal"
                subtitle="Sign in to access your profile and records"
              />
            }
          />

          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/holidays" element={<Holidays />} />
            <Route path="/incentives" element={<Incentives />} />
            <Route path="/activity-logs" element={<ActivityLogs />} />
            <Route path="/authorization" element={<Authorization />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/leave" element={<Leave />} />
            <Route path="/payslips" element={<Payslips />} />
            <Route path="/kpa" element={<KpaDashboard />} />
            <Route path="/kpa/scorecard" element={<KpaScorecard />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/print/payslips/:id" element={<PrintPayslip />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App