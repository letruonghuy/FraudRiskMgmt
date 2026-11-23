import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Download, Eye, FileText,
  Lock, ScrollText, Search, ShieldCheck, SlidersHorizontal, UserCog, X,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import Pagination from '../components/Pagination';
import { getErrorMessage } from './alertShared';

const PAGE_SIZE = 15;

const ENTITY_META = {
  User: {
    label: 'Tài khoản',
    color: '#c084fc',
    bg: 'rgba(168, 85, 247, 0.14)',
    border: 'rgba(168, 85, 247, 0.35)',
  },
  RiskPolicy: {
    label: 'Chính sách rủi ro',
    color: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  Alert: {
    label: 'Cảnh báo',
    color: '#60a5fa',
    bg: 'rgba(59, 130, 246, 0.14)',
    border: 'rgba(59, 130, 246, 0.35)',
  },
  Case: {
    label: 'Hồ sơ điều tra',
    color: '#34d399',
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.35)',
  },
  CaseActionProposal: {
    label: 'Đề xuất xử lý',
    color: '#f472b6',
    bg: 'rgba(236, 72, 153, 0.14)',
    border: 'rgba(236, 72, 153, 0.35)',
  },
};

const ACTION_LABELS = {
  CreateUser: 'Tạo tài khoản mới',
  ChangeRole: 'Điều chuyển vai trò',
  UpdateUserRole: 'Điều chuyển vai trò',
  LockUser: 'Khóa tài khoản',
  UnlockUser: 'Mở khóa tài khoản',
  UpdateUserStatus: 'Thay đổi trạng thái tài khoản',
  ResetPassword: 'Đặt lại mật khẩu',
  UpdateRiskPolicy: 'Cập nhật ngưỡng rủi ro',
  AssignAlert: 'Phân công cảnh báo',
  ResolveAlert: 'Kết luận cảnh báo',
  CreateCase: 'Khởi tạo hồ sơ điều tra',
  CloseCase: 'Đóng hồ sơ điều tra',
  ProposeAction: 'Gửi đề xuất biện pháp',
  ApproveProposal: 'Phê duyệt đề xuất',
  RejectProposal: 'Từ chối đề xuất',
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
    maxWidth: 560,
    maxHeight: '92vh',
    overflowY: 'auto',
    backgroundColor: '#0f172a',
    border: '1px solid rgba(148, 163, 184, 0.24)',
    borderRadius: 14,
    padding: 22,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
  },
};

function formatShortDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatFullDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function getActionTitle(action) {
  return ACTION_LABELS[action] || action || 'Thao tác hệ thống';
}

