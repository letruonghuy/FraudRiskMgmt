
export const ML_MODEL_INFO = {
  name: 'Random Forest',
  threshold: 0.89,
  alertThreshold: 0.3,
  precision: 0.9867,
  recall: 0.9781,
  f1: 0.9824,
  rocAuc: 0.9931,
  prAuc: 0.9708,
  trainedOn: 'PaySim — chỉ giao dịch CASH_OUT và TRANSFER, dữ liệu được cân bằng bằng SMOTE',
};

// Độ quan trọng toàn cục (feature_importances_ của mô hình đã lưu).
export const FEATURE_META = [
  { key: 'errorBalanceOrig', label: 'Sai lệch số dư nguồn', importance: 0.4657, hint: 'Số dư trước − số dư sau − số tiền' },
  { key: 'oldbalanceOrg', label: 'Số dư nguồn trước GD', importance: 0.155 },
  { key: 'newbalanceOrig', label: 'Số dư nguồn sau GD', importance: 0.1325 },
  { key: 'newbalanceDest', label: 'Số dư đích sau GD', importance: 0.0904 },
  { key: 'oldbalanceDest', label: 'Số dư đích trước GD', importance: 0.0606 },
  { key: 'amount', label: 'Số tiền giao dịch', importance: 0.0419 },
  { key: 'errorBalanceDest', label: 'Sai lệch số dư đích', importance: 0.0371, hint: 'Số dư sau − số dư trước − số tiền' },
  { key: 'hour', label: 'Giờ giao dịch', importance: 0.0168 },
  { key: 'is_merchant', label: 'Đích là merchant', importance: 0 },
];

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// Tính lại đúng các đặc trưng mà notebook đã dùng để huấn luyện, từ dữ liệu giao dịch của cảnh báo.
export function computeFeatures(alert) {
  const amount = num(alert.amount);
  const oldO = num(alert.oldBalanceOrg);
  const newO = num(alert.newBalanceOrig);
  const oldD = num(alert.oldBalanceDest);
  const newD = num(alert.newBalanceDest);
  // Lấy giờ trực tiếp từ chuỗi ISO để không bị lệch múi giờ trình duyệt
  const hourMatch = typeof alert.transactionTime === 'string' ? alert.transactionTime.match(/T(\d{2})/) : null;

  return {
    hour: hourMatch ? Number(hourMatch[1]) : null,
    amount,
    is_merchant: typeof alert.nameDest === 'string' && alert.nameDest.length > 0 ? (alert.nameDest[0] === 'M' ? 1 : 0) : null,
    errorBalanceOrig: oldO !== null && newO !== null && amount !== null ? oldO - newO - amount : null,
    errorBalanceDest: oldD !== null && newD !== null && amount !== null ? newD - oldD - amount : null,
    oldbalanceOrg: oldO,
    newbalanceOrig: newO,
    oldbalanceDest: oldD,
    newbalanceDest: newD,
  };
}