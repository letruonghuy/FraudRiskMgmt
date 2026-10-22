import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ListFilter, BriefcaseBusiness } from 'lucide-react';
import logoImg from '../assets/logo.png';

const getNavItems = (role) => {
  const items = [
    { label: 'Cảnh báo', to: '/alerts', icon: ListFilter },
    { label: 'Hồ sơ điều tra', to: '/cases', icon: BriefcaseBusiness },
  ];

  if (role === 'Manager') {
    items.unshift({ label: 'Tổng quan', to: '/dashboard', icon: LayoutDashboard });
  }

  return items;
};

export default function Sidebar({ role }) {
  const navItems = getNavItems(role);

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
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
