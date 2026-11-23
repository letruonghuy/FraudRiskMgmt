using System.Globalization;
using System.Security.Claims;
using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Models;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Controllers
{
    [Route("api/admin/risk-config")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminRiskConfigController : ControllerBase
    {
        private static readonly string[] ScoredTypes = { "TRANSFER", "CASH_OUT" };
        private readonly AppDbContext _db;
        private readonly MLService _mlService;
        private readonly AuditLogService _auditLogService;
        private readonly IConfiguration _config;
        private readonly IWebHostEnvironment _env;

        public AdminRiskConfigController(
            AppDbContext db,
            MLService mlService,
            AuditLogService auditLogService,
            IConfiguration config,
            IWebHostEnvironment env)
        {
            _db = db;
            _mlService = mlService;
            _auditLogService = auditLogService;
            _config = config;
            _env = env;
        }

        private int GetCurrentUserId()
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? User.FindFirstValue("userId")
                      ?? User.FindFirstValue("sub");
            return int.TryParse(raw, out var id) ? id : 0;
        }

        private async Task<RiskPolicyConfig> GetOrCreateActiveConfigAsync()
        {
            var cfg = await _db.RiskPolicyConfigs
                .Include(c => c.UpdatedByUser)
                .OrderBy(c => c.RiskPolicyConfigId)
                .FirstOrDefaultAsync();

            if (cfg != null) return cfg;

            cfg = new RiskPolicyConfig
            {
                AlertThreshold = _config.GetValue<double?>("RiskPolicy:AlertThreshold") ?? 0.32,
                HighConfidenceScore = _config.GetValue<double?>("RiskPolicy:HighConfidenceScore") ?? 0.85,
                LargeAmount = _config.GetValue<double?>("RiskPolicy:LargeAmount") ?? 1_500_000,
                UpdatedAt = DateTime.UtcNow,
                LastChangeReason = "Khởi tạo tham số mặc định"
            };
            _db.RiskPolicyConfigs.Add(cfg);
            await _db.SaveChangesAsync();
            return cfg;
        }

        // GET /api/admin/risk-config
        [HttpGet]
        public async Task<IActionResult> GetRiskConfig(CancellationToken ct)
        {
            var cfg = await GetOrCreateActiveConfigAsync();
            var mlHealth = await _mlService.CheckHealthAsync(ct);
            var modelMetadata = ReadModelMetadataFromCsv();

            var recentHistory = await _db.AuditLogs
                .AsNoTracking()
                .Include(a => a.User)
                .Where(a => a.EntityType == "RiskPolicy")
                .OrderByDescending(a => a.CreatedAt)
                .Take(8)
                .Select(a => new
                {
                    a.AuditLogId,
                    a.Action,
                    a.Details,
                    a.Reason,
                    a.CreatedAt,
                    ActorName = a.User != null ? a.User.FullName : $"User #{a.UserId}",
                    ActorEmail = a.User != null ? a.User.Email : string.Empty
                })
                .ToListAsync(ct);

            return Ok(new
            {
                policy = new
                {
                    cfg.RiskPolicyConfigId,
                    cfg.AlertThreshold,
                    cfg.HighConfidenceScore,
                    cfg.LargeAmount,
                    cfg.UpdatedAt,
                    UpdatedByName = cfg.UpdatedByUser != null ? cfg.UpdatedByUser.FullName : "Hệ thống (Mặc định)",
                    cfg.LastChangeReason
                },
                mlHealth,
                modelMetadata,
                recentHistory
            });
        }

        // GET /api/admin/risk-config/ml-health
        [HttpGet("ml-health")]
        public async Task<IActionResult> PingMlService(CancellationToken ct)
        {
            var mlHealth = await _mlService.CheckHealthAsync(ct);
            return Ok(mlHealth);
        }

        // POST /api/admin/risk-config/simulate
        [HttpPost("simulate")]
        public async Task<IActionResult> SimulateImpact([FromBody] RiskPolicyPayloadDto candidate, CancellationToken ct)
        {
            var validationError = ValidatePolicyValues(candidate);
            if (validationError != null)
                return BadRequest(new { message = validationError });

            var currentCfg = await GetOrCreateActiveConfigAsync();
            var currentOpts = new RiskPolicyOptions
            {
                AlertThreshold = currentCfg.AlertThreshold,
                HighConfidenceScore = currentCfg.HighConfidenceScore,
                LargeAmount = currentCfg.LargeAmount
            };
            var proposedOpts = new RiskPolicyOptions
            {
                AlertThreshold = Math.Round(candidate.AlertThreshold, 4),
                HighConfidenceScore = Math.Round(candidate.HighConfidenceScore, 4),
                LargeAmount = Math.Round(candidate.LargeAmount, 2)
            };

            var cutoff = DateTime.UtcNow.AddDays(-30);
            var windowLabel = "30 ngày gần nhất";

            var samples = await _db.Transactions
                .AsNoTracking()
                .Where(t => t.DeletedAt == null
                            && ScoredTypes.Contains(t.TransactionType)
                            && t.TransactionTime >= cutoff)
                .Select(t => new { t.RiskScore, t.Amount })
                .ToListAsync(ct);

            if (samples.Count == 0)
            {
                samples = await _db.Transactions
                    .AsNoTracking()
                    .Where(t => t.DeletedAt == null && ScoredTypes.Contains(t.TransactionType))
                    .Select(t => new { t.RiskScore, t.Amount })
                    .ToListAsync(ct);
                windowLabel = samples.Count > 0
                    ? "Toàn bộ giao dịch đã nạp (chưa có giao dịch mới trong 30 ngày qua)"
                    : "30 ngày gần nhất";
            }

            var currentBreakdown = new RiskLevelBreakdownDto();
            var proposedBreakdown = new RiskLevelBreakdownDto();
            int currentAlerts = 0;
            int proposedAlerts = 0;
            int newlyTriggered = 0;
            int suppressed = 0;

            foreach (var tx in samples)
            {
                var curLevel = RiskPolicy.ClassifyWithOptions(tx.RiskScore, tx.Amount, currentOpts);
                var propLevel = RiskPolicy.ClassifyWithOptions(tx.RiskScore, tx.Amount, proposedOpts);

                IncrementBreakdown(currentBreakdown, curLevel);
                IncrementBreakdown(proposedBreakdown, propLevel);

                var isCurAlert = curLevel != RiskLevels.Safe;
                var isPropAlert = propLevel != RiskLevels.Safe;

                if (isCurAlert) currentAlerts++;
                if (isPropAlert) proposedAlerts++;
                if (!isCurAlert && isPropAlert) newlyTriggered++;
                if (isCurAlert && !isPropAlert) suppressed++;
            }

            var delta = proposedAlerts - currentAlerts;
            double? deltaPct = currentAlerts > 0
                ? Math.Round((double)delta / currentAlerts * 100, 1)
                : null;

            return Ok(new RiskSimulationResultDto
            {
                WindowLabel = windowLabel,
                TotalScoredTransactions = samples.Count,
                CurrentAlerts = currentAlerts,
                ProposedAlerts = proposedAlerts,
                DeltaAlerts = delta,
                DeltaPercent = deltaPct,
                NewlyTriggeredCount = newlyTriggered,
                SuppressedCount = suppressed,
                CurrentBreakdown = currentBreakdown,
                ProposedBreakdown = proposedBreakdown
            });
        }

        // PUT /api/admin/risk-config
        [HttpPut]
        public async Task<IActionResult> UpdateRiskConfig([FromBody] UpdateRiskPolicyRequest request, CancellationToken ct)
        {
            var validationError = ValidatePolicyValues(request);
            if (validationError != null)
                return BadRequest(new { message = validationError });

            var cfg = await GetOrCreateActiveConfigAsync();

            var nextAlert = Math.Round(request.AlertThreshold, 4);
            var nextHighConf = Math.Round(request.HighConfidenceScore, 4);
            var nextLargeAmt = Math.Round(request.LargeAmount, 2);

            var changes = new List<string>();
            var viCulture = CultureInfo.GetCultureInfo("vi-VN");

            if (Math.Abs(cfg.AlertThreshold - nextAlert) >= 0.0001)
                changes.Add($"AlertThreshold: {cfg.AlertThreshold:0.##} → {nextAlert:0.##}");

            if (Math.Abs(cfg.HighConfidenceScore - nextHighConf) >= 0.0001)
                changes.Add($"HighConfidenceScore: {cfg.HighConfidenceScore:0.##} → {nextHighConf:0.##}");

            if (Math.Abs(cfg.LargeAmount - nextLargeAmt) >= 0.01)
                changes.Add($"LargeAmount: {cfg.LargeAmount.ToString("N0", viCulture)} → {nextLargeAmt.ToString("N0", viCulture)}");

            if (changes.Count == 0)
                return BadRequest(new { message = "Chưa có tham số nào thay đổi so với cấu hình hiện tại." });

            var actorId = GetCurrentUserId();
            var trimmedReason = request.Reason.Trim();

            cfg.AlertThreshold = nextAlert;
            cfg.HighConfidenceScore = nextHighConf;
            cfg.LargeAmount = nextLargeAmt;
            cfg.UpdatedAt = DateTime.UtcNow;
            cfg.UpdatedByUserId = actorId > 0 ? actorId : null;
            cfg.LastChangeReason = trimmedReason;

            await _db.SaveChangesAsync(ct);

            if (actorId > 0)
            {
                await _auditLogService.LogAsync(
                    userId: actorId,
                    action: "UpdateRiskPolicy",
                    entityType: "RiskPolicy",
                    entityId: cfg.RiskPolicyConfigId,
                    oldStatus: null,
                    newStatus: null,
                    reason: trimmedReason,
                    details: string.Join(" | ", changes));
            }

            return Ok(new { message = "Đã cập nhật chính sách rủi ro và ghi nhật ký kiểm toán." });
        }

        private static string? ValidatePolicyValues(RiskPolicyPayloadDto p)
        {
            if (double.IsNaN(p.AlertThreshold) || p.AlertThreshold < 0.01 || p.AlertThreshold > 0.98)
                return "Ngưỡng kích hoạt cảnh báo (AlertThreshold) phải nằm trong khoảng 0,01 đến 0,98.";

            if (double.IsNaN(p.HighConfidenceScore) || p.HighConfidenceScore <= p.AlertThreshold || p.HighConfidenceScore > 0.99)
                return "Ngưỡng tin cậy cao (HighConfidenceScore) phải lớn hơn AlertThreshold và không vượt quá 0,99.";

            if (double.IsNaN(p.LargeAmount) || p.LargeAmount <= 0)
                return "Ngưỡng giao dịch giá trị lớn (LargeAmount) phải lớn hơn 0.";

            return null;
        }

        private static void IncrementBreakdown(RiskLevelBreakdownDto target, string level)
        {
            switch (level)
            {
                case RiskLevels.Low: target.Low++; break;
                case RiskLevels.Medium: target.Medium++; break;
                case RiskLevels.High: target.High++; break;
                case RiskLevels.Critical: target.Critical++; break;
                default: target.Safe++; break;
            }
        }

        private object ReadModelMetadataFromCsv()
        {
            var configuredPath = _config["ModelMetadata:ComparisonCsvPath"]
                                 ?? "../../fraud-detection-ml/reports/model_comparison.csv";

            string? fullPath = null;
            var candidateFromRoot = Path.GetFullPath(Path.Combine(_env.ContentRootPath, configuredPath));
            if (System.IO.File.Exists(candidateFromRoot))
            {
                fullPath = candidateFromRoot;
            }
            else
            {
                // Tự dò ngược lên tối đa 4 cấp thư mục cha để tìm fraud-detection-ml/reports/model_comparison.csv
                var dir = new DirectoryInfo(_env.ContentRootPath);
                for (int depth = 0; depth < 4 && dir != null; depth++, dir = dir.Parent)
                {
                    var probe = Path.Combine(dir.FullName, "fraud-detection-ml", "reports", "model_comparison.csv");
                    if (System.IO.File.Exists(probe))
                    {
                        fullPath = probe;
                        break;
                    }
                }
            }

            var rows = new List<Dictionary<string, object>>();
            var sourceAvailable = false;

            if (fullPath != null && System.IO.File.Exists(fullPath))
            {
                try
                {
                    var lines = System.IO.File.ReadAllLines(fullPath)
                        .Where(l => !string.IsNullOrWhiteSpace(l))
                        .ToArray();

                    if (lines.Length > 1)
                    {
                        sourceAvailable = true;
                        for (int i = 1; i < lines.Length; i++)
                        {
                            var cols = lines[i].Split(',');
                            if (cols.Length < 9) continue;

                            rows.Add(new Dictionary<string, object>
                            {
                                ["model"] = cols[0].Trim(),
                                ["imbalanceMethod"] = cols[1].Trim(),
                                ["precision"] = ParseDoubleSafe(cols[2]),
                                ["recall"] = ParseDoubleSafe(cols[3]),
                                ["f1"] = ParseDoubleSafe(cols[4]),
                                ["rocAuc"] = ParseDoubleSafe(cols[5]),
                                ["prAuc"] = ParseDoubleSafe(cols[6]),
                                ["optimalThreshold"] = ParseDoubleSafe(cols[7]),
                                ["trainSeconds"] = ParseDoubleSafe(cols[8]),
                            });
                        }
                    }
                }
                catch
                {
                    sourceAvailable = false;
                }
            }

            var activeModel = rows.FirstOrDefault(r =>
                                  string.Equals(r["model"]?.ToString(), "Random Forest", StringComparison.OrdinalIgnoreCase) &&
                                  string.Equals(r["imbalanceMethod"]?.ToString(), "Trọng số lớp", StringComparison.OrdinalIgnoreCase))
                              ?? new Dictionary<string, object>
                              {
                                  ["model"] = "Random Forest",
                                  ["imbalanceMethod"] = "Trọng số lớp",
                                  ["precision"] = 0.999390,
                                  ["recall"] = 0.996957,
                                  ["f1"] = 0.998172,
                                  ["rocAuc"] = 0.998741,
                                  ["prAuc"] = 0.997570,
                                  ["optimalThreshold"] = 0.379446,
                                  ["trainSeconds"] = 42.4,
                              };

            return new
            {
                sourceAvailable,
                sourceFile = "model_comparison.csv",
                datasetScope = "PaySim (6,36 triệu giao dịch) — chỉ huấn luyện và chấm điểm TRANSFER & CASH_OUT",
                evaluationSplit = "Tập test 554.082 giao dịch (1.643 gian lận); chọn ngưỡng tối ưu trên tập validation độc lập",
                activeModel,
                benchmarks = rows,
                topFeatures = new[]
                {
                    new { key = "errorBalanceOrig", label = "Sai lệch số dư nguồn", importance = 0.4518 },
                    new { key = "oldbalanceOrg", label = "Số dư nguồn trước GD", importance = 0.1959 },
                    new { key = "newbalanceOrig", label = "Số dư nguồn sau GD", importance = 0.1074 },
                    new { key = "newbalanceDest", label = "Số dư đích sau GD", importance = 0.0799 },
                    new { key = "amount", label = "Số tiền giao dịch", importance = 0.0513 },
                }
            };
        }

        private static double ParseDoubleSafe(string raw)
            => double.TryParse(raw.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var val) ? val : 0;
    }
}