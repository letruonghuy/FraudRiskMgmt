// Hằng số và hàm tiện ích của hồ sơ điều tra (tách khỏi caseShared.jsx để thỏa rule Fast Refresh)

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
  Approved: 'Hồ sơ đã hoàn tất. Các đề xuất được duyệt có hiệu lực, đề xuất bị từ chối (nếu có) không được thực hiện. Các cảnh báo liên quan đã được xử lý xong.',
  Rework: 'Manager đã từ chối một đề xuất. Điều tra viên điều tra lại, có thể bổ sung đề xuất thay thế rồi gửi duyệt lại; các đề xuất còn chờ quyết định được giữ nguyên.',
};