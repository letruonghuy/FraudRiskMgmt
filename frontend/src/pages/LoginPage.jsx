import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import bannerImg from '../assets/banner.png';
import { CircleAlert, Eye, EyeOff, Mail, Lock, ShieldCheck } from 'lucide-react';
import logoImg from '../assets/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { getHomePath, getSafeRedirect } from '../contexts/authUtils';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, role } = useAuth();

  // Trang người dùng định vào trước khi bị chuyển sang đăng nhập (từ PrivateRoute hoặc từ interceptor 401)
  const params = new URLSearchParams(location.search);
  const fromState = location.state?.from;
  const redirectTo = getSafeRedirect(
    fromState ? `${fromState.pathname}${fromState.search || ''}` : params.get('from')
  );
  const sessionExpired = params.get('reason') === 'expired';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(sessionExpired ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' : '');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo || getHomePath(role), { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo, role]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await axiosClient.post('/Auth/login', { email: email.trim(), password });
      const payload = res.data.data || res.data;
      const { token, role: userRole, fullName, userId } = payload;

      if (!token) {
        setError('Máy chủ không trả về phiên đăng nhập hợp lệ.');
        return;
      }

      // Việc chuyển trang do useEffect ở trên đảm nhiệm (một nơi duy nhất, có tôn trọng trang cũ)
      login({ token, role: userRole, fullName, userId });
    } catch (err) {
      if (!err.response) {
        setError('Không kết nối được máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau.');
      } else if (err.response.status === 401) {
        setError(err.response.data?.message || 'Email hoặc mật khẩu không đúng');
      } else if (err.response.status === 429) {
        setError('Bạn thử đăng nhập quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.');
      } else {
        setError(err.response.data?.message || 'Đăng nhập thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: '100%',
    padding: '14px 16px 14px 48px',
    backgroundColor: '#111827',
    border: `1.5px solid ${focusedField === field ? '#3b82f6' : '#1f2d47'}`,
    borderRadius: '12px',
    color: '#f1f5f9',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
  });

  return (
    <>
      <style>{`
        .login-page { min-height: 100dvh; color: var(--text); font-family: inherit; }
        .login-page input::placeholder { color: #94a3b8; }
        .login-page input::-ms-reveal,
        .login-page input::-ms-clear { display: none; }
        .login-page input:-webkit-autofill,
        .login-page input:-webkit-autofill:hover,
        .login-page input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 30px #111827 inset !important;
          -webkit-text-fill-color: #f1f5f9 !important;
          transition: background-color 9999s ease-in-out 0s;
        }
        .login-btn:hover:not(:disabled) { background-color: #1d4ed8 !important; }
        .login-page button:focus-visible {
          outline: 2px solid #fbbf24;
          outline-offset: 3px;
        }
        .login-page .login-spinner { animation: login-spin 0.8s linear infinite; }
        @keyframes login-spin { to { transform: rotate(360deg); } }

        .login-wrapper {
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg);
          background-image:
            linear-gradient(rgba(148, 163, 184, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.025) 1px, transparent 1px);
          background-size: 32px 32px;
          padding: 32px 20px;
        }

        .login-card {
          display: flex;
          flex-direction: row;
          width: 100%;
          max-width: 1080px;
          min-height: 640px;
          background: #0d1526;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.55);
          position: relative;
        }

        .login-banner {
          flex: 0 0 45%;
          width: 45%;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 40px;
        }

        .login-form-col {
          flex: 0 0 55%;
          width: 55%;
          background: var(--bg-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 52px;
          position: relative;
          overflow: hidden;
        }

        /* Decor họa tiết chấm tròn */
        .login-form-col::before {
          content: '';
          position: absolute;
          top: -100px; right: -80px;
          width: 300px; height: 300px;
          border-radius: 50%;
          background: #101d40;
          pointer-events: none;
        }
        .login-form-col::after {
          content: '';
          position: absolute;
          bottom: -80px; right: 100px;
          width: 200px; height: 200px;
          border-radius: 50%;
          background: #101d40;
          pointer-events: none;
        }
        .dot-extra {
          position: absolute;
          bottom: 40px; right: -40px;
          width: 140px; height: 140px;
          border-radius: 50%;
          background: #0e1a38;
          pointer-events: none;
        }

        .login-banner-copy { max-width: 390px; position: relative; z-index: 2; }
        .login-banner-copy h1 { margin: 0 0 14px; color: #fff; font-size: 32px; line-height: 1.2; }
        .login-banner-copy p { margin: 0; color: #e2e8f0; font-size: 15px; line-height: 1.6; }
        .login-form-content { width: 100%; max-width: 400px; position: relative; z-index: 1; }
        .password-toggle {
          position: absolute;
          top: 50%;
          right: 4px;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
        }
        .login-footer { color: #cbd5e1; font-size: 13px; }
        .login-footer-icon { color: #fbbf24; flex-shrink: 0; }

        @media (max-width: 868px) {
          .login-wrapper { padding: 16px; }
          .login-card {
            flex-direction: column;
            max-width: 460px;
            min-height: auto;
            border-radius: 16px;
          }
          .login-banner {
            width: 100%;
            flex: none;
            gap: 28px;
            padding: 24px;
          }
          .login-banner-copy h1 { font-size: 24px; }
          .login-banner-copy p { font-size: 14px; }
          .login-form-col {
            width: 100%;
            flex: none;
            padding: 28px 24px 32px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-page *,
          .login-page *::before,
          .login-page *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <main className="login-page">
        <div className="login-wrapper">
        <div className="login-card">
          <div className="login-banner">
            <img
              src={bannerImg}
              alt=""
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', zIndex: 0,
              }}
            />
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: 'linear-gradient(160deg, rgba(5,15,40,0.78) 0%, rgba(5,15,40,0.58) 60%, rgba(5,15,40,0.82) 100%)',
            }} />

            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={logoImg}
                alt="FraudRiskMgmt Logo"
                style={{
                  width: 54,
                  height: 54,
                  objectFit: 'contain',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                }}
              />
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '0.3px' }}>
                  Fraud<span style={{ color: '#f59e0b' }}>Risk</span>Mgmt
                </div>
                <div style={{ color: '#cbd5e1', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  Hệ thống nội bộ
                </div>
              </div>
            </div>

            {/* <div className="login-banner-copy">
              <h1>Quản lý rủi ro <span style={{ color: '#fbbf24' }}>gian lận</span></h1>
              <p>Phát hiện rủi ro giao dịch, hỗ trợ điều tra viên và quản lý theo dõi, xử lý cảnh báo.</p>
            </div> */}
          </div>

          <div className="login-form-col">
            <div className="dot-extra" />
            <div className="login-form-content">

              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{
                  color: '#f1f5f9', fontSize: 28, fontWeight: 700,
                  margin: '0 0 6px', letterSpacing: -0.5,
                }}>
                  Chào mừng trở lại
                </h2>
                <p style={{ color: '#cbd5e1', fontSize: 15, margin: 0, lineHeight: 1.5 }}>
                  Đăng nhập để vào hệ thống quản lý rủi ro
                </p>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 10, padding: '10px 14px',
                  color: '#fecaca', fontSize: 14,
                  marginBottom: 18,
                  display: 'flex', alignItems: 'center', gap: 8,
                }} role="alert" aria-live="assertive">
                  <CircleAlert size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                {/* Email */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block', color: '#94a3b8',
                    fontSize: 13.5, fontWeight: 500, marginBottom: 8,
                  }} htmlFor="login-email">
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{
                      position: 'absolute', left: 16, top: '50%',
                      transform: 'translateY(-50%)',
                      color: focusedField === 'email' ? '#3b82f6' : '#475569',
                      pointerEvents: 'none', transition: 'color 0.2s',
                    }} />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="officer@bank.com"
                      required
                      style={inputStyle('email')}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{
                    display: 'block', color: '#94a3b8',
                    fontSize: 13.5, fontWeight: 500, marginBottom: 8,
                  }} htmlFor="login-password">
                    Mật khẩu
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{
                      position: 'absolute', left: 16, top: '50%',
                      transform: 'translateY(-50%)',
                      color: focusedField === 'password' ? '#3b82f6' : '#475569',
                      pointerEvents: 'none', transition: 'color 0.2s',
                    }} />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      required
                      style={{ ...inputStyle('password'), paddingRight: 48 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      aria-pressed={showPassword}
                      className="password-toggle"
                      style={{
                        color: focusedField === 'password' ? '#fbbf24' : '#cbd5e1',
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="login-btn"
                  aria-busy={loading}
                  style={{
                    width: '100%', padding: '14px',
                    background: loading ? '#1e3a5f' : '#2563eb',
                    color: '#fff', border: 'none',
                    borderRadius: 8, fontSize: 16, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.18s ease',
                    letterSpacing: 0.2, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {loading && (
                    <svg className="login-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  )}
                  {loading ? 'Đang xác thực…' : 'Đăng nhập'}
                </button>
              </form>

              {/* Footer */}
              <div style={{
                marginTop: 24, paddingTop: 18,
                borderTop: '1px solid #1e293b',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
              }} className="login-footer">
                <ShieldCheck size={16} className="login-footer-icon" aria-hidden="true" />
                <span>Đăng nhập dành cho nhân sự được cấp quyền</span>
              </div>
            </div>
          </div>

        </div>
        </div>
      </main>
    </>
  );
}