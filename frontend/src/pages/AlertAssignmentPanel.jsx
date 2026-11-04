import { useEffect, useState } from 'react';
import { Hand, UserCheck } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { getErrorMessage, isInQueue } from './alertShared';

// Khối nhận / phân công cảnh báo (đặc tả mục 5.2 và 6.1).
// - Officer: tự nhận (accept) cảnh báo đang ở trạng thái New và chưa có người phụ trách.
// - Manager: phân công (hoặc phân công lại) cho một Officer khi cảnh báo ở trạng thái New hoặc Assigned,
//   và chưa thuộc hồ sơ nào.
export default function AlertAssignmentPanel({ alert, role, onChanged }) {
  const isManager = role === 'Manager';
  const isOfficer = role === 'Officer';
  const inQueue = isInQueue(alert);
  const reassignable = !alert.caseId && (inQueue || alert.status === 'Assigned');
  const canAct = (isManager && reassignable) || (isOfficer && inQueue);

  const [officers, setOfficers] = useState([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [officersKey, setOfficersKey] = useState(0);

  useEffect(() => {
    if (!isManager || !reassignable) return undefined;
    let isActive = true;
    axiosClient.get('/User/officers')
      .then((res) => { if (isActive && Array.isArray(res.data)) setOfficers(res.data); })
      .catch((err) => { if (isActive) setError(getErrorMessage(err)); });
    return () => { isActive = false; };
  }, [isManager, reassignable, officersKey]);

  // Không còn thao tác nào khả dụng thì ẩn khối, trừ khi còn thông báo vừa rồi cần cho người dùng đọc
  // (ví dụ: bấm nhận nhưng đã có người nhận trước → cảnh báo chuyển sang người khác).
  if (!canAct && !error && !notice) return null;

  const run = async (key, request, successMessage) => {
    if (busy) return;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await request();
      setNotice(successMessage);
      setSelected('');
      setOfficersKey((k) => k + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      // Dù thành công hay thất bại đều tải lại để giao diện khớp dữ liệu thật
      try { await onChanged(); } catch { /* lỗi tải lại do trang chính hiển thị */ }
      setBusy('');
    }
  };

  const accept = () => run('accept', () => axiosClient.put(`/Alert/${alert.alertId}/accept`), 'Bạn đã tiếp nhận cảnh báo này.');
  const assign = () => run(
    'assign',
    () => axiosClient.put(`/Alert/${alert.alertId}/assign`, { officerId: Number(selected) }),
    'Đã phân công cảnh báo.',
  );

  return (
    <div className="assign-panel" aria-label="Tiếp nhận và phân công">
      {canAct && <p className="assign-title">{inQueue ? 'Cảnh báo đang trong hàng đợi' : 'Phân công xử lý'}</p>}

      {isOfficer && canAct && (
        <>
          <p className="assign-hint">Chưa có ai phụ trách. Tiếp nhận để bắt đầu xử lý; người khác sẽ không nhận được nữa.</p>
          <button className="detail-primary-action" type="button" onClick={accept} disabled={Boolean(busy)}>
            <Hand size={16} aria-hidden="true" />
            {busy === 'accept' ? 'Đang tiếp nhận...' : 'Tiếp nhận xử lý'}
          </button>
        </>
      )}

      {isManager && canAct && (
        <>
          {!inQueue && <p className="assign-hint">Hiện do <strong>{alert.assignedToName || 'Officer'}</strong> phụ trách (chưa tạo hồ sơ). Có thể phân công lại.</p>}
          <label className="assign-label" htmlFor="assign-officer">Chọn Officer</label>
          <div className="assign-row">
            <select id="assign-officer" className="select-dark" value={selected} onChange={(e) => setSelected(e.target.value)} disabled={Boolean(busy)}>
              <option value="">— Chọn Officer —</option>
              {officers.map((o) => (
                <option key={o.userId} value={o.userId} disabled={String(o.userId) === String(alert.assignedTo)}>
                  {o.fullName} — đang xử lý {o.activeAlerts}{String(o.userId) === String(alert.assignedTo) ? ' (hiện tại)' : ''}
                </option>
              ))}
            </select>
            <button className="detail-primary-action" type="button" onClick={assign} disabled={!selected || Boolean(busy)}>
              <UserCheck size={16} aria-hidden="true" />
              {busy === 'assign' ? 'Đang phân công...' : inQueue ? 'Phân công' : 'Phân công lại'}
            </button>
          </div>
          {officers.length === 0 && !error && <p className="assign-hint">Chưa có Officer nào để phân công.</p>}
        </>
      )}

      {error && <p className="detail-action-error" role="alert">{error}</p>}
      {notice && !error && <p className="assign-success" role="status">{notice}</p>}
    </div>
  );
}