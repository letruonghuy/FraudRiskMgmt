// import { Navigate } from 'react-router-dom';
// import { useAuth } from '../contexts/AuthContext';

// export default function PrivateRoute({ children, allowedRoles }) {
//   const { isAuthenticated, role } = useAuth();

//   if (!isAuthenticated) {
//     return <Navigate to="/login" replace />;
//   }

//   if (allowedRoles && !allowedRoles.includes(role)) {
//     return <Navigate to="/login" replace />;
//   }

//   return children;
// }

import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getHomePath } from '../contexts/authUtils';

function AccessDenied() {
  const { logout } = useAuth();

  return (
    <div className="alert-detail-state" role="alert">
      <ShieldAlert size={28} aria-hidden="true" />
      <h1>Không có quyền truy cập</h1>
      <p>Tài khoản của bạn chưa được cấp quyền sử dụng hệ thống. Vui lòng liên hệ quản trị viên.</p>
      <div className="alert-detail-state-actions">
        <button className="sort-toggle" type="button" onClick={logout}>Đăng xuất</button>
      </div>
    </div>
  );
}

export default function PrivateRoute({ children, allowedRoles }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Nhớ trang đang định vào để quay lại sau khi đăng nhập
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const home = getHomePath(role);

    // Role lạ (không phải Officer/Manager): trang chủ của họ cũng bị chặn → hiện thông báo thay vì lặp vô hạn
    if (location.pathname === home) return <AccessDenied />;

    // Đã đăng nhập nhưng sai quyền (vd: Officer vào /dashboard) → về trang chủ của họ, không đá ra login
    return <Navigate to={home} replace />;
  }

  return children;
}