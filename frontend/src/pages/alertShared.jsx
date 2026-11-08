/* eslint-disable react-refresh/only-export-components */
// Dùng chung cho AlertListPage, AlertDrawer, AlertDetailPage và CaseDetailPage
export const RISK_CONFIG = {
  Critical: { label: 'Nghiêm trọng', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  High:     { label: 'Cao', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  Medium:   { label: 'Trung bình', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  Low:      { label: 'Thấp', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  Safe:     { label: 'An toàn', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
};

export const STATUS_CONFIG = {
  New:              { label: 'Mới',          color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',   border: 'rgba(59,130,246,0.3)' },
  Assigned:         { label: 'Đã phân công', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.3)' },
  UnderReview:      { label: 'Đang xem xét', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.3)' },
  AwaitingApproval: { label: 'Chờ duyệt',    color: '#fb923c', bg: 'rgba(251,146,60,0.12)',   border: 'rgba(251,146,60,0.3)' },
  Closed:           { label: 'Đã đóng',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)',    border: 'rgba(34,197,94,0.3)' },
  FalsePositive:    { label: 'Báo động giả', color: '#64748b', bg: 'rgba(100,116,139,0.12)',  border: 'rgba(100,116,139,0.3)' },
  Reopened:         { label: 'Mở lại',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    border: 'rgba(239,68,68,0.3)' },
};

const FALLBACK_STYLE = { color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' };

// ── Helpers ──────────────────────────────────────────────
export const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export const formatDate = (value) => {
  if (!value) return 'Chưa ghi nhận';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không xác định' : date.toLocaleString('vi-VN');
};

// Hàng đợi = Alert ở trạng thái New và chưa có người phụ trách (khớp đặc tả mục 5.2)
export const isInQueue = (alert) => alert?.assignedTo == null && alert?.status === 'New';

export const maskAccountNumber = (value) => {
  if (!value) return '—';
  const account = String(value);
  return account.length > 4 ? `•••• ${account.slice(-4)}` : account;
};

export const getErrorMessage = (error) => {
  const response = error.response?.data;
  if (typeof response === 'string' && response) return response;

  // Lỗi validation của ASP.NET: { errors: { Field: ['thông báo', ...] } }
  const firstValidationError = response?.errors ? Object.values(response.errors).flat()[0] : null;
  const serverMessage = response?.message || firstValidationError || response?.detail || response?.title;
  if (serverMessage) return serverMessage;

  // Forbid() của controller trả 403 không kèm nội dung
  if (error.response?.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (!error.response) return 'Không kết nối được máy chủ.';

  return error.message || 'Không thể tải dữ liệu.';
};

export const toRiskPercent = (score) =>
  Math.max(0, Math.min(100, Math.round((Number(score) || 0) * 100)));

// API danh sách trả về `createAt`, API chi tiết trả về `createdAt` → hỗ trợ cả hai
export const getCreatedAt = (alert) => alert?.createdAt ?? alert?.createAt;

// Cảnh báo còn mở = chưa đóng và chưa là báo động giả
const OPEN_STATUSES = new Set(['New', 'Assigned', 'UnderReview', 'AwaitingApproval', 'Reopened']);
// Ngưỡng tồn đọng (giờ) theo mức rủi ro. Đây là số mình đề xuất, bạn chỉnh theo quy định của đề tài.
//const SLA_HOURS = { Critical: 24, High: 72, Medium: 168, Low: 336, Safe: 336 };
const SLA_HOURS = { Critical: 4, High: 24, Medium: 48, Low: 72, Safe: 72 };

export const getBacklog = (alert, now) => {
  if (!OPEN_STATUSES.has(alert?.status)) return null;
  const created = new Date(getCreatedAt(alert)).getTime();
  if (Number.isNaN(created)) return null;
  const hours = Math.max(0, (now - created) / 3600000);
  return { hours, overdue: hours > (SLA_HOURS[alert.riskLevel] ?? 168) };
};

export const formatAge = (hours) => {
  if (hours < 1) return 'Dưới 1 giờ';
  if (hours < 48) return `${Math.floor(hours)} giờ`;
  return `${Math.floor(hours / 24)} ngày`;
};

// Dạng ngắn cho danh sách (không hiện giây)
export const formatDateShort = (value) => {
  if (!value) return 'Chưa ghi nhận';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Không xác định'
    : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const BacklogCell = ({ alert, now }) => {
  const info = getBacklog(alert, now);
  if (!info) return <span className="cell-time">—</span>;
  return (
    <span className={`backlog ${info.overdue ? 'overdue' : ''}`}>
      {formatAge(info.hours)}
      {info.overdue && <span className="backlog-flag">Quá hạn</span>}
    </span>
  );
};

// ── Components ───────────────────────────────────────────
export const RiskBadge = ({ level }) => {
  const cfg = RISK_CONFIG[level] || { ...FALLBACK_STYLE, label: level || 'Chưa xác định' };
  return <span className="badge" style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}>{cfg.label}</span>;
};

export const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { ...FALLBACK_STYLE, label: status || 'Chưa xác định' };
  return <span className="badge" style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}>{cfg.label}</span>;
};

export const RiskGauge = ({ score, level }) => {
  const pct = toRiskPercent(score);
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.Safe;
  return (
    <div className="risk-gauge" role="meter" aria-label="Điểm rủi ro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct}%`}>
      <div className="risk-gauge-bar">
        <div className="risk-gauge-fill" style={{ transform: `scaleX(${pct / 100})`, backgroundColor: cfg.color }} />
      </div>
      <span className="risk-gauge-label" style={{ color: cfg.color }}>{pct}%</span>
    </div>
  );
};