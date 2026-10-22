// /* eslint-disable react-refresh/only-export-components */
// import { createContext, useContext, useMemo, useState } from 'react';

// const AuthContext = createContext(null);

// const readStoredUser = () => {
//   try {
//     const token = localStorage.getItem('token');
//     const role = localStorage.getItem('role');
//     const fullName = localStorage.getItem('fullName');
//     const userId = localStorage.getItem('userId');

//     if (!token) return null;

//     return {
//       token,
//       role,
//       fullName,
//       userId,
//     };
//   } catch {
//     return null;
//   }
// };

// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(readStoredUser);

//   const login = (userData) => {
//     const normalizedUser = {
//       token: userData?.token || '',
//       role: userData?.role || '',
//       fullName: userData?.fullName || userData?.name || 'User',
//       userId: userData?.userId || userData?.id || null,
//     };

//     if (normalizedUser.token) {
//       localStorage.setItem('token', normalizedUser.token);
//       localStorage.setItem('role', normalizedUser.role);
//       localStorage.setItem('fullName', normalizedUser.fullName);
//       localStorage.setItem('userId', String(normalizedUser.userId ?? ''));
//     }

//     setUser(normalizedUser);
//     return normalizedUser;
//   };

//   const logout = () => {
//     localStorage.clear();
//     setUser(null);
//   };

//   const value = useMemo(
//     () => ({
//       user,
//       token: user?.token || null,
//       role: user?.role || null,
//       isAuthenticated: Boolean(user?.token),
//       login,
//       logout,
//     }),
//     [user]
//   );

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// }

// export function useAuth() {
//   const context = useContext(AuthContext);

//   if (!context) {
//     throw new Error('useAuth must be used within AuthProvider');
//   }

//   return context;
// }

/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearStoredAuth, isTokenExpired } from './authUtils';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const token = localStorage.getItem('token');

    if (!token) return null;

    // Token đã hết hạn thì bỏ luôn, tránh hiện giao diện "đã đăng nhập" rồi mới bị 401
    if (isTokenExpired(token)) {
      clearStoredAuth();
      return null;
    }

    return {
      token,
      role: localStorage.getItem('role'),
      fullName: localStorage.getItem('fullName'),
      userId: localStorage.getItem('userId'),
    };
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  // Đăng xuất / đăng nhập ở tab khác thì tab này cập nhật theo
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === null || event.key === 'token') {
        setUser(readStoredUser());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback((userData) => {
    const normalizedUser = {
      token: userData?.token || '',
      role: userData?.role || '',
      fullName: userData?.fullName || userData?.name || 'User',
      userId: userData?.userId || userData?.id || null,
    };

    if (normalizedUser.token) {
      localStorage.setItem('token', normalizedUser.token);
      localStorage.setItem('role', normalizedUser.role);
      localStorage.setItem('fullName', normalizedUser.fullName);
      localStorage.setItem('userId', String(normalizedUser.userId ?? ''));
    }

    setUser(normalizedUser);
    return normalizedUser;
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token: user?.token || null,
      role: user?.role || null,
      isAuthenticated: Boolean(user?.token),
      login,
      logout,
    }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}