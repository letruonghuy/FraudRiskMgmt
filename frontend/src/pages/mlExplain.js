
export const ML_MODEL_INFO = {
  name: 'Random Forest',
  threshold: 0.32,
  alertThreshold: 0.32,
  precision: 0.9988,
  recall: 0.9963,
  f1: 0.9976,
  rocAuc: 0.9985,
  prAuc: 0.9970,
  trainedOn: 'PaySim đầy đủ (6,36 triệu giao dịch), chỉ CASH_OUT và TRANSFER; mất cân bằng lớp xử lý bằng trọng số lớp',
  evaluatedOn: 'Tập test 554.082 giao dịch (1.643 gian lận); ngưỡng chọn trên tập validation riêng',
};
export const formatHour = (h) =>
  h === null || h === undefined ? '—' : `${String(h).padStart(2, '0')}:00`;
// Độ quan trọng toàn cục (feature_importances_ của mô hình đã lưu).
export const FEATURE_META = [
  { key: 'errorBalanceOrig', label: 'Sai lệch số dư nguồn', importance: 0.4518, hint: 'Số dư trước − số dư sau − số tiền' },
  { key: 'oldbalanceOrg', label: 'Số dư nguồn trước GD', importance: 0.1959 },
  { key: 'newbalanceOrig', label: 'Số dư nguồn sau GD', importance: 0.1074 },
  { key: 'newbalanceDest', label: 'Số dư đích sau GD', importance: 0.0799 },
  { key: 'amount', label: 'Số tiền giao dịch', importance: 0.0513 },
  { key: 'errorBalanceDest', label: 'Sai lệch số dư đích', importance: 0.0475, hint: 'Số dư sau − số dư trước − số tiền' },
  { key: 'oldbalanceDest', label: 'Số dư đích trước GD', importance: 0.0340 },
  { key: 'hour', label: 'Giờ giao dịch', importance: 0.0323 },
];

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function computeFeatures(alert) {
  const amount = num(alert.amount);
  const oldO = num(alert.oldBalanceOrg);
  const newO = num(alert.newBalanceOrig);
  const oldD = num(alert.oldBalanceDest);
  const newD = num(alert.newBalanceDest);

  return {
    hour: num(alert.hour),   // giờ do backend lưu cùng giao dịch, chính là giá trị mô hình đã dùng
    amount,
    errorBalanceOrig: oldO !== null && newO !== null && amount !== null ? oldO - newO - amount : null,
    errorBalanceDest: oldD !== null && newD !== null && amount !== null ? newD - oldD - amount : null,
    oldbalanceOrg: oldO,
    newbalanceOrig: newO,
    oldbalanceDest: oldD,
    newbalanceDest: newD,
  };
}