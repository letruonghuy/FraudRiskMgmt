import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ListFilter, ShieldAlert, BriefcaseBusiness } from 'lucide-react';

const getNavItems = (role) => {
  const items = [
    { label: 'Alerts', to: '/alerts', icon: ListFilter, allowed: ['Officer', 'Manager'] },
    { label: 'Cases', to: '/cases', icon: BriefcaseBusiness, allowed: ['Officer', 'Manager'] },
  ];

  if (role === 'Manager') {
    items.unshift({ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, allowed: ['Manager'] });
  }

  return items;
};

export default function Sidebar({ role }) {
  const navItems = getNavItems(role);

  return (
    <aside className="sidebar">
      <div className="brand-box">
        <div className="brand-mark">FR</div>
        <div>
          <p className="brand-name">FraudRisk</p>
          <span className="brand-subtitle">Management</span>
        </div>
      </div>

      <nav className="nav-menu">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="mini-card">
          <ShieldAlert size={16} />
          <span>Risk Workflow</span>
        </div>
        <div className="mini-card soft">
          <BriefcaseBusiness size={16} />
          <span>{role || 'User'}</span>
        </div>
      </div>
    </aside>
  );
}
