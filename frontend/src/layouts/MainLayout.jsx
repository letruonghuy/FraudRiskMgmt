import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';

export default function MainLayout({ children }) {
  const { role } = useAuth();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <Sidebar role={role} />

      <div className="content-shell">
        <Header />
        <main className="page-content" id="main-content">{children}</main>
      </div>
    </div>
  );
}
