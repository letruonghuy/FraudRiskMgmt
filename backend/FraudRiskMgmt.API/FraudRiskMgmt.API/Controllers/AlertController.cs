using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Models;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FraudRiskMgmt.API.Extensions;

namespace FraudRiskMgmt.API.Controllers
{
    [Authorize(Roles = "Officer,Manager")]
    [Route("api/[controller]")]
    [ApiController]
    public class AlertController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;
        private readonly AuditLogService _auditLogService;
        private readonly ILogger<AlertController> _logger;

        public AlertController(
            AppDbContext appDbContext,
            AuditLogService auditLogService,
            ILogger<AlertController> logger)
        {
            _appDbContext = appDbContext;
            _auditLogService = auditLogService;
            _logger = logger;
        }

        // Officer thấy: Alert của mình + Alert trong hàng đợi (New, chưa ai phụ trách).
        // Alert do Officer khác phụ trách thì không thấy. Manager thấy tất cả.
        private IQueryable<Alert> ApplyOfficerVisibility(IQueryable<Alert> query, int userId, string role)
        {
            if (role != UserRole.Officer.ToString()) return query;
            return query.Where(a => a.AssignedTo == userId ||
                (a.AssignedTo == null && a.Status == AlertStatuses.New));
        }

        [HttpGet]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> GetAlert(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? status = null,
            [FromQuery] string? riskLevel = null,
            [FromQuery] string? search = null,
            [FromQuery] string? scope = null,   // queue | mine | assigned
            [FromQuery] string? sortBy = "createdAt",
            [FromQuery] string? sortOrder = "desc")
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var role = User.FindFirst(ClaimTypes.Role)!.Value;

            var (pageValid, pageError) = this.ValidatePagination(page, pageSize);
            if (!pageValid) return pageError!;

            var (sortValid, sortError) = this.ValidateSortBy(sortBy, sortOrder,
                new[] { "createdat", "riskscore", "amount" });
            if (!sortValid) return sortError!;

            var query = _appDbContext.Alerts
                .AsNoTracking()
                .Where(a => a.DeletedAt == null);

            query = ApplyOfficerVisibility(query, userId, role);

            query = scope?.ToLower() switch
            {
                "queue" => query.Where(a => a.AssignedTo == null && a.Status == AlertStatuses.New),
                "mine" => query.Where(a => a.AssignedTo == userId),
                "assigned" => query.Where(a => a.AssignedTo != null),
                _ => query
            };

            if (!string.IsNullOrEmpty(status))
                query = query.Where(a => a.Status == status);

