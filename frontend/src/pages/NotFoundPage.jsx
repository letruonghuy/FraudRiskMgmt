import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getHomePath } from '../contexts/authUtils';

export default function NotFoundPage() {
  const { isAuthenticated, role } = useAuth();
  const homePath = isAuthenticated ? getHomePath(role) : '/login';

  return (
    <main className="page-content">
      <div className="alert-detail-state">
        <Compass size={28} aria-hidden="true" />
        <h1>Không tìm thấy trang</h1>
        <p>Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển.</p>
        <div className="alert-detail-state-actions">
          <Link className="detail-back-link" to={homePath}>
            {isAuthenticated ? 'Về trang chủ' : 'Về trang đăng nhập'}
          </Link>
        </div>
      </div>
    </main>
  );
}