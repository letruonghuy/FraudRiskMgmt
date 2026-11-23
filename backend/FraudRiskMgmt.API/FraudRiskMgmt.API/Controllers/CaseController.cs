using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Extensions;
using FraudRiskMgmt.API.Models;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FraudRiskMgmt.API.Controllers
{
    [Authorize(Roles = "Officer,Manager")]
    [Route("api/[controller]")]
    [ApiController]
    public class CaseController : ControllerBase
    {
        private const int MaxMergeAlerts = 20;
        private const int MaxMoneyTrailHops = 5;
        private const int MinReasonLength = 5;
        private const int MaxReasonLength = 500;
        private static readonly TimeSpan SameEntityTimeWindow = TimeSpan.FromDays(7);
        private static readonly TimeSpan MoneyTrailTimeWindow = TimeSpan.FromHours(24);

        private readonly AppDbContext _appDbContext;
        private readonly AuditLogService _auditLogService;
        private readonly ILogger<CaseController> _logger;

        public record MergePreviewRequest(List<int> AlertIds);
        public record MergeAlertsRequest(List<int> AlertIds, string Reason);
        public record AddAlertToCaseRequest(int AlertId, string Reason);
        public record UnmergeAlertFromCaseRequest(string Reason);

        private record MergeEvaluationResult(
            bool IsValid,
            string? ErrorMessage,
            string Pattern,
            string CorrelationKey,
            int PrimaryCustomerId,
            string MatchReason,
            List<Alert> OrderedAlerts
        );

        public CaseController(
            AppDbContext appDbContext,
            AuditLogService auditLogService,
            ILogger<CaseController> logger)
        {
            _appDbContext = appDbContext;
            _auditLogService = auditLogService;
            _logger = logger;
        }

        private static string? NormalizeAccount(string? value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? null
                : value.Trim().ToUpperInvariant();
        }

        private static (bool IsValid, string NormalizedReason, string? ErrorMessage) ValidateReason(string? reason)
        {
            var trimmed = reason?.Trim() ?? string.Empty;
            if (trimmed.Length < MinReasonLength || trimmed.Length > MaxReasonLength)
            {
                return (false, trimmed, $"Lý do thao tác là bắt buộc và phải từ {MinReasonLength} đến {MaxReasonLength} ký tự.");
            }
            return (true, trimmed, null);
        }

        // Phân tích tập Alert xem thuộc kiểu gộp nào trong 3 kiểu: SameCustomer | SameDestination | MoneyTrail
        private static MergeEvaluationResult EvaluateMergePattern(List<Alert> alerts)
        {
            var ordered = alerts
                .OrderBy(a => a.Transaction.TransactionTime)
                .ThenBy(a => a.AlertId)
                .ToList();

            var firstTx = ordered[0].Transaction;
            var primaryCustomerId = firstTx.CustomerId;
            var minTime = ordered[0].Transaction.TransactionTime;
            var maxTime = ordered[^1].Transaction.TransactionTime;
            var totalSpan = maxTime - minTime;

            // 1. Cùng một khách hàng (SameCustomer - tối đa 7 ngày)
            var distinctCustomers = ordered.Select(a => a.Transaction.CustomerId).Distinct().ToList();
            if (distinctCustomers.Count == 1)
            {
                if (totalSpan > SameEntityTimeWindow)
                {
                    return new MergeEvaluationResult(
                        IsValid: false,
                        ErrorMessage: "Các cảnh báo của cùng khách hàng vượt quá cửa sổ thời gian tối đa 7 ngày.",
                        Pattern: string.Empty,
                        CorrelationKey: string.Empty,
                        PrimaryCustomerId: primaryCustomerId,
                        MatchReason: string.Empty,
                        OrderedAlerts: ordered
                    );
                }

                var key = NormalizeAccount(firstTx.NameOrig) ?? $"Customer#{primaryCustomerId}";
                return new MergeEvaluationResult(
                    IsValid: true,
                    ErrorMessage: null,
                    Pattern: "SameCustomer",
                    CorrelationKey: key,
                    PrimaryCustomerId: primaryCustomerId,
                    MatchReason: "Cùng khách hàng (trong vòng 7 ngày)",
                    OrderedAlerts: ordered
                );
            }

            // 2. Cùng tài khoản nhận tiền (SameDestination - Money Mule / Fan-in - tối đa 7 ngày)
            var normalizedDests = ordered
                .Select(a => NormalizeAccount(a.Transaction.NameDest))
                .ToList();

            if (normalizedDests.All(d => d != null) && normalizedDests.Distinct().Count() == 1)
            {
                if (totalSpan > SameEntityTimeWindow)
                {
                    return new MergeEvaluationResult(
                        IsValid: false,
                        ErrorMessage: "Các cảnh báo chung tài khoản nhận vượt quá cửa sổ thời gian tối đa 7 ngày.",
                        Pattern: string.Empty,
                        CorrelationKey: string.Empty,
                        PrimaryCustomerId: primaryCustomerId,
                        MatchReason: string.Empty,
                        OrderedAlerts: ordered
                    );
                }

                var sharedDest = normalizedDests[0]!;
                return new MergeEvaluationResult(
                    IsValid: true,
                    ErrorMessage: null,
                    Pattern: "SameDestination",
                    CorrelationKey: sharedDest,
                    PrimaryCustomerId: primaryCustomerId,
                    MatchReason: $"Cùng tài khoản nhận ({sharedDest}, trong vòng 7 ngày)",
                    OrderedAlerts: ordered
                );
            }

            // 3. Chuỗi dòng tiền liên hoàn qua trung gian (MoneyTrail - Layering: A -> B -> C)
            // Ràng buộc: tối đa 5 alert/hop, thời gian từng chặng không giảm, toàn chuỗi <= 24 giờ
            if (ordered.Count >= 2)
            {
                // Chặn Anti-DoS ngay lập tức: tuyệt đối không chạy DFS khi vượt quá MaxMoneyTrailHops (5)
                if (ordered.Count > MaxMoneyTrailHops)
                {
                    return new MergeEvaluationResult(
                        IsValid: false,
                        ErrorMessage: $"Các cảnh báo không cùng khách hàng hoặc cùng tài khoản nhận; nếu gộp theo chuỗi dòng tiền (Money Trail) thì chỉ cho phép tối đa {MaxMoneyTrailHops} mắt xích.",
                        Pattern: string.Empty,
                        CorrelationKey: string.Empty,
                        PrimaryCustomerId: primaryCustomerId,
                        MatchReason: string.Empty,
                        OrderedAlerts: ordered
                    );
                }

                if (TryBuildMoneyTrail(ordered, enforceTemporalRules: true, out var chain))
                {
                    var hops = chain.Select(a => NormalizeAccount(a.Transaction.NameOrig)!).ToList();
                    hops.Add(NormalizeAccount(chain.Last().Transaction.NameDest)!);
                    var trailKey = string.Join(" → ", hops);

                    return new MergeEvaluationResult(
                        IsValid: true,
                        ErrorMessage: null,
                        Pattern: "MoneyTrail",
                        CorrelationKey: trailKey,
                        PrimaryCustomerId: chain[0].Transaction.CustomerId,
                        MatchReason: $"Chuỗi dòng tiền ({trailKey}, trong vòng 24 giờ)",
                        OrderedAlerts: chain
                    );
                }

                // Lúc này ordered.Count <= MaxMoneyTrailHops (tối đa 5) nên chạy DFS kiểm tra lý do vi phạm thời gian hoàn toàn an toàn
                if (TryBuildMoneyTrail(ordered, enforceTemporalRules: false, out _))
                {
                    return new MergeEvaluationResult(
                        IsValid: false,
                        ErrorMessage: "Các giao dịch có nối tiếp tài khoản nhưng không đảm bảo thứ tự thời gian tăng dần hoặc vượt quá cửa sổ 24 giờ.",
                        Pattern: string.Empty,
                        CorrelationKey: string.Empty,
                        PrimaryCustomerId: primaryCustomerId,
                        MatchReason: string.Empty,
                        OrderedAlerts: ordered
                    );
                }
            }

            return new MergeEvaluationResult(
                IsValid: false,
                ErrorMessage: "Các cảnh báo được chọn không có điểm chung hợp lệ (phải cùng khách hàng trong 7 ngày, cùng tài khoản nhận trong 7 ngày, hoặc tạo thành chuỗi dòng tiền liên tiếp trong 24 giờ).",
                Pattern: string.Empty,
                CorrelationKey: string.Empty,
                PrimaryCustomerId: primaryCustomerId,
                MatchReason: string.Empty,
                OrderedAlerts: ordered
            );
        }

        // Tìm thứ tự nối tiếp A.NameDest == B.NameOrig qua danh sách tối đa 5 Alert
        private static bool TryBuildMoneyTrail(List<Alert> alerts, bool enforceTemporalRules, out List<Alert> chain)
        {
            chain = new List<Alert>();
            if (alerts.Count > MaxMoneyTrailHops)
                return false;

            if (alerts.Any(a => NormalizeAccount(a.Transaction.NameOrig) == null || NormalizeAccount(a.Transaction.NameDest) == null))
                return false;

            for (int startIdx = 0; startIdx < alerts.Count; startIdx++)
            {
                var visited = new bool[alerts.Count];
                var currentPath = new List<Alert> { alerts[startIdx] };
                visited[startIdx] = true;

                if (DfsChain(alerts, visited, currentPath, enforceTemporalRules))
                {
                    chain = currentPath;
                    return true;
                }
            }

            return false;
        }

        private static bool DfsChain(List<Alert> alerts, bool[] visited, List<Alert> currentPath, bool enforceTemporalRules)
        {
            if (currentPath.Count == alerts.Count)
                return true;

            var firstTime = currentPath[0].Transaction.TransactionTime;
            var lastAlert = currentPath[^1];
            var lastDest = NormalizeAccount(lastAlert.Transaction.NameDest)!;
            var lastTime = lastAlert.Transaction.TransactionTime;

            for (int i = 0; i < alerts.Count; i++)
            {
                if (visited[i]) continue;

                var candidate = alerts[i];
                var candidateOrig = NormalizeAccount(candidate.Transaction.NameOrig)!;
                if (!string.Equals(lastDest, candidateOrig, StringComparison.Ordinal))
                    continue;

                if (enforceTemporalRules)
                {
                    var candidateTime = candidate.Transaction.TransactionTime;
                    if (candidateTime < lastTime)
                        continue;
                    if ((candidateTime - firstTime) > MoneyTrailTimeWindow)
                        continue;
                }

                visited[i] = true;
                currentPath.Add(candidate);
                if (DfsChain(alerts, visited, currentPath, enforceTemporalRules))
                    return true;
                currentPath.RemoveAt(currentPath.Count - 1);
                visited[i] = false;
            }

            return false;
        }

        [HttpPost]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> CreatedCase([FromBody] CreateCaseRequest request)
        {
            var alert = await _appDbContext.Alerts
                .Include(item => item.Transaction)
                .SingleOrDefaultAsync(item => item.AlertId == request.AlertId && item.DeletedAt == null);
            if (alert == null) return this.ApiNotFound("Alert không tồn tại");
            if (alert.CaseId.HasValue) return this.ApiConflict("Alert đã thuộc một Case khác");
            if (alert.Status == AlertStatuses.Closed || alert.Status == AlertStatuses.FalsePositive || alert.Status == AlertStatuses.AwaitingApproval)
                return this.ApiConflict($"Không thể tạo Case khi Alert đang ở trạng thái {alert.Status}");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (alert.AssignedTo != userId) return Forbid();

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.UtcNow;
                var newCase = new Cases
                {
                    CustomerId = alert.Transaction.CustomerId,
                    Status = CaseStatuses.Open,
                    OpenedBy = userId,
                    CreatedAt = now,
                    UpdatedAt = now,
                    MergePattern = "SameCustomer",
                    CorrelationKey = NormalizeAccount(alert.Transaction.NameOrig) ?? $"Customer#{alert.Transaction.CustomerId}"
                };

                _appDbContext.Cases.Add(newCase);
                alert.Case = newCase;
                alert.Status = AlertStatuses.UnderReview;
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "CreateCase",
                    entityType: "Case",
                    entityId: newCase.CaseId,
                    oldStatus: null,
                    newStatus: CaseStatuses.Open,
                    reason: $"Case tạo từ Alert #{alert.AlertId}"
                );

                await dbTransaction.CommitAsync();
                return CreatedAtAction(nameof(GetCaseById), new { id = newCase.CaseId }, new
                {
                    CaseId = newCase.CaseId,
                    AlertIds = new[] { alert.AlertId },
                    Status = newCase.Status,
                    newCase.MergePattern,
                    newCase.CorrelationKey
                });
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogWarning(ex, "Xung đột đồng thời khi tạo Case từ Alert {AlertId}", request.AlertId);
                return this.ApiConflict("Cảnh báo vừa được cập nhật bởi thao tác khác, vui lòng tải lại trang và thử lại.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi tạo Case từ Alert {AlertId}", request.AlertId);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpGet]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> GetCase(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? status = null,
            [FromQuery] string? sortBy = "createdAt",
            [FromQuery] string? sortOrder = "desc")
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var role = User.FindFirst(ClaimTypes.Role)!.Value;

            var (pageValid, pageError) = this.ValidatePagination(page, pageSize);
            if (!pageValid) return pageError!;

            var (sortValid, sortError) = this.ValidateSortBy(sortBy, sortOrder,
                new[] { "createdat", "status" });
            if (!sortValid) return sortError!;

            var query = _appDbContext.Cases
                .Include(c => c.Customer)
                .Include(c => c.OpenedByUser)
                .Include(c => c.Alerts)
                .Where(c => c.DeletedAt == null)
                .AsQueryable();

            if (role == UserRole.Officer.ToString())
                query = query.Where(c => c.OpenedBy == userId);

            if (!string.IsNullOrEmpty(status))
                query = query.Where(c => c.Status == status);

            query = sortBy?.ToLower() switch
            {
                "status" => sortOrder == "asc"
                    ? query.OrderBy(c => c.Status)
                    : query.OrderByDescending(c => c.Status),
                _ => sortOrder == "asc"
                    ? query.OrderBy(c => c.CreatedAt)
                    : query.OrderByDescending(c => c.CreatedAt)
            };

            var totalCount = await query.CountAsync();

            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new CaseResponse
                {
                    CaseId = c.CaseId,
                    CustomerName = c.Customer.FullName,
                    DistinctCustomerCount = c.Alerts
                        .Where(a => a.DeletedAt == null)
                        .Select(a => a.Transaction.CustomerId)
                        .Distinct()
                        .Count(),
                    AlertIds = c.Alerts.Where(a => a.DeletedAt == null).Select(a => a.AlertId).ToList(),
                    Status = c.Status,
                    MergePattern = c.MergePattern,
                    CorrelationKey = c.CorrelationKey,
                    OpenByName = c.OpenedByUser.FullName,
                    CreatedAt = c.CreatedAt,
                    ClosedAt = c.ClosedAt,
                })
                .ToListAsync();

            return Ok(new PagedResult<CaseResponse>
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                Items = items
            });
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> GetCaseById(int id)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var role = User.FindFirst(ClaimTypes.Role)!.Value;

            var query = _appDbContext.Cases
                .AsNoTracking()
                .AsSplitQuery()
                .Where(c => c.CaseId == id && c.DeletedAt == null);

            if (role == UserRole.Officer.ToString())
                query = query.Where(c => c.OpenedBy == userId);

            var result = await query
                .Select(c => new CaseDetailResponse
                {
                    CaseId = c.CaseId,
                    Status = c.Status,
                    MergePattern = c.MergePattern,
                    CorrelationKey = c.CorrelationKey,
                    CustomerId = c.CustomerId,
                    CustomerName = c.Customer.FullName,
                    DistinctCustomerCount = c.Alerts
                        .Where(a => a.DeletedAt == null)
                        .Select(a => a.Transaction.CustomerId)
                        .Distinct()
                        .Count(),
                    OpenedBy = c.OpenedBy,
                    OpenByName = c.OpenedByUser.FullName,
                    CreatedAt = c.CreatedAt,
                    ClosedAt = c.ClosedAt,
                    Alerts = c.Alerts
                        .Where(a => a.DeletedAt == null)
                        .OrderBy(a => a.Transaction.TransactionTime)
                        .ThenBy(a => a.AlertId)
                        .Select(a => new CaseDetailAlert
                        {
                            AlertId = a.AlertId,
                            Status = a.Status,
                            RiskScore = a.RiskScore,
                            RiskLevel = a.RiskLevel,
                            CustomerName = a.Transaction.Customer.FullName,
                            Amount = a.Transaction.Amount,
                            NameOrig = a.Transaction.NameOrig,
                            NameDest = a.Transaction.NameDest,
                            TransactionTime = a.Transaction.TransactionTime
                        })
                        .ToList(),
                    Notes = c.InvestigationNotes
                        .OrderByDescending(n => n.CreatedAt)
                        .Select(n => new CaseDetailNote
                        {
                            InvestigationNoteId = n.InvestigationNoteId,
                            AuthorId = n.AuthorId,
                            AuthorName = c.OpenedByUser.FullName,
                            Content = n.Content,
                            CreatedAt = n.CreatedAt,
                        })
                        .ToList(),
                    Proposals = c.ActionProposals
                        .OrderBy(p => p.CreatedAt)
                        .Select(p => new CaseDetailProposal
                        {
                            CaseActionProposalId = p.CaseActionProposalId,
                            Action = p.Action,
                            Reason = p.Reason,
                            Status = p.Status,
                            ProposedByName = p.ProposedByUser.FullName,
                            DecisionNote = p.DecisionNote,
                            DecidedByName = p.DecidedByUser != null ? p.DecidedByUser.FullName : null,
                            CreatedAt = p.CreatedAt,
                            DecidedAt = p.DecidedAt,
                        })
                        .ToList(),
                })
                .SingleOrDefaultAsync();

            if (result == null) return this.ApiNotFound("Case không tồn tại");

            return Ok(result);
        }

        [HttpPut("{id}/proposals/{proposalId}/approve")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> ApproveProposal(
            int id, int proposalId,
            [FromBody] ManagerProposalDecisionRequest request)
        {
            var caseItem = await _appDbContext.Cases
                .SingleOrDefaultAsync(item => item.CaseId == id && item.DeletedAt == null);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");
            if (caseItem.Status != CaseStatuses.PendingApproval)
                return this.ApiConflict("Case chưa ở trạng thái chờ phê duyệt");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy == userId) return Forbid();

            var decisionNote = request.DecisionNote.Trim();
            if (decisionNote.Length == 0) return this.ApiBadRequest("DecisionNote không được để trống");

            var proposal = await _appDbContext.CaseActionProposals
                .SingleOrDefaultAsync(item => item.CaseId == id && item.CaseActionProposalId == proposalId);
            if (proposal == null) return this.ApiNotFound("Proposal không thuộc Case này hoặc không tồn tại");
            if (proposal.Status != ProposalStatuses.Pending)
                return this.ApiConflict("Proposal đã được quyết định trước đó");

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.UtcNow;
                proposal.Status = ProposalStatuses.Approved;
                proposal.DecidedBy = userId;
                proposal.DecisionNote = decisionNote;
                proposal.DecidedAt = now;
                caseItem.UpdatedAt = now;

                var hasPendingProposal = await _appDbContext.CaseActionProposals
                    .AnyAsync(item =>
                        item.CaseId == id &&
                        item.CaseActionProposalId != proposalId &&
                        item.Status == ProposalStatuses.Pending);

                if (!hasPendingProposal)
                {
                    var approvedActions = await _appDbContext.CaseActionProposals
                        .Where(item =>
                            item.CaseId == id &&
                            item.CaseActionProposalId != proposalId &&
                            item.Status == ProposalStatuses.Approved)
                        .Select(item => item.Action)
                        .ToListAsync();
                    approvedActions.Add(proposal.Action);

                    var isFalsePositive = approvedActions.All(action =>
                        string.Equals(action, "FalsePositive", StringComparison.OrdinalIgnoreCase));
                    var finalAlertStatus = isFalsePositive ? AlertStatuses.FalsePositive : AlertStatuses.Closed;

                    caseItem.Status = CaseStatuses.Approved;
                    caseItem.ClosedAt = now;
                    var alerts = await _appDbContext.Alerts
                        .Where(alert => alert.CaseId == caseItem.CaseId)
                        .ToListAsync();
                    alerts.ForEach(alert => alert.Status = finalAlertStatus);
                }

                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "ApproveProposal",
                    entityType: "Proposal",
                    entityId: proposal.CaseActionProposalId,
                    oldStatus: ProposalStatuses.Pending,
                    newStatus: ProposalStatuses.Approved,
                    reason: decisionNote
                );

                await dbTransaction.CommitAsync();
                return Ok(new
                {
                    Message = hasPendingProposal
                        ? "Proposal đã được Manager phê duyệt; Case vẫn còn Proposal chờ xử lý"
                        : "Proposal đã được Manager phê duyệt và Case đã hoàn tất",
                    CaseId = caseItem.CaseId,
                    ProposalId = proposal.CaseActionProposalId,
                    CaseStatus = caseItem.Status,
                    ProposalStatus = proposal.Status
                });
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogWarning(ex, "Xung đột đồng thời khi approve Proposal {ProposalId} của Case {CaseId}", proposalId, id);
                return this.ApiConflict("Hồ sơ vừa được cập nhật bởi thao tác khác, vui lòng tải lại trang và thử lại.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi approve Proposal {ProposalId} của Case {CaseId}", proposalId, id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpPut("{id}/proposals/{proposalId}/reject")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> RejectProposal(
            int id, int proposalId,
            [FromBody] ManagerProposalDecisionRequest request)
        {
            var caseItem = await _appDbContext.Cases
                .SingleOrDefaultAsync(item => item.CaseId == id && item.DeletedAt == null);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");
            if (caseItem.Status != CaseStatuses.PendingApproval)
                return this.ApiConflict("Case chưa ở trạng thái chờ phê duyệt");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy == userId) return Forbid();

            var decisionNote = request.DecisionNote.Trim();
            if (decisionNote.Length == 0) return this.ApiBadRequest("DecisionNote không được để trống");

            var proposal = await _appDbContext.CaseActionProposals
                .SingleOrDefaultAsync(item => item.CaseId == id && item.CaseActionProposalId == proposalId);
            if (proposal == null) return this.ApiNotFound("Proposal không thuộc Case này hoặc không tồn tại");
            if (proposal.Status != ProposalStatuses.Pending)
                return this.ApiConflict("Proposal đã được quyết định trước đó");

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.UtcNow;
                proposal.Status = ProposalStatuses.Rejected;
                proposal.DecidedBy = userId;
                proposal.DecisionNote = decisionNote;
                proposal.DecidedAt = now;
                caseItem.Status = CaseStatuses.Rework;
                caseItem.UpdatedAt = now;

                var alerts = await _appDbContext.Alerts
                    .Where(alert => alert.CaseId == caseItem.CaseId)
                    .ToListAsync();
                alerts.ForEach(alert => alert.Status = AlertStatuses.UnderReview);

                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "RejectProposal",
                    entityType: "Proposal",
                    entityId: proposal.CaseActionProposalId,
                    oldStatus: ProposalStatuses.Pending,
                    newStatus: ProposalStatuses.Rejected,
                    reason: decisionNote
                );

                await dbTransaction.CommitAsync();
                return Ok(new
                {
                    Message = "Proposal bị từ chối; Case cần được Officer làm lại",
                    CaseId = caseItem.CaseId,
                    ProposalId = proposal.CaseActionProposalId,
                    CaseStatus = caseItem.Status,
                    ProposalStatus = proposal.Status
                });
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogWarning(ex, "Xung đột đồng thời khi reject Proposal {ProposalId} của Case {CaseId}", proposalId, id);
                return this.ApiConflict("Hồ sơ vừa được cập nhật bởi thao tác khác, vui lòng tải lại trang và thử lại.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi reject Proposal {ProposalId} của Case {CaseId}", proposalId, id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpPut("{id}/investigate")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> InvestigateCase(int id)
        {
            var caseItem = await _appDbContext.Cases.SingleOrDefaultAsync(c => c.CaseId == id && c.DeletedAt == null);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            if (caseItem.Status != CaseStatuses.Open && caseItem.Status != CaseStatuses.Rework)
                return this.ApiConflict("Case không ở trạng thái Open");

            var oldStatus = caseItem.Status;

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                caseItem.Status = CaseStatuses.Investigating;
                caseItem.UpdatedAt = DateTime.UtcNow;
                var alerts = await _appDbContext.Alerts
                    .Where(alert => alert.CaseId == caseItem.CaseId)
                    .ToListAsync();
                alerts.ForEach(alert => alert.Status = AlertStatuses.UnderReview);
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "InvestigateCase",
                    entityType: "Case",
                    entityId: caseItem.CaseId,
                    oldStatus: oldStatus,
                    newStatus: CaseStatuses.Investigating
                );

                await dbTransaction.CommitAsync();
                return Ok("Case đang được điều tra");
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogWarning(ex, "Xung đột đồng thời khi investigate Case {CaseId}", id);
                return this.ApiConflict("Hồ sơ vừa được cập nhật bởi thao tác khác, vui lòng tải lại trang và thử lại.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi investigate Case {CaseId}", id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpPost("{id}/notes")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> AddInvestigationNote(int id, [FromBody] CreateInvestigationNoteRequest request)
        {
            var caseItem = await _appDbContext.Cases.SingleOrDefaultAsync(c => c.CaseId == id && c.DeletedAt == null);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            if (caseItem.Status != CaseStatuses.Investigating)
                return this.ApiConflict("Case chưa ở trạng thái đang điều tra");

            var note = new InvestigationNote
            {
                CaseId = id,
                AuthorId = userId,
                Content = request.Content.Trim(),
                CreatedAt = DateTime.UtcNow,
            };

            _appDbContext.InvestigationNotes.Add(note);
            await _appDbContext.SaveChangesAsync();

            await _auditLogService.LogAsync(
                userId: userId,
                action: "AddInvestigationNote",
                entityType: "Case",
                entityId: note.InvestigationNoteId,
                oldStatus: null,
                newStatus: null,
                reason: $"Ghi chú: {request.Content.Trim()[..Math.Min(100, request.Content.Trim().Length)]}"
            );
            return Ok(new { note.InvestigationNoteId, note.CaseId, note.CreatedAt });
        }

        [HttpPost("{id}/proposals")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> AddActionProposal(int id, [FromBody] CreateCaseActionProposalRequest request)
        {
            var caseItem = await _appDbContext.Cases.SingleOrDefaultAsync(c => c.CaseId == id && c.DeletedAt == null);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            if (caseItem.Status != CaseStatuses.Investigating)
                return this.ApiConflict("Chỉ có thể đề xuất hành động khi Case đang điều tra");

            var allowedActions = new[]
            {
                "NoAction", "Monitor", "ContactCustomer", "RestrictTransaction",
                "BlockAccount", "Escalate", "FalsePositive"
            };
            if (!allowedActions.Contains(request.Action, StringComparer.OrdinalIgnoreCase))
                return this.ApiBadRequest("Hành động đề xuất không hợp lệ");

            var proposal = new CaseActionProposal
            {
                CaseId = id,
                ProposedBy = userId,
                Action = request.Action.Trim(),
                Reason = request.Reason.Trim(),
                CreatedAt = DateTime.UtcNow,
            };

            _appDbContext.CaseActionProposals.Add(proposal);
            await _appDbContext.SaveChangesAsync();

            await _auditLogService.LogAsync(
                userId: userId,
                action: "AddActionProposal",
                entityType: "Case",
                entityId: proposal.CaseActionProposalId,
                oldStatus: null,
                reason: $"Đề xuất: {request.Action} - {request.Reason.Trim()[..Math.Min(100, request.Reason.Trim().Length)]}");

            return Ok(new { proposal.CaseActionProposalId, proposal.CaseId, proposal.Action, proposal.Status });
        }

        [HttpPut("{id}/submit-for-approval")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> SubmitForApproval(int id)
        {
            var caseItem = await _appDbContext.Cases
                .Include(item => item.ActionProposals)
                .SingleOrDefaultAsync(item => item.CaseId == id && item.DeletedAt == null);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            if (caseItem.Status != CaseStatuses.Investigating)
                return this.ApiConflict("Case chưa ở trạng thái đang điều tra");

            if (!caseItem.ActionProposals.Any(p => p.Status == ProposalStatuses.Pending))
                return this.ApiBadRequest("Case phải có ít nhất một đề xuất đang chờ duyệt");

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                caseItem.Status = CaseStatuses.PendingApproval;
                caseItem.UpdatedAt = DateTime.UtcNow;
                var alerts = await _appDbContext.Alerts
                    .Where(alert => alert.CaseId == id)
                    .ToListAsync();
                alerts.ForEach(alert => alert.Status = AlertStatuses.AwaitingApproval);
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "SubmitForApproval",
                    entityType: "Case",
                    entityId: caseItem.CaseId,
                    oldStatus: CaseStatuses.Investigating,
                    newStatus: CaseStatuses.PendingApproval
                );

                await dbTransaction.CommitAsync();
                return Ok("Case đã được gửi Manager phê duyệt");
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogWarning(ex, "Xung đột đồng thời khi submit Case {CaseId} for approval", id);
                return this.ApiConflict("Hồ sơ vừa được cập nhật bởi thao tác khác, vui lòng tải lại trang và thử lại.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi submit Case {CaseId} for approval", id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        // Xem trước bằng chứng & kiểu liên kết trước khi xác nhận gộp Alert thành Case
        [HttpPost("merge-preview")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> PreviewMergeAlerts([FromBody] MergePreviewRequest request)
        {
            var distinctIds = request?.AlertIds?.Distinct().ToList() ?? new List<int>();
            if (distinctIds.Count < 2)
                return this.ApiBadRequest("Cần chọn ít nhất 2 cảnh báo để xem trước gộp hồ sơ");

            if (distinctIds.Count > MaxMergeAlerts)
                return this.ApiBadRequest($"Chỉ được phép gộp tối đa {MaxMergeAlerts} cảnh báo trong một lần thao tác");

            var alerts = await _appDbContext.Alerts
                .AsNoTracking()
                .Include(a => a.Transaction)
                    .ThenInclude(t => t.Customer)
                .Where(a => distinctIds.Contains(a.AlertId) && a.DeletedAt == null)
                .ToListAsync();

            if (alerts.Count != distinctIds.Count)
                return this.ApiNotFound("Một hoặc nhiều cảnh báo không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (alerts.Any(a => a.AssignedTo != userId))
                return Forbid();

            if (alerts.Any(a => a.CaseId.HasValue))
                return this.ApiConflict("Có cảnh báo đã thuộc một hồ sơ điều tra khác");

            var allowedStatuses = new[] { AlertStatuses.Assigned, AlertStatuses.UnderReview, AlertStatuses.Reopened };
            if (alerts.Any(a => !allowedStatuses.Contains(a.Status)))
                return this.ApiConflict("Chỉ có thể gộp các cảnh báo đang ở trạng thái Đã phân công, Đang xem xét hoặc Mở lại");

            var evaluation = EvaluateMergePattern(alerts);
            if (!evaluation.IsValid)
                return this.ApiBadRequest(evaluation.ErrorMessage!);

            var orderedAlerts = evaluation.OrderedAlerts;
            var primaryAlert = orderedAlerts.First(a => a.Transaction.CustomerId == evaluation.PrimaryCustomerId);
            var earliestTime = orderedAlerts.Min(a => a.Transaction.TransactionTime);
            var latestTime = orderedAlerts.Max(a => a.Transaction.TransactionTime);
            var highestRiskAlert = orderedAlerts.OrderByDescending(a => a.RiskScore).First();

            return Ok(new
            {
                IsValid = true,
                MergePattern = evaluation.Pattern,
                CorrelationKey = evaluation.CorrelationKey,
                MatchReason = evaluation.MatchReason,
                PrimaryCustomerId = evaluation.PrimaryCustomerId,
                PrimaryCustomerName = primaryAlert.Transaction.Customer.FullName,
                DistinctCustomerCount = orderedAlerts.Select(a => a.Transaction.CustomerId).Distinct().Count(),
                AlertCount = orderedAlerts.Count,
                TotalAmount = orderedAlerts.Sum(a => a.Transaction.Amount),
                HighestRiskScore = highestRiskAlert.RiskScore,
                HighestRiskLevel = highestRiskAlert.RiskLevel,
                EarliestTransactionTime = earliestTime,
                LatestTransactionTime = latestTime,
                Alerts = orderedAlerts.Select(a => new
                {
                    a.AlertId,
                    a.Transaction.CustomerId,
                    CustomerName = a.Transaction.Customer.FullName,
                    NameOrig = NormalizeAccount(a.Transaction.NameOrig),
                    NameDest = NormalizeAccount(a.Transaction.NameDest),
                    a.Transaction.Amount,
                    a.RiskScore,
                    a.RiskLevel,
                    a.Transaction.TransactionTime
                })
            });
        }

        // Gộp 2 hoặc nhiều Alert theo 1 trong 3 kiểu: SameCustomer | SameDestination | MoneyTrail
        [HttpPost("merge")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> MergeAlertsIntoCase([FromBody] MergeAlertsRequest request)
        {
            var distinctIds = request?.AlertIds?.Distinct().ToList() ?? new List<int>();
            if (distinctIds.Count < 2)
                return this.ApiBadRequest("Cần chọn ít nhất 2 cảnh báo để gộp thành một hồ sơ chung");

            if (distinctIds.Count > MaxMergeAlerts)
                return this.ApiBadRequest($"Chỉ được phép gộp tối đa {MaxMergeAlerts} cảnh báo trong một lần thao tác");

            var (reasonValid, normalizedReason, reasonError) = ValidateReason(request?.Reason);
            if (!reasonValid)
                return this.ApiBadRequest(reasonError!);

            var alerts = await _appDbContext.Alerts
                .Include(a => a.Transaction)
                .Where(a => distinctIds.Contains(a.AlertId) && a.DeletedAt == null)
                .ToListAsync();

            if (alerts.Count != distinctIds.Count)
                return this.ApiNotFound("Một hoặc nhiều cảnh báo không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (alerts.Any(a => a.AssignedTo != userId))
                return Forbid();

            if (alerts.Any(a => a.CaseId.HasValue))
                return this.ApiConflict("Có cảnh báo đã thuộc một hồ sơ điều tra khác");

            var allowedStatuses = new[] { AlertStatuses.Assigned, AlertStatuses.UnderReview, AlertStatuses.Reopened };
            if (alerts.Any(a => !allowedStatuses.Contains(a.Status)))
                return this.ApiConflict("Chỉ có thể gộp các cảnh báo đang ở trạng thái Đã phân công, Đang xem xét hoặc Mở lại");

            var evaluation = EvaluateMergePattern(alerts);
            if (!evaluation.IsValid)
                return this.ApiBadRequest(evaluation.ErrorMessage!);

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.UtcNow;
                var newCase = new Cases
                {
                    CustomerId = evaluation.PrimaryCustomerId,
                    Status = CaseStatuses.Open,
                    OpenedBy = userId,
                    CreatedAt = now,
                    UpdatedAt = now,
                    MergePattern = evaluation.Pattern,
                    CorrelationKey = evaluation.CorrelationKey
                };

                _appDbContext.Cases.Add(newCase);
                foreach (var alert in alerts)
                {
                    alert.Case = newCase;
                    alert.Status = AlertStatuses.UnderReview;
                }

                await _appDbContext.SaveChangesAsync();

                var joinedIds = string.Join(", ", distinctIds.OrderBy(x => x).Select(x => $"#{x}"));
                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "MergeAlertsToCase",
                    entityType: "Case",
                    entityId: newCase.CaseId,
                    oldStatus: null,
                    newStatus: CaseStatuses.Open,
                    reason: $"Gộp {alerts.Count} cảnh báo ({joinedIds}) [{evaluation.Pattern}: {evaluation.CorrelationKey}] | Lý do: {normalizedReason}"
                );

                await dbTransaction.CommitAsync();
                return CreatedAtAction(nameof(GetCaseById), new { id = newCase.CaseId }, new
                {
                    CaseId = newCase.CaseId,
                    AlertIds = distinctIds,
                    Status = newCase.Status,
                    newCase.MergePattern,
                    newCase.CorrelationKey
                });
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogWarning(ex, "Xung đột đồng thời khi gộp Alert vào Case mới");
                return this.ApiConflict("Một hoặc nhiều cảnh báo vừa được xử lý bởi thao tác khác, vui lòng tải lại danh sách và thử lại.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi gộp nhiều Alert vào Case mới");
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        // Gắn thêm 1 Alert vào Case đang mở (bảo vệ đồng thời bằng RowVersion trên cả Alert và Cases)
        [HttpPost("{id:int}/alerts")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> AddAlertToCase(int id, [FromBody] AddAlertToCaseRequest request)
        {
            var (reasonValid, normalizedReason, reasonError) = ValidateReason(request?.Reason);
            if (!reasonValid)
                return this.ApiBadRequest(reasonError!);

            var caseItem = await _appDbContext.Cases
                .Include(c => c.Alerts)
                    .ThenInclude(a => a.Transaction)
                .SingleOrDefaultAsync(c => c.CaseId == id && c.DeletedAt == null);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            var editableStatuses = new[] { CaseStatuses.Open, CaseStatuses.Investigating, CaseStatuses.Rework };
            if (!editableStatuses.Contains(caseItem.Status))
                return this.ApiConflict($"Không thể thêm cảnh báo khi hồ sơ đang ở trạng thái {caseItem.Status}");

            var existingAlerts = caseItem.Alerts.Where(a => a.DeletedAt == null).ToList();
            if (existingAlerts.Count + 1 > MaxMergeAlerts)
                return this.ApiBadRequest($"Mỗi hồ sơ điều tra chỉ hỗ trợ tối đa {MaxMergeAlerts} cảnh báo liên quan");

            var alert = await _appDbContext.Alerts
                .Include(a => a.Transaction)
                .SingleOrDefaultAsync(a => a.AlertId == request!.AlertId && a.DeletedAt == null);
            if (alert == null) return this.ApiNotFound("Alert không tồn tại");

            if (alert.CaseId.HasValue)
                return this.ApiConflict("Alert này đã thuộc một hồ sơ điều tra khác");

            if (alert.AssignedTo != userId)
                return Forbid();

            var allowedAlertStatuses = new[] { AlertStatuses.Assigned, AlertStatuses.UnderReview, AlertStatuses.Reopened };
            if (!allowedAlertStatuses.Contains(alert.Status))
                return this.ApiConflict($"Không thể gộp cảnh báo khi đang ở trạng thái {alert.Status}");

            var combined = existingAlerts.Append(alert).ToList();
            var evaluation = EvaluateMergePattern(combined);

            if (!evaluation.IsValid)
                return this.ApiBadRequest(evaluation.ErrorMessage!);

            if (existingAlerts.Count >= 2 && !string.Equals(caseItem.MergePattern, evaluation.Pattern, StringComparison.OrdinalIgnoreCase))
                return this.ApiBadRequest($"Hồ sơ hiện tại đang gom nhóm theo kiểu {caseItem.MergePattern}; cảnh báo này không khớp cùng quy tắc");

            if (evaluation.Pattern == "SameCustomer" && alert.Transaction.CustomerId != caseItem.CustomerId)
                return this.ApiBadRequest("Hồ sơ theo khách hàng không thể gộp cảnh báo của khách hàng khác");

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                alert.CaseId = caseItem.CaseId;
                alert.Status = AlertStatuses.UnderReview;
                caseItem.MergePattern = evaluation.Pattern;
                caseItem.CorrelationKey = evaluation.CorrelationKey;
                // Cập nhật UpdatedAt để EF Core luôn sinh UPDATE Cases và kiểm tra Cases.RowVersion
                caseItem.UpdatedAt = DateTime.UtcNow;

                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "AddAlertToCase",
                    entityType: "Case",
                    entityId: caseItem.CaseId,
                    oldStatus: null,
                    newStatus: null,
                    reason: $"Gộp thêm Alert #{alert.AlertId} vào Case #{caseItem.CaseId} [{evaluation.Pattern}: {evaluation.CorrelationKey}] | Lý do: {normalizedReason}"
                );

                await dbTransaction.CommitAsync();
                return Ok(new
                {
                    Message = $"Đã gộp cảnh báo #{alert.AlertId} vào hồ sơ #{caseItem.CaseId} ({evaluation.MatchReason})",
                    CaseId = caseItem.CaseId,
                    AlertId = alert.AlertId,
                    caseItem.MergePattern,
                    caseItem.CorrelationKey
                });
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogWarning(ex, "Xung đột đồng thời khi thêm Alert {AlertId} vào Case {CaseId}", request!.AlertId, id);
                return this.ApiConflict("Hồ sơ hoặc cảnh báo vừa được cập nhật bởi thao tác khác, vui lòng tải lại trang và thử lại.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi thêm Alert {AlertId} vào Case {CaseId}", request!.AlertId, id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        // Gỡ 1 Alert khỏi Case đang mở (từ chối tách nếu tập alert còn lại mất liên kết hợp lệ)
        [HttpPost("{id:int}/alerts/{alertId:int}/unmerge")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> UnmergeAlertFromCase(int id, int alertId, [FromBody] UnmergeAlertFromCaseRequest request)
        {
            var (reasonValid, normalizedReason, reasonError) = ValidateReason(request?.Reason);
            if (!reasonValid)
                return this.ApiBadRequest(reasonError!);

            var caseItem = await _appDbContext.Cases
                .Include(c => c.Alerts)
                    .ThenInclude(a => a.Transaction)
                .SingleOrDefaultAsync(c => c.CaseId == id && c.DeletedAt == null);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            var editableStatuses = new[] { CaseStatuses.Open, CaseStatuses.Investigating, CaseStatuses.Rework };
            if (!editableStatuses.Contains(caseItem.Status))
                return this.ApiConflict($"Không thể tách cảnh báo khi hồ sơ đang ở trạng thái {caseItem.Status}");

            var activeAlerts = caseItem.Alerts.Where(a => a.DeletedAt == null).ToList();
            var targetAlert = activeAlerts.FirstOrDefault(a => a.AlertId == alertId);
            if (targetAlert == null)
                return this.ApiNotFound("Cảnh báo không thuộc hồ sơ này");

            if (activeAlerts.Count <= 1)
                return this.ApiConflict("Hồ sơ phải giữ lại ít nhất 1 cảnh báo. Không thể tách cảnh báo duy nhất.");

            var remainingAlerts = activeAlerts.Where(a => a.AlertId != alertId).ToList();

            // Kiểm tra tính toàn vẹn liên kết của phần còn lại trước khi mở transaction
            MergeEvaluationResult? remainingEval = null;
            if (remainingAlerts.Count >= 2)
            {
                remainingEval = EvaluateMergePattern(remainingAlerts);
                if (!remainingEval.IsValid)
                {
                    return this.ApiConflict(
                        $"Không thể tách cảnh báo #{alertId} vì các cảnh báo còn lại sẽ không còn điểm chung hoặc bị đứt chuỗi liên kết ({remainingEval.ErrorMessage})"
                    );
                }
            }

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                targetAlert.CaseId = null;
                targetAlert.Status = AlertStatuses.Assigned;

                if (remainingAlerts.Count == 1)
                {
                    var soleTx = remainingAlerts[0].Transaction;
                    caseItem.MergePattern = "SameCustomer";
                    caseItem.CorrelationKey = NormalizeAccount(soleTx.NameOrig) ?? $"Customer#{soleTx.CustomerId}";
                }
                else if (remainingEval != null)
                {
                    caseItem.MergePattern = remainingEval.Pattern;
                    caseItem.CorrelationKey = remainingEval.CorrelationKey;
                }

                // Cập nhật UpdatedAt để EF Core kiểm tra Cases.RowVersion
                caseItem.UpdatedAt = DateTime.UtcNow;

                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "UnmergeAlertFromCase",
                    entityType: "Case",
                    entityId: caseItem.CaseId,
                    oldStatus: null,
                    newStatus: null,
                    reason: $"Tách Alert #{alertId} khỏi Case #{caseItem.CaseId} (trả về Assigned) | Lý do: {normalizedReason}"
                );

                await dbTransaction.CommitAsync();
                return Ok(new
                {
                    Message = $"Đã tách cảnh báo #{alertId} khỏi hồ sơ #{caseItem.CaseId}",
                    CaseId = caseItem.CaseId,
                    RemovedAlertId = alertId,
                    caseItem.MergePattern,
                    caseItem.CorrelationKey
                });
            }
            catch (DbUpdateConcurrencyException ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogWarning(ex, "Xung đột đồng thời khi tách Alert {AlertId} khỏi Case {CaseId}", alertId, id);
                return this.ApiConflict("Dữ liệu vừa được cập nhật bởi thao tác khác, vui lòng tải lại trang.");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi tách Alert {AlertId} khỏi Case {CaseId}", alertId, id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        // Gợi ý các Case đang mở có thể nhận thêm Alert này
        [HttpGet("open-for-alert/{alertId:int}")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> GetOpenCasesForAlert(int alertId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var targetAlert = await _appDbContext.Alerts
                .AsNoTracking()
                .Include(a => a.Transaction)
                .FirstOrDefaultAsync(a => a.AlertId == alertId && a.DeletedAt == null);

            if (targetAlert == null) return this.ApiNotFound("Alert không tồn tại");

            var openStatuses = new[] { CaseStatuses.Open, CaseStatuses.Investigating, CaseStatuses.Rework };
            var activeCases = await _appDbContext.Cases
                .AsNoTracking()
                .Include(c => c.Alerts.Where(a => a.DeletedAt == null))
                    .ThenInclude(a => a.Transaction)
                .Where(c => c.DeletedAt == null
                    && c.OpenedBy == userId
                    && openStatuses.Contains(c.Status))
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            var matchedCases = new List<object>();
            foreach (var c in activeCases)
            {
                var existing = c.Alerts.ToList();
                if (existing.Count >= MaxMergeAlerts) continue;

                var eval = EvaluateMergePattern(existing.Append(targetAlert).ToList());
                if (!eval.IsValid) continue;
                if (existing.Count >= 2 && !string.Equals(c.MergePattern, eval.Pattern, StringComparison.OrdinalIgnoreCase))
                    continue;

                matchedCases.Add(new
                {
                    c.CaseId,
                    c.Status,
                    c.CreatedAt,
                    AlertCount = existing.Count,
                    MergePattern = eval.Pattern,
                    MatchReason = eval.MatchReason
                });
            }

            return Ok(matchedCases);
        }

        // Lấy danh sách Alert khả dụng để gộp thêm vào Case hiện tại
        [HttpGet("{id:int}/candidate-alerts")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> GetCandidateAlertsForCase(int id)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var caseItem = await _appDbContext.Cases
                .AsNoTracking()
                .Include(c => c.Alerts.Where(a => a.DeletedAt == null))
                    .ThenInclude(a => a.Transaction)
                .FirstOrDefaultAsync(c => c.CaseId == id && c.DeletedAt == null && c.OpenedBy == userId);

            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var existing = caseItem.Alerts.ToList();
            if (existing.Count >= MaxMergeAlerts)
                return Ok(Array.Empty<object>());

            var allowedStatuses = new[] { AlertStatuses.Assigned, AlertStatuses.UnderReview, AlertStatuses.Reopened };
            var unassignedAlerts = await _appDbContext.Alerts
                .AsNoTracking()
                .Include(a => a.Transaction)
                    .ThenInclude(t => t.Customer)
                .Where(a => a.DeletedAt == null
                    && a.CaseId == null
                    && a.AssignedTo == userId
                    && allowedStatuses.Contains(a.Status))
                .OrderByDescending(a => a.CreatedAt)
                .Take(200)
                .ToListAsync();

            var candidates = new List<object>();

            foreach (var candidate in unassignedAlerts)
            {
                var eval = EvaluateMergePattern(existing.Append(candidate).ToList());
                if (!eval.IsValid) continue;
                if (existing.Count >= 2 && !string.Equals(caseItem.MergePattern, eval.Pattern, StringComparison.OrdinalIgnoreCase))
                    continue;

                candidates.Add(new
                {
                    candidate.AlertId,
                    candidate.RiskScore,
                    candidate.RiskLevel,
                    candidate.Status,
                    CustomerName = candidate.Transaction.Customer.FullName,
                    NameOrig = NormalizeAccount(candidate.Transaction.NameOrig),
                    NameDest = NormalizeAccount(candidate.Transaction.NameDest),
                    Amount = candidate.Transaction.Amount,
                    candidate.CreatedAt,
                    MatchPattern = eval.Pattern,
                    MatchReason = eval.MatchReason
                });
            }

            return Ok(candidates);
        }
    }
}