            if (!string.IsNullOrEmpty(riskLevel))
                query = query.Where(a => a.RiskLevel == riskLevel);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var keyword = search.Trim();
                query = int.TryParse(keyword.TrimStart('#'), out var searchId)
                    ? query.Where(a => a.AlertId == searchId || a.Transaction.Customer!.FullName.Contains(keyword))
                    : query.Where(a => a.Transaction.Customer!.FullName.Contains(keyword));
            }

            query = sortBy?.ToLower() switch
            {
                "riskscore" => sortOrder == "asc"
                    ? query.OrderBy(a => a.RiskScore)
                    : query.OrderByDescending(a => a.RiskScore),
                "amount" => sortOrder == "asc"
                    ? query.OrderBy(a => a.Transaction.Amount)
                    : query.OrderByDescending(a => a.Transaction.Amount),
                _ => sortOrder == "asc"
                    ? query.OrderBy(a => a.CreatedAt)
                    : query.OrderByDescending(a => a.CreatedAt)
            };

            var totalCount = await query.CountAsync();

            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new AlertResponse
                {
                    AlertId = a.AlertId,
                    CustomerName = a.Transaction.Customer!.FullName,
                    RiskScore = a.RiskScore,
                    RiskLevel = a.RiskLevel,
                    Status = a.Status,
                    AssignedTo = a.AssignedTo,
                    AssignedToName = a.AssignedToUser == null ? null : a.AssignedToUser.FullName,
                    CaseId = a.CaseId,
                    Amount = a.Transaction.Amount,
                    CreateAt = a.CreatedAt
                })
                .ToListAsync();

            return Ok(new PagedResult<AlertResponse>
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                Items = items
            });
        }

        // (Khôi phục) Chi tiết Alert: trang /alerts/:id và ngăn xem nhanh đều dùng endpoint này
        [HttpGet("{id:int}")]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> GetAlertDetail(int id)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var role = User.FindFirst(ClaimTypes.Role)!.Value;

            var query = _appDbContext.Alerts
                .AsNoTracking()
                .Where(alert => alert.AlertId == id && alert.DeletedAt == null);

            // Alert do Officer khác phụ trách → trả 404 (giống Case) để không lộ sự tồn tại
            query = ApplyOfficerVisibility(query, userId, role);

            var result = await query
                .Select(alert => new AlertDetailResponse
                {
                    AlertId = alert.AlertId,
                    TransactionId = alert.TransactionId,
                    CustomerName = alert.Transaction.Customer!.FullName,
                    CustomerAccountNumber = alert.Transaction.Customer.AccountNumber,
                    RiskScore = alert.RiskScore,
                    RiskLevel = alert.RiskLevel,
                    Status = alert.Status,
                    AssignedTo = alert.AssignedTo,
                    AssignedToName = alert.AssignedToUser == null ? null : alert.AssignedToUser.FullName,
                    CaseId = alert.CaseId,
                    Amount = alert.Transaction.Amount,
                    CreatedAt = alert.CreatedAt,
                    TransactionType = alert.Transaction.TransactionType,
                    TransactionTime = alert.Transaction.TransactionTime,
                    Hour = alert.Transaction.Hour,
                    NameOrig = alert.Transaction.NameOrig,
                    NameDest = alert.Transaction.NameDest,
                    OldBalanceOrg = alert.Transaction.OldBalanceOrg,
                    NewBalanceOrig = alert.Transaction.NewBalanceOrig,
                    OldBalanceDest = alert.Transaction.OldBalanceDest,
                    NewBalanceDest = alert.Transaction.NewBalanceDest
                })
                .SingleOrDefaultAsync();

            if (result == null) return this.ApiNotFound("Alert không tồn tại");

            return Ok(result);
        }

        [HttpPut("{id}/assign")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> AssignAlert(int id, [FromBody] AssignAlertRequest request)
        {
            var alert = await _appDbContext.Alerts.FindAsync(id);
            if (alert == null) return this.ApiNotFound("Alert không tồn tại");

            var assignableStatuses = new[] { AlertStatuses.New, AlertStatuses.Assigned };
            if (!assignableStatuses.Contains(alert.Status))
                return this.ApiConflict($"Alert không thể phân công khi ở trạng thái {alert.Status}");

            var officerExists = await _appDbContext.Users
                .AnyAsync(user => user.UserId == request.OfficerId && user.Role == UserRole.Officer && user.DeletedAt == null);
            if (!officerExists)
                return this.ApiBadRequest("Officer không tồn tại hoặc không có vai trò phù hợp");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var oldStatus = alert.Status;

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                alert.AssignedTo = request.OfficerId;
                alert.Status = AlertStatuses.Assigned;
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "AssignAlert",
                    entityType: "Alert",
                    entityId: alert.AlertId,
                    oldStatus: oldStatus,
                    newStatus: AlertStatuses.Assigned,
                    reason: $"Assigned to Officer {request.OfficerId}"
                );

                await dbTransaction.CommitAsync();
                return Ok("Phân công alert cho Officer thành công");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi assign Alert {AlertId}", id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpPut("{id}/accept")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> AcceptAlert(int id)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                // UPDATE có điều kiện chạy như một câu lệnh duy nhất: nếu hai Officer bấm nhận cùng lúc
                // thì chỉ một người cập nhật được dòng (người kia nhận 0 dòng → 409).
                var updated = await _appDbContext.Alerts
                    .Where(a => a.AlertId == id
                        && a.DeletedAt == null
                        && a.Status == AlertStatuses.New
                        && a.AssignedTo == null)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(a => a.AssignedTo, (int?)userId)
                        .SetProperty(a => a.Status, AlertStatuses.Assigned));

                if (updated == 0)
                {
                    await dbTransaction.RollbackAsync();
                    var exists = await _appDbContext.Alerts.AnyAsync(a => a.AlertId == id && a.DeletedAt == null);
                    return exists
                        ? this.ApiConflict("Alert không còn ở trạng thái chờ nhận")
                        : this.ApiNotFound("Alert không tồn tại");
                }

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "AcceptAlert",
                    entityType: "Alert",
                    entityId: id,
                    oldStatus: AlertStatuses.New,
                    newStatus: AlertStatuses.Assigned,
                    reason: "Officer tự nhận alert"
                );

                await dbTransaction.CommitAsync();
                return Ok("Officer đã tự nhận alert");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi accept Alert {AlertId}", id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpPut("{id}/close")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> CloseAlert(int id, [FromBody] CloseAlertRequest request)
        {
            var alert = await _appDbContext.Alerts.FindAsync(id);
            if (alert == null) return this.ApiNotFound("Alert không tồn tại");

            var closableStatuses = new[] { AlertStatuses.Assigned, AlertStatuses.UnderReview };
            if (!closableStatuses.Contains(alert.Status))
                return this.ApiConflict($"Alert không thể đóng khi ở trạng thái {alert.Status}");

            if (alert.CaseId.HasValue)
                return this.ApiConflict("Alert đã thuộc một Case; hãy xử lý qua Case");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (alert.AssignedTo != userId) return Forbid();

            if (request.Resolution != "FalsePositive" && request.Resolution != "Escalate")
                return this.ApiBadRequest("Giải pháp không phù hợp");

            var oldStatus = alert.Status;
            var newStatus = request.Resolution == "FalsePositive"
                ? AlertStatuses.FalsePositive
                : AlertStatuses.AwaitingApproval;

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                alert.Status = newStatus;
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: request.Resolution == "FalsePositive" ? "CloseAlert" : "EscalateAlert",
                    entityType: "Alert",
                    entityId: alert.AlertId,
                    oldStatus: oldStatus,
                    newStatus: newStatus,
                    reason: request.Resolution == "FalsePositive" ? "False Positive" : "Escalated to Manager"
                );

                await dbTransaction.CommitAsync();
                return Ok(request.Resolution == "FalsePositive"
                    ? "Alert đã đóng - Cảnh báo giả"
                    : "Alert đã xử lý - Chờ Manager duyệt");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi close Alert {AlertId} với resolution {Resolution}", id, request.Resolution);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }
    }
}