// Hàm dùng chung cho phần đăng nhập / phân quyền (không phải component nên tách khỏi AuthContext)

export const AUTH_KEYS = ['token', 'role', 'fullName', 'userId'];

// Trang chủ theo vai trò
export const getHomePath = (role) => (role === 'Manager' ? '/dashboard' : '/alerts');

// Chỉ cho phép quay lại đường dẫn nội bộ, tránh open redirect (vd: ?from=//evil.com)
export const getSafeRedirect = (path) => {
  if (typeof path !== 'string') return null;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  if (path === '/login' || path.startsWith('/login?')) return null;
  return path;
};

// Đọc thời điểm hết hạn (ms) từ claim `exp` của JWT; trả về null nếu không đọc được
export const getTokenExpiry = (token) => {
  try {
    const payload = String(token).split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
};

// Token không đọc được `exp` thì coi như còn hạn (để backend quyết định qua 401)
export const isTokenExpired = (token) => {
  const expiry = getTokenExpiry(token);
  return expiry !== null && expiry <= Date.now();
};

// Chỉ xóa các key thuộc phần đăng nhập, không đụng dữ liệu khác trong localStorage
export const clearStoredAuth = () => {
  try {
    AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư) — bỏ qua
  }
};