import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AlertListPage from './pages/AlertListPage';
import CaseListPage from './pages/CaseListPage';
import DashboardPage from './pages/DashboardPage';
import PrivateRoute from './components/PrivateRoute';
import MainLayout from './layouts/MainLayout';
import { AuthProvider } from './contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/alerts"
            element={
              <PrivateRoute allowedRoles={['Officer', 'Manager']}>
                <MainLayout>
                  <AlertListPage />
                </MainLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/cases"
            element={
              <PrivateRoute allowedRoles={['Officer', 'Manager']}>
                <MainLayout>
                  <CaseListPage />
                </MainLayout>
              </PrivateRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute allowedRoles={['Manager']}>
                <MainLayout>
                  <DashboardPage />
                </MainLayout>
              </PrivateRoute>
            }
          />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
