import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import bannerImg from '../assets/banner.png';
import { Eye, EyeOff, Mail, Lock, ShieldCheck } from 'lucide-react';
import logoImg from '../assets/logo.png';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, role } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(role === 'Manager' ? '/dashboard' : '/alerts', { replace: true });
    }
  }, [isAuthenticated, navigate, role]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axiosClient.post('/Auth/login', { email, password });
      const payload = res.data.data || res.data;
      const { token, role, fullName, userId } = payload;

      login({ token, role, fullName, userId });

      if (role === 'Manager') {
        navigate('/dashboard');
      } else {
        navigate('/alerts');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
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
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', -apple-system, sans-serif; }
        input::placeholder { color: #475569; }
        /* Keep only the custom Eye/EyeOff button; Edge adds its own reveal control. */
        input::-ms-reveal,
        input::-ms-clear { display: none; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 30px #111827 inset !important;
          -webkit-text-fill-color: #f1f5f9 !important;
          transition: background-color 9999s ease-in-out 0s;
        }
        .login-btn:hover:not(:disabled) { background-color: #1d4ed8 !important; }
        .login-btn:active:not(:disabled) { transform: scale(0.99); }

        /* Nền tổng bao ngoài toàn màn hình */
        .login-wrapper {
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #060b17;
          background-image: radial-gradient(circle at 50% 50%, #111d38 0%, #060b17 80%);
          padding: 32px 20px;
        }

        /* Khung Card nổi ở giữa (Floating Card) */
        .login-card {
          display: flex;
          flex-direction: row;
          width: 100%;
          max-width: 1080px;
          min-height: 640px;
          background: #0d1526;
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08);
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
          background: #0d1526;
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

        /* Responsive Mobile */
        @media (max-width: 868px) {
          .login-wrapper { padding: 16px; }
          .login-card {
            flex-direction: column;
            max-width: 460px;
            min-height: auto;
            border-radius: 20px;
          }
          .login-banner {
            width: 100%;
            flex: none;
            padding: 28px 24px;
          }
          .login-banner .banner-stats,
          .login-banner .banner-desc { display: none; }
          .login-form-col {
            width: 100%;
            flex: none;
            padding: 32px 24px 40px;
          }
        }
      `}</style>

      {/* ══ NỀN BAO NGOÀI ══ */}
      <div className="login-wrapper">

        {/* ══ KHUNG CARD NỔI BÊN TRONG ══ */}
        <div className="login-card">

          {/* Banner Trái */}
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
              background: 'linear-gradient(160deg, rgba(5,15,40,0.92) 0%, rgba(5,15,40,0.78) 60%, rgba(5,15,40,0.9) 100%)',
            }} />

            {/* Logo */}
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
                <div style={{ color: '#64748b', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Hệ thống nội bộ
                </div>
              </div>
            </div>

            {/* Headline */}
            {/* <div style={{ position: 'relative', zIndex: 2, margin: '24px 0' }}>
              <div style={{
                display: 'inline-block',
                background: 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 20, padding: '4px 12px',
                color: '#f59e0b', fontSize: 12, fontWeight: 600,
                marginBottom: 14, letterSpacing: 0.5,
              }}>
                ML-Powered Detection
              </div>
              <h1 style={{
                color: '#fff', fontSize: 28, fontWeight: 800,
                lineHeight: 1.25, margin: '0 0 12px',
              }}>
                Quản lý rủi ro<br />
                <span style={{ color: '#f59e0b' }}>gian lận</span> thông minh<br />
                tích hợp ML
              </h1>
              <p className="banner-desc" style={{
                color: '#94a3b8', fontSize: 13.5,
                lineHeight: 1.6, margin: 0, maxWidth: 320,
              }}>
                Phát hiện và xử lý gian lận giao dịch ngân hàng,
                hỗ trợ quy trình Maker-Checker theo chuẩn Basel.
              </p>
            </div> */}

            {/* Stats */}
            {/* <div className="banner-stats" style={{
              position: 'relative', zIndex: 2,
              display: 'flex', gap: 0,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              {[
                { value: '0.98',  label: 'Recall' },
                { value: '99.3%', label: 'ROC-AUC' },
                { value: '3',     label: 'Models so sánh' },
              ].map((stat, i) => (
                <div key={stat.label} style={{
                  flex: 1, padding: '12px 14px', textAlign: 'center',
                  borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}>
                  <div style={{ color: '#f59e0b', fontSize: 18, fontWeight: 700 }}>{stat.value}</div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div> */}
          </div>

          {/* Form Phải */}
          <div className="login-form-col">
            <div className="dot-extra" />
            <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>

              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{
                  color: '#f1f5f9', fontSize: 28, fontWeight: 700,
                  margin: '0 0 6px', letterSpacing: -0.5,
                }}>
                  Chào mừng trở lại
                </h2>
                <p style={{ color: '#64748b', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                  Đăng nhập để vào hệ thống quản lý rủi ro
                </p>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 10, padding: '10px 14px',
                  color: '#fca5a5', fontSize: 13,
                  marginBottom: 18,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} noValidate>
                {/* Email */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block', color: '#94a3b8',
                    fontSize: 13.5, fontWeight: 500, marginBottom: 8,
                  }}>
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
                      type="email"
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
                  }}>
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
                      type={showPassword ? 'text' : 'password'}
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
                      style={{
                        position: 'absolute', right: 16, top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none',
                        cursor: 'pointer', color: '#475569',
                        display: 'flex', alignItems: 'center', padding: 4,
                        transition: 'color 0.2s',
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
                  style={{
                    width: '100%', padding: '14px',
                    background: loading ? '#1e3a5f' : '#2563eb',
                    color: '#fff', border: 'none',
                    borderRadius: 12, fontSize: 15, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s, transform 0.1s',
                    letterSpacing: 0.2, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {loading && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      style={{ animation: 'spin 0.8s linear infinite' }}>
                      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
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
                color: '#334155', fontSize: 12,
              }}>
                <ShieldCheck size={13} style={{ color: '#334155' }} />
                <span>Kết nối bảo mật SSL</span>
                <span style={{ color: '#1e293b' }}>·</span>
                <span>Chỉ dành cho nội bộ</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
