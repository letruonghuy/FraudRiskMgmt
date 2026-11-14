export const API_BASE = (import.meta.env.VITE_API_URL || 'https://localhost:44324').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_API_KEY || '';
export const HAS_KEY = API_KEY.length > 0;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gửi một giao dịch. Nếu hệ thống chấm điểm tạm thời không khả dụng (503) thì tự gửi lại với cùng ExternalRef,
// nhờ vậy không bao giờ ghi trùng.
export async function sendTransaction(payload, { retries = 3, retryDelayMs = 5000, onRetry } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${API_BASE}/api/ingest/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
        body: JSON.stringify(payload),
      });
    } catch {
      return { status: 0, body: null, attempts: attempt + 1 };
    }

    if (res.status === 503 && attempt < retries) {
      onRetry?.(attempt + 1, retryDelayMs);
      await sleep(retryDelayMs);
      continue;
    }

    let body = null;
    try { body = await res.json(); } catch { /* phản hồi không có thân JSON */ }
    return { status: res.status, body, attempts: attempt + 1 };
  }
}

export async function escalateTransaction(transactionId, reason = 'Đẩy hậu kiểm từ Core Banking Simulator') {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/ingest/transactions/${transactionId}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
      body: JSON.stringify({ reason }),
    });
  } catch {
    return { status: 0, body: null };
  }

  let body = null;
  try { body = await res.json(); } catch { /* bỏ qua nếu rỗng */ }
  return { status: res.status, body };
}
