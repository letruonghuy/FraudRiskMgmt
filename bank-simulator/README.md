# Core Banking Simulator

Ứng dụng riêng, đóng vai một hệ thống ngân hàng bên ngoài đẩy giao dịch vào FraudRiskMgmt qua
`POST /api/ingest/transactions` (xác thực bằng header `X-Api-Key`). Không dùng tài khoản Officer/Manager/Admin.

## Đặt vào repo

Giải nén thành thư mục `bank-simulator/` **ngang hàng** với `backend/`, `frontend/`, `fraud-detection-ml/`:

```
FraudRiskMgmt/
├─ backend/
├─ frontend/
├─ fraud-detection-ml/
└─ bank-simulator/      <- thư mục này
```

## Chạy

```powershell
cd bank-simulator
npm install
copy .env.example .env      # rồi mở .env, điền VITE_API_KEY (giống Ingest:ApiKey trong appsettings.Development.json)
npm run dev
```

Mở http://localhost:5175. Lệnh `npm run dev` tự chép `fraud-detection-ml/data/simulator_source.csv` vào `public/`.
Backend và FastAPI phải đang chạy, và trình duyệt phải tin chứng chỉ https của backend
(đã tin nếu bạn mở được Swagger ở cùng địa chỉ).

## Ba chế độ

- **Kịch bản:** mỗi nút gửi một giao dịch lấy từ tập kiểm thử, theo nhãn (gian lận rõ, điểm giữa Thấp/Trung bình,
  bị bỏ sót, báo nhầm, bình thường, loại khác không qua ML).
- **Luồng tự động:** phát liên tục từng giao dịch, chỉnh tốc độ và tỷ lệ gian lận.
- **Nhập tay:** tự nhập số tiền và số dư; bỏ chọn "tự tính số dư sau" để tạo bất thường số dư.

## Ghi chú

- Chỉ gửi những gì ngân hàng thật có: loại giao dịch, số tiền, số dư trước/sau của hai tài khoản, `hour` = `step % 24`.
  Không bao giờ gửi `isFraud`, `model_score`, `demo_tag`.
- Mỗi giao dịch có `externalRef` riêng. Nếu backend trả 503 (chấm điểm tạm thời không khả dụng), simulator tự gửi lại
  cùng mã đó tối đa 3 lần, nên không bao giờ ghi trùng.
- Nhãn trong nhật ký chỉ để người vận hành theo dõi. Bật "Ẩn nhãn kịch bản" khi trình chiếu.
- API key nằm trong mã phía trình duyệt, chỉ chấp nhận được cho demo cục bộ.
- Tạo lại `simulator_source.csv`: chạy cell tạo file ở cuối notebook `fraud_model_training.ipynb`.
