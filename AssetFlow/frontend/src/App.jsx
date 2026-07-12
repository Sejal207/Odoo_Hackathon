import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/context/AuthContext';
import ProtectedRoute from './middlewares/ProtectedRoute';
import GuestRoute from './middlewares/GuestRoute';
import AppLayout from './components/layout/AppLayout';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import DashboardScreen from './screens/dashboard/DashboardScreen';
import AssetsScreen from './screens/assets/AssetsScreen';
import OrganizationSetupScreen from './screens/organization/OrganizationSetupScreen';

function ComingSoon({ label }) {
  return <div className="p-8 text-[#061E29]">{label} screen coming soon</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterScreen />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardScreen />} />
              <Route path="/organization-setup" element={<OrganizationSetupScreen />} />
              <Route path="/assets" element={<AssetsScreen />} />
              <Route path="/allocations" element={<ComingSoon label="Allocation & Transfer" />} />
              <Route path="/bookings" element={<ComingSoon label="Resource Booking" />} />
              <Route path="/maintenance" element={<ComingSoon label="Maintenance" />} />
              <Route path="/audits" element={<ComingSoon label="Audit" />} />
              <Route path="/reports" element={<ComingSoon label="Reports" />} />
              <Route path="/notifications" element={<ComingSoon label="Notifications" />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}