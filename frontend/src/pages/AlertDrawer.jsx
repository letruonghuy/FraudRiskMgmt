import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  RiskBadge, RiskGauge, StatusBadge,
  formatCurrency, formatDate, getCreatedAt, getErrorMessage, maskAccountNumber,
} from './alertShared';

function DrawerRow({ label, value }) {
  return (
    <div className="drawer-row">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

export default function AlertDrawer({ alert, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const closeRef = useRef(null);

    useEffect(() => {
    let isActive = true;

    axiosClient.get(`/Alert/${alert.alertId}`)
      .then((res) => { if (isActive) setDetail(res.data); })
      .catch((err) => {
        if (isActive) {
          setDetail(null);
          setError(getErrorMessage(err));
        }
      });

    return () => { isActive = false; };
  }, [alert.alertId]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const data = detail || alert;

  // Render ra <body> để không bị ảnh hưởng bởi transform của .fade-in (làm position: fixed bị lệch)
  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="alert-drawer" role="dialog" aria-modal="true" aria-label={`Xem nhanh cảnh báo ${alert.alertId}`}>
        <header className="drawer-header">
          <div>
            <p className="detail-eyebrow">Xem nhanh</p>
            <h2>Cảnh báo #{alert.alertId}</h2>
            <div className="drawer-badges">
              <RiskBadge level={data.riskLevel} />
              <StatusBadge status={data.status} />
            </div>
          </div>
          <button ref={closeRef} className="drawer-close" type="button" onClick={onClose} aria-label="Đóng">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="drawer-body">
          <section className="drawer-section">
            <span className="drawer-label">Điểm rủi ro</span>
            <RiskGauge score={data.riskScore} level={data.riskLevel} />
          </section>

          <section className="drawer-section">
            <h3>Giao dịch</h3>
            <dl>
              <DrawerRow label="Số tiền" value={formatCurrency(data.amount)} />
              <DrawerRow label="Khách hàng" value={data.customerName} />
              <DrawerRow label="Loại giao dịch" value={detail?.transactionType || (error ? '—' : 'Đang tải...')} />
              <DrawerRow label="Thời gian giao dịch" value={detail ? formatDate(detail.transactionTime) : (error ? '—' : 'Đang tải...')} />
              <DrawerRow label="Tài khoản KH" value={detail ? maskAccountNumber(detail.customerAccountNumber) : (error ? '—' : 'Đang tải...')} />
            </dl>
          </section>

          <section className="drawer-section">
            <h3>Xử lý</h3>
            <div className="drawer-assignee">
              <UserRound size={16} aria-hidden="true" />
              <span>{data.assignedToName || 'Chưa phân công'}</span>
            </div>
            <dl>
              <DrawerRow label="Ngày tạo" value={formatDate(getCreatedAt(data))} />
              <DrawerRow label="Hồ sơ điều tra" value={detail ? (detail.caseId ? `#${detail.caseId}` : 'Chưa tạo hồ sơ') : (error ? '—' : 'Đang tải...')} />
            </dl>
          </section>

          {error && <p className="detail-action-error" role="alert">Không tải được chi tiết đầy đủ: {error}</p>}
        </div>

        <footer className="drawer-footer">
          <Link className="detail-primary-action" to={`/alerts/${alert.alertId}`}>
            <ExternalLink size={16} aria-hidden="true" /> Xem đầy đủ
          </Link>
        </footer>
      </aside>
    </>,
    document.body
  );
}