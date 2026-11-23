import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Copy, Eye, EyeOff, KeyRound, Lock,
  RefreshCw, Search, Shield, Unlock, UserCog, UserPlus, Users, X,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import Pagination from '../components/Pagination';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from './alertShared';

const PAGE_SIZE = 10;
const MIN_REASON_LEN = 5;
const MAX_REASON_LEN = 500;
// Đổi về 6 nếu backend của bạn đang chỉ yêu cầu tối thiểu 6 ký tự
const MIN_PASSWORD_LEN = 8;
const FEEDBACK_TIMEOUT_MS = 6000;

const ROLE_META = {
  Admin: {
    label: 'Quản trị viên (Admin)',
    short: 'Admin',
    desc: 'Quản trị người dùng, cấu hình mô hình, kiểm toán. Không xử lý nghiệp vụ điều tra.',
    color: '#c084fc',
    bg: 'rgba(168, 85, 247, 0.14)',
    border: 'rgba(168, 85, 247, 0.35)',
  },
  Manager: {
    label: 'Kiểm soát viên (Manager)',
    short: 'Manager',
    desc: 'Phân công cảnh báo, duyệt hồ sơ, theo dõi dashboard và hiệu suất đội.',
    color: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  Officer: {
    label: 'Điều tra viên (Officer)',
    short: 'Officer',
    desc: 'Tiếp nhận cảnh báo, điều tra, gộp và lập hồ sơ gửi Manager duyệt.',
    color: '#60a5fa',
    bg: 'rgba(59, 130, 246, 0.14)',
    border: 'rgba(59, 130, 246, 0.35)',
  },
};

// Lý do gợi ý (bấm để điền nhanh, vẫn sửa được)
const REASON_PRESETS = {
  role: ['Điều chuyển vị trí công tác', 'Bổ sung nhân sự cho bộ phận', 'Điều chỉnh theo quyết định phân quyền'],
  lock: ['Nhân sự nghỉ việc', 'Nghi ngờ truy cập bất thường', 'Tạm ngưng theo yêu cầu của quản lý'],
  unlock: ['Nhân sự quay lại làm việc', 'Đã xác minh, hết nghi ngờ'],
  password: ['Nhân viên quên mật khẩu', 'Nghi ngờ lộ mật khẩu', 'Cấp lại theo yêu cầu'],
};

const MODAL_STYLE = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '92vh',
    overflowY: 'auto',
    backgroundColor: '#0f172a',
    border: '1px solid rgba(148, 163, 184, 0.24)',
    borderRadius: 14,
    padding: 22,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
  },
};

const INPUT_STYLE = { backgroundImage: 'none', cursor: 'text' };
const ACTION_BTN_STYLE = { minHeight: 30, padding: '4px 7px', fontSize: '0.77rem' };

// Nút khóa dạng viền mờ, chỉ đỏ đậm khi rê chuột (để không át các thao tác khác)
const LOCAL_CSS = `
.admin-act-lock {
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 30px; padding: 4px 7px; font-size: 0.77rem; font-weight: 600;
  border-radius: 8px; cursor: pointer; font-family: inherit;
  color: #fca5a5; background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.3);
  transition: background-color .15s, border-color .15s, color .15s;
}
.admin-act-lock:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.16); border-color: rgba(239, 68, 68, 0.6); color: #fecaca;
}
.admin-act-lock:disabled { opacity: .4; cursor: not-allowed; }
.admin-act-unlock {
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 30px; padding: 4px 7px; font-size: 0.77rem; font-weight: 600;
  border-radius: 8px; cursor: pointer; font-family: inherit;
  color: #86efac; background: transparent;
  border: 1px solid rgba(34, 197, 94, 0.35);
  transition: background-color .15s;
}
.admin-act-unlock:hover:not(:disabled) { background: rgba(34, 197, 94, 0.14); }
.admin-act-unlock:disabled { opacity: .4; cursor: not-allowed; }
.admin-chip {
  padding: 3px 9px; font-size: 0.74rem; border-radius: 999px; cursor: pointer; font-family: inherit;
  color: #cbd5e1; background: rgba(148, 163, 184, 0.1); border: 1px solid rgba(148, 163, 184, 0.25);
}
.admin-chip:hover { background: rgba(59, 130, 246, 0.16); border-color: rgba(59, 130, 246, 0.4); color: #bfdbfe; }
`;

function formatShortDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

// Sinh mật khẩu tạm ngẫu nhiên (crypto), bỏ các ký tự dễ nhầm như 0/O, 1/l/I
function randomInt(max) {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return buf[0] % max;
}

function generatePassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*?';
  const all = upper + lower + digits + symbols;
  const pick = (set) => set[randomInt(set.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));

  // Xáo trộn Fisher–Yates
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function isPasswordValid(value) {
  return value.length >= MIN_PASSWORD_LEN && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function PasswordField({ id, label, value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    onChange(generatePassword());
    setVisible(true);
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard có thể bị chặn — người dùng vẫn copy tay được vì mật khẩu đang hiển thị
      setVisible(true);
    }
  };

  const invalid = value.length > 0 && !isPasswordValid(value);

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="select-dark"
          style={{ ...INPUT_STYLE, flex: 1, minWidth: 0 }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onChange(e.target.value); setCopied(false); }}
          autoComplete="new-password"
          required
        />
        <button
          type="button"
          className="sort-toggle"
          style={{ padding: '6px 9px' }}
          onClick={() => setVisible((v) => !v)}
          title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {visible ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="sort-toggle"
          style={{ padding: '6px 9px' }}
          onClick={handleGenerate}
          title="Tạo mật khẩu ngẫu nhiên"
          aria-label="Tạo mật khẩu ngẫu nhiên"
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="sort-toggle"
          style={{ padding: '6px 9px' }}
          onClick={handleCopy}
          disabled={!value}
          title="Sao chép mật khẩu"
          aria-label="Sao chép mật khẩu"
        >
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        </button>
      </div>
      <p
        className="cell-time"
        style={{ fontSize: '0.76rem', margin: '4px 0 0', color: invalid ? '#fca5a5' : undefined }}
      >
        Tối thiểu {MIN_PASSWORD_LEN} ký tự, gồm cả chữ và số. Hãy sao chép và gửi cho nhân viên qua kênh an toàn;
        hệ thống không hiển thị lại mật khẩu sau khi lưu.
      </p>
    </>
  );
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalCount: 0, activeCount: 0, lockedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // Modal state: 'create' | 'role' | 'status' | 'password' | null
  const [modalType, setModalType] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('Officer');
  const [reason, setReason] = useState('');

  const seqRef = useRef(0);
  const closeRef = useRef(() => {});

  // Debounce ô tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Tự ẩn thông báo thành công
  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(''), FEEDBACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const fetchUsers = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const response = await axiosClient.get('/admin/users', {
        params: {
          page,
          pageSize: PAGE_SIZE,
          search: search || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        },
      });
      if (seq !== seqRef.current) return;

      const payload = response.data || {};
      const totalCount = payload.totalCount || 0;
      const lastPage = Math.max(1, Math.ceil(totalCount / (payload.pageSize || PAGE_SIZE)));
      if ((payload.items || []).length === 0 && page > lastPage) {
        setPage(lastPage);
        return;
      }

      setUsers(Array.isArray(payload.items) ? payload.items : []);
      setMeta({
        page: payload.page || page,
        pageSize: payload.pageSize || PAGE_SIZE,
        totalCount,
        activeCount: payload.activeCount ?? 0,
        lockedCount: payload.lockedCount ?? 0,
      });
      setError('');
    } catch (err) {
      if (seq === seqRef.current) {
        setError(getErrorMessage(err));
      }
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
      }
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, reloadKey]);

  const closeModal = () => {
    if (submitting) return;
    setModalType(null);
    setTargetUser(null);
    setModalError('');
    setFullName('');
    setEmail('');
    setPassword('');
    setSelectedRole('Officer');
    setReason('');
  };
  closeRef.current = closeModal;

  // Nhấn Esc để đóng hộp thoại
  useEffect(() => {
    if (!modalType) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalType]);

  const openCreateModal = () => {
    setFeedback('');
    setModalError('');
    setFullName('');
    setEmail('');
    setPassword('');
    setSelectedRole('Officer');
    setModalType('create');
  };

  const openRoleModal = (u) => {
    setFeedback('');
    setModalError('');
    setTargetUser(u);
    setSelectedRole(u.role);
    setReason('');
    setModalType('role');
  };

  const openStatusModal = (u) => {
    setFeedback('');
    setModalError('');
    setTargetUser(u);
    setReason('');
    setModalType('status');
  };

  const openPasswordModal = (u) => {
    setFeedback('');
    setModalError('');
    setTargetUser(u);
    setPassword('');
    setReason('');
    setModalType('password');
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const handleSubmitModal = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setModalError('');

    try {
      if (modalType === 'create') {
        const normalizedEmail = email.trim().toLowerCase();
        await axiosClient.post('/admin/users', {
          fullName: fullName.trim(),
          email: normalizedEmail,
          password,
          role: selectedRole,
        });
        setFeedback(`Đã tạo tài khoản ${normalizedEmail} thành công.`);
      } else if (modalType === 'role' && targetUser) {
        await axiosClient.put(`/admin/users/${targetUser.userId}/role`, {
          role: selectedRole,
          reason: reason.trim(),
        });
        setFeedback(`Đã chuyển vai trò của ${targetUser.fullName} sang ${selectedRole}.`);
      } else if (modalType === 'status' && targetUser) {
        const nextActive = !targetUser.isActive;
        await axiosClient.put(`/admin/users/${targetUser.userId}/status`, {
          isActive: nextActive,
          reason: reason.trim(),
        });
        setFeedback(
          nextActive
            ? `Đã mở khóa tài khoản ${targetUser.email}.`
            : `Đã khóa tài khoản ${targetUser.email}.`
        );
      } else if (modalType === 'password' && targetUser) {
        await axiosClient.put(`/admin/users/${targetUser.userId}/reset-password`, {
          newPassword: password,
          reason: reason.trim(),
        });
        setFeedback(`Đã đặt lại mật khẩu cho tài khoản ${targetUser.email}.`);
      }

      setSubmitting(false);
      closeRef.current();
      setReloadKey((k) => k + 1);
    } catch (err) {
      setModalError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(meta.totalCount / (meta.pageSize || PAGE_SIZE)));
  const hasFilter = Boolean(searchInput || roleFilter || statusFilter);

  const reasonKey = modalType === 'status'
    ? (targetUser?.isActive ? 'lock' : 'unlock')
    : modalType;
  const reasonPresets = REASON_PRESETS[reasonKey] || [];

  const needsPassword = modalType === 'create' || modalType === 'password';
  const submitDisabled =
    submitting ||
    (modalType === 'create' && (!fullName.trim() || !email.trim())) ||
    (needsPassword && !isPasswordValid(password)) ||
    (modalType !== 'create' && reason.trim().length < MIN_REASON_LEN) ||
    (modalType === 'role' && selectedRole === targetUser?.role);

  const selectedRoleCfg = ROLE_META[selectedRole] || ROLE_META.Officer;

  return (
    <div className="fade-in">
      <style>{LOCAL_CSS}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Người dùng & Phân quyền</h1>
          <p className="page-subtitle">Quản lý tài khoản truy cập, phân tách nhiệm vụ RBAC và kiểm soát trạng thái hoạt động</p>
        </div>
        <button type="button" className="detail-primary-action" style={{ width: 'auto', minHeight: 42 }} onClick={openCreateModal}>
          <UserPlus size={16} aria-hidden="true" />
          Tạo tài khoản mới
        </button>
      </div>

      {/* Tab lọc theo trạng thái kèm số lượng */}
      <div className="scope-tabs" role="group" aria-label="Lọc theo trạng thái tài khoản">
        <button
          type="button"
          className={`scope-tab ${statusFilter === '' ? 'active' : ''}`}
          onClick={() => { setStatusFilter(''); setPage(1); }}
        >
          Tất cả
          <span className="scope-count">{meta.activeCount + meta.lockedCount}</span>
        </button>
        <button
          type="button"
          className={`scope-tab ${statusFilter === 'active' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('active'); setPage(1); }}
        >
          Kích hoạt
          <span className="scope-count">{meta.activeCount}</span>
        </button>
        <button
          type="button"
          className={`scope-tab ${statusFilter === 'locked' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('locked'); setPage(1); }}
        >
          Đã khóa
          <span className="scope-count">{meta.lockedCount}</span>
        </button>
      </div>

      {feedback && (
        <p className="case-message success" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} aria-hidden="true" />
          <span style={{ flex: 1 }}>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback('')}
            aria-label="Đóng thông báo"
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', padding: 2 }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      )}

      <div className="toolbar">
        <div className="toolbar-left">
          <label className="search-box">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="Tìm mã nhân viên, họ tên hoặc email"
              aria-label="Tìm kiếm người dùng"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>

          <select
            className="select-dark"
            aria-label="Lọc theo vai trò"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả vai trò</option>
            <option value="Officer">Điều tra viên (Officer)</option>
            <option value="Manager">Kiểm soát viên (Manager)</option>
            <option value="Admin">Quản trị viên (Admin)</option>
          </select>

          {hasFilter && (
            <button type="button" className="sort-toggle" onClick={clearFilters}>
              <X size={14} aria-hidden="true" />
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="toolbar-right">
          <span className="header-badge">
            <Users size={15} aria-hidden="true" />
            {meta.totalCount} tài khoản
          </span>
        </div>
      </div>

      <div className="page-card" aria-busy={loading}>
        {error ? (
          <div className="empty-state" role="alert">
            <AlertTriangle size={42} aria-hidden="true" />
            <h3>Không tải được danh sách người dùng</h3>
            <p>{error}</p>
            <button type="button" className="sort-toggle" onClick={() => setReloadKey((k) => k + 1)}>
              Thử lại
            </button>
          </div>
        ) : loading && users.length === 0 ? (
          <div className="table-loading" role="status">
            <div className="spin" aria-hidden="true" style={{ width: 28, height: 28, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            Đang tải danh sách tài khoản...
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <Users size={48} aria-hidden="true" />
            <h3>Không có tài khoản phù hợp</h3>
            <p>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc vai trò/trạng thái.</p>
          </div>
        ) : (
          <>
            <div className="alert-table-scroll" role="region" aria-label="Bảng danh sách người dùng" tabIndex={0}>
              <table className="data-table" style={{ width: '100%', minWidth: 0 }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '6%', padding: '12px 10px' }}>ID</th>
                    <th scope="col" style={{ width: '22%', padding: '12px 10px' }}>Nhân sự</th>
                    <th scope="col" style={{ width: '10%', padding: '12px 10px' }}>Vai trò</th>
                    <th scope="col" style={{ width: '12%', padding: '12px 10px' }}>Trạng thái</th>
                    <th scope="col" style={{ width: '13%', padding: '12px 10px' }}>Lần truy cập cuối</th>
                    <th scope="col" style={{ width: '13%', padding: '12px 10px' }}>Ngày tạo</th>
                    <th scope="col" style={{ width: '24%', padding: '12px 10px', textAlign: 'center' }}>Thao tác quản trị</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = String(u.userId) === String(currentUser?.userId);
                    const roleCfg = ROLE_META[u.role] || ROLE_META.Officer;
                    return (
                      <tr key={u.userId} style={{ opacity: u.isActive ? 1 : 0.65 }}>
                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <span className="cell-id">#{u.userId}</span>
                        </td>

                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span className="cell-name">{u.fullName}</span>
                            {isSelf && (
                              <span
                                style={{
                                  padding: '1px 7px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: 'rgba(59, 130, 246, 0.16)',
                                  color: '#93c5fd',
                                  border: '1px solid rgba(59, 130, 246, 0.35)',
                                }}
                              >
                                Bạn
                              </span>
                            )}
                          </div>
                          <div className="cell-time" style={{ fontSize: '0.8rem', marginTop: 2 }}>
                            {u.email}
                          </div>
                        </td>

                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <span
                            className="badge"
                            title={roleCfg.desc}
                            style={{
                              color: roleCfg.color,
                              backgroundColor: roleCfg.bg,
                              borderColor: roleCfg.border,
                            }}
                          >
                            <Shield size={12} aria-hidden="true" />
                            {roleCfg.short}
                          </span>
                        </td>

                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          {u.isActive ? (
                            <span
                              className="badge"
                              style={{
                                color: '#86efac',
                                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                                borderColor: 'rgba(34, 197, 94, 0.3)',
                              }}
                            >
                              Kích hoạt
                            </span>
                          ) : (
                            <span
                              className="badge"
                              style={{
                                color: '#fca5a5',
                                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                borderColor: 'rgba(239, 68, 68, 0.35)',
                              }}
                            >
                              Đã khóa
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <span className="cell-time" style={{ color: u.lastLoginAt ? 'var(--text)' : 'var(--text-soft)' }}>
                            {u.lastLoginAt ? formatShortDateTime(u.lastLoginAt) : 'Chưa đăng nhập'}
                          </span>
                        </td>

                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <span className="cell-time">{formatShortDateTime(u.createdAt)}</span>
                        </td>

                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <button
                              type="button"
                              className="sort-toggle"
                              style={ACTION_BTN_STYLE}
                              disabled={isSelf}
                              title={isSelf ? 'Không thể tự đổi vai trò của chính mình' : 'Đổi vai trò'}
                              onClick={() => openRoleModal(u)}
                            >
                              <UserCog size={12} aria-hidden="true" />
                              Vai trò
                            </button>

                            <button
                              type="button"
                              className="sort-toggle"
                              style={ACTION_BTN_STYLE}
                              title="Đặt lại mật khẩu"
                              onClick={() => openPasswordModal(u)}
                            >
                              <KeyRound size={12} aria-hidden="true" />
                              Mật khẩu
                            </button>

                            <button
                              type="button"
                              className={u.isActive ? 'admin-act-lock' : 'admin-act-unlock'}
                              disabled={isSelf}
                              title={isSelf ? 'Không thể tự khóa tài khoản của chính mình' : (u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản')}
                              onClick={() => openStatusModal(u)}
                            >
                              {u.isActive ? <Lock size={12} aria-hidden="true" /> : <Unlock size={12} aria-hidden="true" />}
                              {u.isActive ? 'Khóa' : 'Mở khóa'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={meta.totalCount}
              itemLabel="tài khoản"
              onPageChange={setPage}
              disabled={loading}
              ariaLabel="Phân trang danh sách người dùng"
            />
          </>
        )}
      </div>

      {/* Hộp thoại quản trị tài khoản */}
      {modalType && (
        <div role="dialog" aria-modal="true" style={MODAL_STYLE.overlay} onClick={closeModal}>
          <div style={MODAL_STYLE.card} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p className="detail-eyebrow">Quản trị truy cập · Ghi nhật ký kiểm toán</p>
                <h2 style={{ margin: '4px 0 0', fontSize: 18, color: '#f8fafc' }}>
                  {modalType === 'create' && 'Tạo tài khoản nhân sự mới'}
                  {modalType === 'role' && `Điều chuyển vai trò · ${targetUser?.fullName}`}
                  {modalType === 'status' && (targetUser?.isActive ? `Khóa tài khoản · ${targetUser?.fullName}` : `Mở khóa tài khoản · ${targetUser?.fullName}`)}
                  {modalType === 'password' && `Đặt lại mật khẩu · ${targetUser?.fullName}`}
                </h2>
              </div>
              <button type="button" className="sort-toggle" style={{ padding: '6px 8px' }} onClick={closeModal} disabled={submitting} aria-label="Đóng">
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <form className="case-form" onSubmit={handleSubmitModal} style={{ marginTop: 14 }}>
              {modalType === 'create' && (
                <>
                  <label htmlFor="user-fullname">Họ và tên</label>
                  <input
                    id="user-fullname"
                    type="text"
                    className="select-dark"
                    style={INPUT_STYLE}
                    placeholder="Nguyễn Văn A"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoFocus
                    required
                  />

                  <label htmlFor="user-email">Email đăng nhập</label>
                  <input
                    id="user-email"
                    type="email"
                    className="select-dark"
                    style={INPUT_STYLE}
                    placeholder="officer01@bank.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <PasswordField
                    id="user-password"
                    label="Mật khẩu khởi tạo"
                    value={password}
                    onChange={setPassword}
                    placeholder="Nhập hoặc bấm nút tạo ngẫu nhiên"
                  />

                  <label htmlFor="user-role">Vai trò hệ thống (RBAC)</label>
                  <select id="user-role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                    <option value="Officer">Điều tra viên (Officer)</option>
                    <option value="Manager">Kiểm soát viên (Manager)</option>
                    <option value="Admin">Quản trị viên (Admin)</option>
                  </select>
                  <p className="cell-time" style={{ fontSize: '0.78rem', margin: '4px 0 0' }}>
                    {selectedRoleCfg.desc}
                  </p>
                </>
              )}

              {modalType === 'role' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      className="badge"
                      style={{
                        color: (ROLE_META[targetUser?.role] || ROLE_META.Officer).color,
                        backgroundColor: (ROLE_META[targetUser?.role] || ROLE_META.Officer).bg,
                        borderColor: (ROLE_META[targetUser?.role] || ROLE_META.Officer).border,
                      }}
                    >
                      {targetUser?.role}
                    </span>
                    <ArrowRight size={14} aria-hidden="true" />
                    <span
                      className="badge"
                      style={{
                        color: selectedRoleCfg.color,
                        backgroundColor: selectedRoleCfg.bg,
                        borderColor: selectedRoleCfg.border,
                      }}
                    >
                      {selectedRole}
                    </span>
                  </div>

                  <label htmlFor="next-role">Vai trò mới</label>
                  <select id="next-role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                    <option value="Officer">Điều tra viên (Officer)</option>
                    <option value="Manager">Kiểm soát viên (Manager)</option>
                    <option value="Admin">Quản trị viên (Admin)</option>
                  </select>
                  <p className="cell-time" style={{ fontSize: '0.78rem', margin: '4px 0 0' }}>
                    {selectedRoleCfg.desc}
                  </p>

                  {targetUser?.role === 'Officer' && selectedRole !== 'Officer' && (
                    <p className="case-message warn" style={{ marginTop: 8 }}>
                      Nếu điều tra viên này đang giữ cảnh báo hoặc hồ sơ chưa xử lý xong, hãy nhờ Manager gán lại
                      trước khi đổi vai trò để không bỏ sót công việc.
                    </p>
                  )}
                  {targetUser?.role === 'Admin' && selectedRole !== 'Admin' && (
                    <p className="case-message warn" style={{ marginTop: 8 }}>
                      Tài khoản này đang là Admin. Hệ thống luôn cần ít nhất một Admin đang hoạt động.
                    </p>
                  )}
                </>
              )}

              {modalType === 'status' && (
                <p className="case-message warn" style={{ marginTop: 0 }}>
                  {targetUser?.isActive
                    ? `Tài khoản ${targetUser?.email} sẽ bị chặn đăng nhập ngay lập tức. Lịch sử điều tra trước đây vẫn được giữ nguyên.`
                    : `Tài khoản ${targetUser?.email} sẽ được khôi phục quyền truy cập hệ thống.`}
                </p>
              )}

              {modalType === 'password' && (
                <PasswordField
                  id="reset-pwd"
                  label="Mật khẩu tạm thời mới"
                  value={password}
                  onChange={setPassword}
                  placeholder="Nhập hoặc bấm nút tạo ngẫu nhiên"
                />
              )}

              {modalType !== 'create' && (
                <>
                  <label htmlFor="admin-reason">
                    Lý do thực hiện (bắt buộc, {MIN_REASON_LEN}–{MAX_REASON_LEN} ký tự)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {reasonPresets.map((preset) => (
                      <button key={preset} type="button" className="admin-chip" onClick={() => setReason(preset)}>
                        {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="admin-reason"
                    rows={3}
                    maxLength={MAX_REASON_LEN}
                    placeholder="Ghi rõ căn cứ điều chuyển, khóa tài khoản hoặc cấp lại mật khẩu để lưu Audit Log..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                  <p className="cell-time" style={{ fontSize: '0.76rem', margin: '2px 0 0', textAlign: 'right' }}>
                    {reason.length}/{MAX_REASON_LEN}
                  </p>
                </>
              )}

              {modalError && <p className="detail-action-error" role="alert">{modalError}</p>}

              <div className="case-form-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="sort-toggle" onClick={closeModal} disabled={submitting}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className={modalType === 'status' && targetUser?.isActive ? 'detail-danger-action' : 'detail-primary-action'}
                  style={{ minHeight: 40, padding: '8px 18px' }}
                  disabled={submitDisabled}
                >
                  {submitting ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}