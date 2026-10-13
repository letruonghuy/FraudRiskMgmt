import { useState, useRef, useEffect } from 'react';
import { LogOut, UserCircle2, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Click ngoài dropdown thì đóng
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <div>
        {/* <p className="eyebrow">Fraud Risk Management</p>
        <h1>Monitoring Center</h1> */}
        <h2>Welcome back, {user?.fullName || 'User'}!👋</h2>
      </div>

      <div className="topbar-actions">
        {/* User dropdown */}
        <div ref={ref} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(148,163,184,0.18)',
              color: 'var(--text)',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
          >
            <UserCircle2 size={18} color="var(--text-soft)" />
            <div style={{ textAlign: 'left' }}>
              <strong style={{ display: 'block', fontSize: '0.875rem' }}>
                {user?.fullName || 'User'}
              </strong>
              <span style={{ display: 'block', color: 'var(--text-soft)', fontSize: '0.72rem' }}>
                {user?.role || 'Unknown role'}
              </span>
            </div>
            <ChevronDown
              size={15}
              color="var(--text-soft)"
              style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {/* Dropdown menu */}
          {open && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: '180px',
              background: 'var(--panel-strong)',
              border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow)',
              overflow: 'hidden',
              zIndex: 100,
            }}>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  color: '#fca5a5',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <LogOut size={15} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}