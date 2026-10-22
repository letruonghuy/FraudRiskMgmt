// import { useState, useRef, useEffect } from 'react';
// import { LogOut, UserCircle2, ChevronDown } from 'lucide-react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import { useAuth } from '../contexts/AuthContext';

// const ROLE_LABELS = {
//   Officer: 'Điều tra viên',
//   Manager: 'Quản lý',
// };

// const PAGE_CONTEXT = {
//   '/alerts': 'Vận hành cảnh báo',
//   '/cases': 'Quy trình điều tra',
//   '/dashboard': 'Tổng quan hệ thống',
// };

// export default function Header() {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();
//   const { pathname } = useLocation();
//   const [open, setOpen] = useState(false);
//   const ref = useRef(null);
//   const triggerRef = useRef(null);

//   useEffect(() => {
//     const handlePointerDown = (event) => {
//       if (ref.current && !ref.current.contains(event.target)) {
//         setOpen(false);
//       }
//     };

//     const handleKeyDown = (event) => {
//       if (event.key === 'Escape' && open) {
//         setOpen(false);
//         triggerRef.current?.focus();
//       }
//     };

//     document.addEventListener('pointerdown', handlePointerDown);
//     document.addEventListener('keydown', handleKeyDown);
//     return () => {
//       document.removeEventListener('pointerdown', handlePointerDown);
//       document.removeEventListener('keydown', handleKeyDown);
//     };
//   }, [open]);

//   const handleLogout = () => {
//     logout();
//     navigate('/login', { replace: true });
//   };

//   return (
//     <header className="topbar">
//       <p className="topbar-context">{PAGE_CONTEXT[pathname] || (pathname.startsWith('/alerts/') ? PAGE_CONTEXT['/alerts'] : 'Hệ thống nội bộ')}</p>
//       <div className="topbar-actions">
//         <div className="user-menu-container" ref={ref}>
//           <button
//             ref={triggerRef}
//             type="button"
//             onClick={() => setOpen(o => !o)}
//             className="user-menu-trigger"
//             aria-expanded={open}
//             aria-controls="user-menu-options"
//           >
//             <UserCircle2 size={18} aria-hidden="true" />
//             <div className="user-menu-identity">
//               <strong>
//                 {user?.fullName || 'Người dùng'}
//               </strong>
//               <span>
//                 {ROLE_LABELS[user?.role] || 'Người dùng'}
//               </span>
//             </div>
//             <ChevronDown
//               size={15}
//               className={`user-menu-chevron ${open ? 'open' : ''}`}
//               aria-hidden="true"
//             />
//           </button>

//           <div className="user-menu-popup" id="user-menu-options" hidden={!open}>
//               <button
//                 type="button"
//                 onClick={handleLogout}
//                 className="logout-button"
//               >
//                 <LogOut size={16} aria-hidden="true" />
//                 Đăng xuất
//               </button>
//           </div>
//         </div>
//       </div>
//     </header>
//   );
// }

import { useState, useRef, useEffect } from 'react';
import { LogOut, UserCircle2, ChevronDown } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ROLE_LABELS = {
  Officer: 'Điều tra viên',
  Manager: 'Quản lý',
};

const PAGE_CONTEXT = {
  '/alerts': 'Vận hành cảnh báo',
  '/cases': 'Quy trình điều tra',
  '/dashboard': 'Tổng quan hệ thống',
};

// Lấy tiêu đề theo đoạn đầu của đường dẫn: /alerts/5 → /alerts, /cases/3 → /cases
const getPageContext = (pathname) => PAGE_CONTEXT[`/${pathname.split('/')[1]}`] || 'Hệ thống nội bộ';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <p className="topbar-context">{getPageContext(pathname)}</p>
      <div className="topbar-actions">
        <div className="user-menu-container" ref={ref}>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(o => !o)}
            className="user-menu-trigger"
            aria-expanded={open}
            aria-controls="user-menu-options"
          >
            <UserCircle2 size={18} aria-hidden="true" />
            <div className="user-menu-identity">
              <strong>
                {user?.fullName || 'Người dùng'}
              </strong>
              <span>
                {ROLE_LABELS[user?.role] || 'Người dùng'}
              </span>
            </div>
            <ChevronDown
              size={15}
              className={`user-menu-chevron ${open ? 'open' : ''}`}
              aria-hidden="true"
            />
          </button>

          <div className="user-menu-popup" id="user-menu-options" hidden={!open}>
              <button
                type="button"
                onClick={handleLogout}
                className="logout-button"
              >
                <LogOut size={16} aria-hidden="true" />
                Đăng xuất
              </button>
          </div>
        </div>
      </div>
    </header>
  );
}