using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Services
{
    public record IngestResult(int TransactionId, string ExternalRef, bool Duplicate, bool Scored,
                               double? RiskScore, string RiskLevel, int? AlertId);
    public record ManualAlertResult(int TransactionId, int AlertId, string RiskLevel,
                                double RiskScore, string Status, bool Created);

    public class MlUnavailableException : Exception
    {
        public MlUnavailableException(string message, Exception? inner = null) : base(message, inner) { }
    }

    public class IngestService
    {
        private static readonly HashSet<string> MlTypes = new() { "TRANSFER", "CASH_OUT" };
        private readonly AppDbContext _db;
        private readonly MLService _ml;
        private readonly RiskPolicy _policy;
        private readonly ILogger<IngestService> _logger;

        public IngestService(AppDbContext db, MLService ml, RiskPolicy policy, ILogger<IngestService> logger)
        {
            _db = db; _ml = ml; _policy = policy; _logger = logger;
        }

        public async Task<IngestResult> IngestAsync(IngestTransactionRequest req)
        {
            var existing = await FindExistingAsync(req.ExternalRef);
            if (existing != null) return existing;

            var occurredAt = req.OccurredAt ?? DateTime.UtcNow;
            var hour = req.Hour ?? occurredAt.AddHours(7).Hour;   // giờ Việt Nam nếu bên gửi không cung cấp
            var src = req.Source;
            var dst = req.Destination;

            // Cùng công thức với notebook huấn luyện (dấu quan trọng)
            var errOrig = src.BalanceBefore - src.BalanceAfter - req.Amount;
            var errDest = dst.BalanceAfter - dst.BalanceBefore - req.Amount;

            double? score = null;
            var level = RiskLevels.Safe;
            if (MlTypes.Contains(req.Type))
            {
                try
                {
                    var pred = await _ml.PredictAsync(new TransactionRequest
                    {
                        CustomerId = 0,
                        TransactionType = req.Type,
                        NameOrig = src.AccountNumber,
                        NameDest = dst.AccountNumber,
                        Amount = req.Amount,
                        Hour = hour,
                        IsMerchant = dst.AccountNumber.StartsWith('M') ? 1 : 0,
                        ErrorBalanceOrig = errOrig,
                        ErrorBalanceDest = errDest,
                        OldBalanceOrg = src.BalanceBefore,
                        NewBalanceOrig = src.BalanceAfter,
                        OldBalanceDest = dst.BalanceBefore,
                        NewBalanceDest = dst.BalanceAfter
                    });
                    if (pred == null) throw new InvalidOperationException("Dịch vụ ML trả về rỗng");
                    score = pred.RiskScore;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Gọi dịch vụ ML thất bại cho {Ref}", req.ExternalRef);
                    throw new MlUnavailableException("Dịch vụ chấm điểm tạm thời không khả dụng", ex);
                }
                level = _policy.Classify(score.Value, req.Amount);
            }

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                var customer = await _db.Customers
                    .FirstOrDefaultAsync(c => c.AccountNumber == src.AccountNumber && c.DeletedAt == null);
                if (customer == null)
                {
                    customer = new Customer
                    {
                        AccountNumber = src.AccountNumber,
                        FullName = string.IsNullOrWhiteSpace(src.HolderName) ? $"Khách hàng {src.AccountNumber}" : src.HolderName.Trim(),
                        CreatedAt = DateTime.UtcNow
                    };
                    _db.Customers.Add(customer);
                    await _db.SaveChangesAsync();
                }

                var transaction = new Transactions
                {
                    ExternalRef = req.ExternalRef,
                    CustomerId = customer.CustomerId,
                    TransactionType = req.Type,
                    NameOrig = src.AccountNumber,
                    NameDest = dst.AccountNumber,
                    Amount = req.Amount,
                    OldBalanceOrg = src.BalanceBefore,
                    NewBalanceOrig = src.BalanceAfter,
                    OldBalanceDest = dst.BalanceBefore,
                    NewBalanceDest = dst.BalanceAfter,
                    Hour = hour,
                    TransactionTime = occurredAt,
                    RiskScore = score ?? 0,
                    RiskLevel = level
                };
                _db.Transactions.Add(transaction);
                await _db.SaveChangesAsync();

                int? alertId = null;
                if (score.HasValue && _policy.ShouldAlert(score.Value))
                {
                    var alert = new Alert
                    {
                        TransactionId = transaction.TransactionId,
                        RiskScore = score.Value,
                        RiskLevel = level,
                        Status = AlertStatuses.New,
                        CreatedAt = DateTime.UtcNow
                    };
                    _db.Alerts.Add(alert);
                    await _db.SaveChangesAsync();
                    alertId = alert.AlertId;
                }

                await tx.CommitAsync();
                return new IngestResult(transaction.TransactionId, req.ExternalRef, false, score.HasValue, score, level, alertId);
            }
            catch (DbUpdateException)
            {
                await tx.RollbackAsync();
                _db.ChangeTracker.Clear();
                var dup = await FindExistingAsync(req.ExternalRef);   // hai yêu cầu cùng ExternalRef gửi song song
                if (dup != null) return dup;
                throw;
            }
        }

        private async Task<IngestResult?> FindExistingAsync(string externalRef)
        {
            var t = await _db.Transactions.AsNoTracking()
                .Where(x => x.ExternalRef == externalRef)
                .Select(x => new { x.TransactionId, x.RiskScore, x.RiskLevel, x.TransactionType })
                .FirstOrDefaultAsync();
            if (t == null) return null;

            var alertId = await _db.Alerts.AsNoTracking()
                .Where(a => a.TransactionId == t.TransactionId)
                .Select(a => (int?)a.AlertId)
                .FirstOrDefaultAsync();
            var scored = MlTypes.Contains(t.TransactionType);
            return new IngestResult(t.TransactionId, externalRef, true, scored, scored ? t.RiskScore : null, t.RiskLevel, alertId);
        }

        public async Task<ManualAlertResult?> CreateManualAlertAsync(int transactionId, string? reason = null)
        {
            var tx = await _db.Transactions
                .FirstOrDefaultAsync(t => t.TransactionId == transactionId && t.DeletedAt == null);
            if (tx == null) return null;

            var existingAlert = await _db.Alerts
                .AsNoTracking()
                .Where(a => a.TransactionId == transactionId && a.DeletedAt == null)
                .Select(a => new { a.AlertId, a.RiskLevel, a.RiskScore, a.Status })
                .FirstOrDefaultAsync();

            if (existingAlert != null)
            {
                return new ManualAlertResult(
                    tx.TransactionId,
                    existingAlert.AlertId,
                    existingAlert.RiskLevel,
                    existingAlert.RiskScore,
                    existingAlert.Status,
                    Created: false);
            }

            var level = _policy.ClassifyManualReview(tx.Amount);
            var alert = new Alert
            {
                TransactionId = tx.TransactionId,
                RiskScore = tx.RiskScore,
                RiskLevel = level,
                Status = AlertStatuses.New,
                CreatedAt = DateTime.UtcNow
            };

            _db.Alerts.Add(alert);
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Tạo Alert hậu kiểm #{AlertId} cho Transaction #{TransactionId} ({Ref}). Lý do: {Reason}",
                alert.AlertId, tx.TransactionId, tx.ExternalRef, reason ?? "Post-review escalation");

            return new ManualAlertResult(
                tx.TransactionId,
                alert.AlertId,
                alert.RiskLevel,
                alert.RiskScore,
                alert.Status,
                Created: true);
        }
    }
}