function getEntityBadge(entityType) {
  return ENTITY_META[entityType] || {
    label: entityType || 'Hệ thống',
    color: '#cbd5e1',
    bg: 'rgba(148, 163, 184, 0.14)',
    border: 'rgba(148, 163, 184, 0.35)',
  };
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({ all: 0, user: 0, policy: 0, ops: 0 });
  const [actors, setActors] = useState([]);
  const [actions, setActions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Filters
  const [scope, setScope] = useState('all'); // 'all' | 'user' | 'policy' | 'ops'
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Read-only detail modal
  const [selectedLog, setSelectedLog] = useState(null);

  const seqRef = useRef(0);

  // Debounce tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Nhấn Esc đóng modal chi tiết
  useEffect(() => {
    if (!selectedLog) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedLog(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedLog]);

  const buildParams = useCallback((overridePage) => ({
    page: overridePage ?? page,
    pageSize: PAGE_SIZE,
    scope: scope !== 'all' ? scope : undefined,
    action: actionFilter || undefined,
    actorId: actorFilter || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    search: search || undefined,
  }), [page, scope, actionFilter, actorFilter, fromDate, toDate, search]);

  const fetchLogs = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/audit-logs', { params: buildParams() });
      if (seq !== seqRef.current) return;

      const data = res.data || {};
      const total = data.totalCount || 0;
      const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if ((data.items || []).length === 0 && page > lastPage) {
        setPage(lastPage);
        return;
      }

      setLogs(Array.isArray(data.items) ? data.items : []);
      setTotalCount(total);
      if (data.counts) setCounts(data.counts);
      if (Array.isArray(data.actors)) setActors(data.actors);
      if (Array.isArray(data.actions)) setActions(data.actions);
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
  }, [buildParams, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await axiosClient.get('/admin/audit-logs/export', {
        params: buildParams(1),
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setActorFilter('');
    setActionFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasFilter = Boolean(searchInput || actorFilter || actionFilter || fromDate || toDate);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhật ký kiểm toán hệ thống</h1>
          <p className="page-subtitle">
            Truy vết bất biến mọi thay đổi phân quyền, cấu hình ngưỡng rủi ro và quyết định xử lý nghiệp vụ
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            className="badge"
            title="Dữ liệu kiểm toán chỉ được ghi nối tiếp, không có API chỉnh sửa hay xóa"
            style={{
              padding: '6px 11px',
              color: '#93c5fd',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              borderColor: 'rgba(59, 130, 246, 0.35)',
            }}
          >
            <Lock size={13} aria-hidden="true" />
            Chỉ đọc · Bất biến
          </span>

          <button
            type="button"
            className="sort-toggle"
            onClick={handleExportCsv}
            disabled={exporting || totalCount === 0}
            title="Xuất danh sách nhật ký theo bộ lọc hiện tại ra file CSV"
          >
            <Download size={14} aria-hidden="true" />
            {exporting ? 'Đang xuất...' : 'Xuất CSV'}
          </button>
        </div>
      </div>

      {/* Tab phân nhóm nghiệp vụ */}
      <div className="scope-tabs" role="group" aria-label="Nhóm nhật ký kiểm toán">
        <button
          type="button"
          className={`scope-tab ${scope === 'all' ? 'active' : ''}`}
          onClick={() => { setScope('all'); setPage(1); }}
        >
          Tất cả nhật ký
          <span className="scope-count">{counts.all}</span>
        </button>

        <button
          type="button"
          className={`scope-tab ${scope === 'user' ? 'active' : ''}`}
          onClick={() => { setScope('user'); setPage(1); }}
        >
          <UserCog size={14} aria-hidden="true" />
          Tài khoản & Phân quyền
          <span className="scope-count">{counts.user}</span>
        </button>

        <button
          type="button"
          className={`scope-tab ${scope === 'policy' ? 'active' : ''}`}
          onClick={() => { setScope('policy'); setPage(1); }}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Chính sách rủi ro
          <span className="scope-count">{counts.policy}</span>
        </button>

        <button
          type="button"
          className={`scope-tab ${scope === 'ops' ? 'active' : ''}`}
          onClick={() => { setScope('ops'); setPage(1); }}
        >
          <ShieldCheck size={14} aria-hidden="true" />
          Nghiệp vụ điều tra
          <span className="scope-count">{counts.ops}</span>
        </button>
      </div>

      {/* Thanh công cụ lọc */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="toolbar-left" style={{ flexWrap: 'wrap', gap: 8 }}>
          <label className="search-box">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="Tìm lý do, chi tiết, mã đối tượng (#ID)..."
              aria-label="Tìm kiếm nhật ký kiểm toán"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>

          <select
            className="select-dark"
            aria-label="Lọc theo người thực hiện"
            value={actorFilter}
            onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả người thực hiện</option>
            {actors.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.fullName} ({a.email})
              </option>
            ))}
          </select>

          <select
            className="select-dark"
            aria-label="Lọc theo loại hành động"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả hành động</option>
            {actions.map((act) => (
              <option key={act} value={act}>
                {getActionTitle(act)} ({act})
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              className="select-dark"
              style={{ backgroundImage: 'none', paddingRight: 10 }}
              aria-label="Từ ngày"
              title="Từ ngày"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            />
            <span className="cell-time">→</span>
            <input
              type="date"
              className="select-dark"
              style={{ backgroundImage: 'none', paddingRight: 10 }}
              aria-label="Đến ngày"
              title="Đến ngày"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            />
          </div>

          {hasFilter && (
            <button type="button" className="sort-toggle" onClick={clearFilters}>
              <X size={14} aria-hidden="true" />
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="toolbar-right">
          <span className="header-badge">
            <ScrollText size={15} aria-hidden="true" />
            {totalCount.toLocaleString('vi-VN')} bản ghi
          </span>
        </div>
      </div>

      {/* Bảng dữ liệu nhật ký */}
      <div className="page-card" aria-busy={loading}>
        {error ? (
          <div className="empty-state" role="alert">
            <AlertTriangle size={42} aria-hidden="true" />
            <h3>Không tải được nhật ký kiểm toán</h3>
            <p>{error}</p>
            <button type="button" className="sort-toggle" onClick={fetchLogs}>Thử lại</button>
          </div>
        ) : loading && logs.length === 0 ? (
          <div className="table-loading" role="status">
            <div className="spin" aria-hidden="true" style={{ width: 28, height: 28, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%' }} />
            Đang tải nhật ký kiểm toán...
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} aria-hidden="true" />
            <h3>Chưa có bản ghi kiểm toán phù hợp</h3>
            <p>Thử nới rộng khoảng thời gian hoặc xóa bộ lọc đang áp dụng.</p>
          </div>
        ) : (
          <>
            <div className="alert-table-scroll" role="region" aria-label="Bảng nhật ký kiểm toán" tabIndex={0}>
              <table className="data-table" style={{ width: '100%', minWidth: 0 }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '6%', padding: '12px 10px' }}>ID</th>
                    <th scope="col" style={{ width: '13%', padding: '12px 10px' }}>Thời gian</th>
                    <th scope="col" style={{ width: '18%', padding: '12px 10px' }}>Người thực hiện</th>
                    <th scope="col" style={{ width: '14%', padding: '12px 10px' }}>Đối tượng</th>
                    <th scope="col" style={{ width: '17%', padding: '12px 10px' }}>Hành động</th>
                    <th scope="col" style={{ width: '24%', padding: '12px 10px' }}>Biến động & Lý do</th>
                    <th scope="col" style={{ width: '8%', padding: '12px 10px', textAlign: 'center' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((item) => {
                    const entityCfg = getEntityBadge(item.entityType);
                    const hasStatusDiff = Boolean(item.oldStatus || item.newStatus);

                    return (
                      <tr key={item.auditLogId} className="clickable-row" onClick={() => setSelectedLog(item)}>
                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <span className="cell-id">#{item.auditLogId}</span>
                        </td>

                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <span className="cell-time">{formatShortDateTime(item.createdAt)}</span>
                        </td>

                        <td style={{ padding: '12px 10px' }}>
                          <div className="cell-name" style={{ fontSize: '0.86rem' }}>{item.actorName}</div>
                          <div className="cell-time" style={{ fontSize: '0.76rem', marginTop: 2 }}>
                            {item.actorEmail || `ID #${item.userId}`}
                          </div>
                        </td>

                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <span
                            className="badge"
                            style={{
                              color: entityCfg.color,
                              backgroundColor: entityCfg.bg,
                              borderColor: entityCfg.border,
                            }}
                          >
                            {entityCfg.label} #{item.entityId}
                          </span>
                        </td>

                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                            {getActionTitle(item.action)}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-soft)', fontFamily: 'monospace', marginTop: 2 }}>
                            {item.action}
                          </div>
                        </td>

                        <td style={{ padding: '12px 10px' }}>
                          {hasStatusDiff && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, color: '#93c5fd', marginBottom: 3 }}>
                              <span>{item.oldStatus || '—'}</span>
                              <ArrowRight size={12} aria-hidden="true" />
                              <span>{item.newStatus || '—'}</span>
                            </div>
                          )}

                          {item.details && (
                            <div style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600, lineHeight: 1.35 }}>
                              {item.details}
                            </div>
                          )}

                          {item.reason ? (
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-soft)',
                                marginTop: 2,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              Lý do: {item.reason}
                            </div>
                          ) : (
                            !hasStatusDiff && !item.details && <span className="cell-time">—</span>
                          )}
                        </td>

                        <td style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="sort-toggle"
                            style={{ minHeight: 30, padding: '4px 8px', fontSize: '0.77rem' }}
                            onClick={() => setSelectedLog(item)}
                            title="Xem đầy đủ bản ghi kiểm toán"
                          >
                            <Eye size={13} aria-hidden="true" />
                            Xem
                          </button>
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
              totalCount={totalCount}
              itemLabel="bản ghi"
              onPageChange={setPage}
              disabled={loading}
              ariaLabel="Phân trang nhật ký kiểm toán"
            />
          </>
        )}
      </div>

      {/* Hộp thoại xem chi tiết bản ghi kiểm toán (Read-only) */}
      {selectedLog && (
        <div role="dialog" aria-modal="true" style={MODAL_STYLE.overlay} onClick={() => setSelectedLog(null)}>
          <div style={MODAL_STYLE.card} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p className="detail-eyebrow">Hồ sơ truy vết kiểm toán · Bản ghi #{selectedLog.auditLogId}</p>
                <h2 style={{ margin: '4px 0 0', fontSize: 18, color: '#f8fafc' }}>
                  {getActionTitle(selectedLog.action)}
                </h2>
              </div>
              <button
                type="button"
                className="sort-toggle"
                style={{ padding: '6px 8px' }}
                onClick={() => setSelectedLog(null)}
                aria-label="Đóng"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                <div className="cell-time" style={{ fontSize: '0.74rem' }}>Thời điểm ghi nhận</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>
                  {formatFullDateTime(selectedLog.createdAt)}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 10, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                <div className="cell-time" style={{ fontSize: '0.74rem' }}>Người thực hiện</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>
                  {selectedLog.actorName} {selectedLog.actorRole ? `(${selectedLog.actorRole})` : ''}
                </div>
                <div className="cell-time" style={{ fontSize: '0.75rem', marginTop: 1 }}>{selectedLog.actorEmail}</div>
              </div>

              <div style={{ padding: 12, borderRadius: 10, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                <div className="cell-time" style={{ fontSize: '0.74rem' }}>Đối tượng tác động</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>
                  {selectedLog.entityType} #{selectedLog.entityId}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 10, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                <div className="cell-time" style={{ fontSize: '0.74rem' }}>Mã hành động kỹ thuật</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#93c5fd', fontFamily: 'monospace', marginTop: 3 }}>
                  {selectedLog.action}
                </div>
              </div>
            </div>

            {(selectedLog.oldStatus || selectedLog.newStatus) && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                <div className="cell-time" style={{ fontSize: '0.74rem', marginBottom: 6 }}>Chuyển đổi trạng thái</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-soft)' }}>{selectedLog.oldStatus || 'Trống'}</span>
                  <ArrowRight size={14} color="#60a5fa" aria-hidden="true" />
                  <span style={{ color: '#60a5fa' }}>{selectedLog.newStatus || 'Trống'}</span>
                </div>
              </div>
            )}

            {selectedLog.details && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
                <div className="cell-time" style={{ fontSize: '0.74rem', marginBottom: 4 }}>Chi tiết thay đổi</div>
                <div style={{ fontSize: '0.86rem', color: '#93c5fd', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {selectedLog.details}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
              <div className="cell-time" style={{ fontSize: '0.74rem', marginBottom: 4 }}>Lý do / Căn cứ nghiệp vụ</div>
              <div style={{ fontSize: '0.86rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {selectedLog.reason || 'Không có ghi chú lý do kèm theo.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="sort-toggle" onClick={() => setSelectedLog(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}