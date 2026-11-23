import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness, ChevronDown, ClipboardCheck,
  LayoutDashboard, ListFilter, ScrollText, SlidersHorizontal, Users,
} from 'lucide-react';
import logoImg from '../assets/logo.png';

const OVERVIEW_SUBITEMS = [
  { label: 'Bảng điều khiển', to: '/dashboard', icon: LayoutDashboard, end: true },
  { label: 'Xử lý công việc', to: '/dashboard/tasks', icon: ClipboardCheck },
];

const ADMIN_NAV_ITEMS = [
  { label: 'Người dùng & Phân quyền', to: '/admin/users', icon: Users },
  { label: 'Cấu hình mô hình', to: '/admin/risk-config', icon: SlidersHorizontal },
  { label: 'Nhật ký kiểm toán', to: '/admin/audit-logs', icon: ScrollText },
];

export default function Sidebar({ role }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isOverviewActive = location.pathname.startsWith('/dashboard');
  const [overviewOpen, setOverviewOpen] = useState(isOverviewActive);

  useEffect(() => {
    if (isOverviewActive) {
      setOverviewOpen(true);
    }
  }, [isOverviewActive]);

  const handleOverviewToggle = () => {
    if (!isOverviewActive) {
      setOverviewOpen(true);
      navigate('/dashboard');
      return;
    }
    setOverviewOpen((prev) => !prev);
  };

  return (
    <aside className="sidebar" aria-label="Điều hướng chính">
      <div className="brand-box">
        <img className="brand-mark" src={logoImg} alt="" />
        <div>
          <p className="brand-name">FraudRiskMgmt</p>
          <span className="brand-subtitle">Quản lý rủi ro</span>
        </div>
      </div>

      <nav className="nav-menu" aria-label="Chính">
        {role === 'Admin' ? (
          ADMIN_NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))
        ) : (
          <>
            {role === 'Manager' && (
              <div className="nav-group">
                <button
                  type="button"
                  className={`nav-item nav-group-trigger ${isOverviewActive ? 'active' : ''}`}
                  aria-expanded={overviewOpen}
                  onClick={handleOverviewToggle}
                >
                  <LayoutDashboard size={18} aria-hidden="true" />
                  <span>Tổng quan</span>
                  <ChevronDown
                    size={15}
                    className={`nav-group-chevron ${overviewOpen ? 'open' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {overviewOpen && (
                  <div className="nav-sublist" role="group" aria-label="Mục con Tổng quan">
                    {OVERVIEW_SUBITEMS.map(({ label, to, icon: Icon, end }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) => `nav-subitem ${isActive ? 'active' : ''}`}
                      >
                        <Icon size={15} aria-hidden="true" />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}

            <NavLink
              to="/alerts"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <ListFilter size={18} aria-hidden="true" />
              <span>Cảnh báo</span>
            </NavLink>

            <NavLink
              to="/cases"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <BriefcaseBusiness size={18} aria-hidden="true" />
              <span>Hồ sơ điều tra</span>
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}