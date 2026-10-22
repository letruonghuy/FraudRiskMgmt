import { Check } from 'lucide-react';

const FALLBACK_STYLE = { color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' };

export const CASE_STATUS_CONFIG = {
  Open: { label: 'Mở', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  Investigating: { label: 'Đang điều tra', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  PendingApproval: { label: 'Chờ duyệt', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  Approved: { label: 'Đã phê duyệt', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  Rework: { label: 'Cần làm lại', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  FalsePositive: { label: 'Báo động giả', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
  Closed: { label: 'Đã đóng', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
};

export const PROPOSAL_STATUS_CONFIG = {
  Pending: { label: 'Chờ quyết định', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  Approved: { label: 'Đã phê duyệt', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  Rejected: { label: 'Bị từ chối', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
};

// Phải khớp danh sách allowedActions trong CaseController.AddActionProposal
export const PROPOSAL_ACTIONS = [
  { value: 'NoAction', label: 'Không hành động' },
  { value: 'Monitor', label: 'Theo dõi thêm' },
  { value: 'ContactCustomer', label: 'Liên hệ khách hàng' },
  { value: 'RestrictTransaction', label: 'Hạn chế giao dịch' },
  { value: 'BlockAccount', label: 'Khóa tài khoản' },
  { value: 'Escalate', label: 'Báo cáo cấp trên' },
  { value: 'FalsePositive', label: 'Báo động giả' },
];

export const getActionLabel = (value) =>
  PROPOSAL_ACTIONS.find((action) => action.value.toLowerCase() === String(value).toLowerCase())?.label || value;

export const CASE_STATUS_HINT = {
  Open: 'Hồ sơ vừa được mở. Điều tra viên bắt đầu điều tra để ghi chú và đề xuất hành động.',
  Investigating: 'Điều tra viên đang ghi chú và đề xuất hành động. Cần ít nhất một đề xuất trước khi gửi phê duyệt.',
  PendingApproval: 'Hồ sơ đang chờ Manager quyết định từng đề xuất.',
  Approved: 'Hồ sơ đã hoàn tất. Các cảnh báo liên quan đã được đóng.',
  Rework: 'Manager đã từ chối một đề xuất. Điều tra viên cần điều tra lại và gửi phê duyệt lần nữa.',
};

const BadgeSpan = ({ cfg }) => (
  <span className="badge" style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}>{cfg.label}</span>
);

export const CaseStatusBadge = ({ status }) => (
  <BadgeSpan cfg={CASE_STATUS_CONFIG[status] || { ...FALLBACK_STYLE, label: status || 'Không xác định' }} />
);

export const ProposalStatusBadge = ({ status }) => (
  <BadgeSpan cfg={PROPOSAL_STATUS_CONFIG[status] || { ...FALLBACK_STYLE, label: status || 'Không xác định' }} />
);

// ── Thanh tiến trình của hồ sơ (dùng lại class .workflow-* đã có) ──
const CASE_STEPS = ['Mở hồ sơ', 'Điều tra', 'Chờ duyệt', 'Hoàn tất'];
const CASE_STEP_INDEX = { Open: 0, Investigating: 1, Rework: 1, PendingApproval: 2, Approved: 3, Closed: 3, FalsePositive: 3 };
const FINISHED_STATUSES = ['Approved', 'Closed', 'FalsePositive'];

export function CaseStepper({ status }) {
  const current = CASE_STEP_INDEX[status] ?? 0;
  const finished = FINISHED_STATUSES.includes(status);

  return (
    <ol className="workflow-stepper" aria-label="Tiến trình hồ sơ điều tra">
      {CASE_STEPS.map((label, index) => {
        const done = index < current || (index === current && finished);
        const active = index === current && !done;
        const text = index === 1 && status === 'Rework' ? 'Làm lại' : label;
        return (
          <li key={label} className={`workflow-step ${done ? 'done' : ''} ${active ? 'active' : ''}`} aria-current={index === current ? 'step' : undefined}>
            <span className="workflow-dot">{done ? <Check size={12} aria-hidden="true" /> : index + 1}</span>
            <span className="workflow-label">{text}</span>
          </li>
        );
      })}
    </ol>
  );
}