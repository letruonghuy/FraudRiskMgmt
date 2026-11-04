// Component dùng chung cho CaseListPage, CaseDetailPage và DashboardPage
import { Check } from 'lucide-react';
import { CASE_STATUS_CONFIG, PROPOSAL_STATUS_CONFIG } from './caseUtils';

const FALLBACK_STYLE = { color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' };

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