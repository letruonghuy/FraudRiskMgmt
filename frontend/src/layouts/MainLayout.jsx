import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';

export default function MainLayout({ children }) {
  const { role } = useAuth();

  return (
    <div className="app-shell">
      <Sidebar role={role} />

      <div className="content-shell">
        <Header />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
