import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AlertListPage from './pages/AlertListPage';
import AlertDetailPage from './pages/AlertDetailPage';
import CaseListPage from './pages/CaseListPage';
import DashboardPage from './pages/DashboardPage';
import ManagerTasksPage from './pages/ManagerTasksPage';
import NotFoundPage from './pages/NotFoundPage';
import PrivateRoute from './components/PrivateRoute';
import MainLayout from './layouts/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getHomePath } from './contexts/authUtils';
import CaseDetailPage from './pages/CaseDetailPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminRiskConfigPage from './pages/AdminRiskConfigPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';

const ALL_ROLES = ['Officer', 'Manager'];

// Trang yêu cầu đăng nhập + đúng vai trò, hiển thị trong layout chính
function Protected({ roles = ALL_ROLES, children }) {
  return (
    <PrivateRoute allowedRoles={roles}>
      <MainLayout>{children}</MainLayout>
    </PrivateRoute>
  );
}

// "/" → trang chủ theo vai trò nếu đã đăng nhập, ngược lại về đăng nhập
function HomeRedirect() {
  const { isAuthenticated, role } = useAuth();
  return <Navigate to={isAuthenticated ? getHomePath(role) : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/alerts/:id" element={<Protected><AlertDetailPage /></Protected>} />
          <Route path="/alerts" element={<Protected><AlertListPage /></Protected>} />
          <Route path="/cases/:id" element={<Protected><CaseDetailPage /></Protected>} />
          <Route path="/cases" element={<Protected><CaseListPage /></Protected>} />
          <Route path="/dashboard" element={<Protected roles={['Manager']}><DashboardPage /></Protected>} />
          <Route path="/dashboard/tasks" element={<Protected roles={['Manager']}><ManagerTasksPage /></Protected>} />
          <Route path="/admin/users" element={<Protected roles={['Admin']}><AdminUsersPage /></Protected>} />
          <Route path="/admin/risk-config" element={<Protected roles={['Admin']}><AdminRiskConfigPage /></Protected>} />
          <Route path="/admin/audit-logs" element={<Protected roles={['Admin']}><AdminAuditLogsPage /></Protected>} />

          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}