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

        [HttpGet]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> GetAlert(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? status = null,
            [FromQuery] string? riskLevel = null,
            [FromQuery] string? sortBy = "createdAt",
            [FromQuery] string? sortOrder = "desc")
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var role = User.FindFirst(ClaimTypes.Role)!.Value;

            var (pageValid, pageError) = this.ValidatePagination(page, pageSize);
            if (!pageValid) return pageError!;

            var (sortValid, sortError) = this.ValidateSortBy(sortBy, sortOrder,
                new[] { "createdat", "riskscore", "amount" }); // Alert
                                                               // new[] { "createdat", "status" });            // Case
            if (!sortValid) return sortError!;

            var query = _appDbContext.Alerts
                .Include(a => a.Transaction)
                .Include(a => a.Transaction.Customer)
                .AsQueryable();

            if (role == UserRole.Officer.ToString())
                query = query.Where(a => a.AssignedTo == userId);

            if (!string.IsNullOrEmpty(status))
                query = query.Where(a => a.Status == status);

            if (!string.IsNullOrEmpty(riskLevel))
                query = query.Where(a => a.RiskLevel == riskLevel);

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
                .AnyAsync(user => user.UserId == request.OfficerId && user.Role == UserRole.Officer);
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
            var alert = await _appDbContext.Alerts.FindAsync(id);
            if (alert == null) return this.ApiNotFound("Alert không tồn tại");

            if (alert.Status != AlertStatuses.New || alert.AssignedTo.HasValue)
                return this.ApiConflict("Alert không còn ở trạng thái chờ nhận");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                alert.AssignedTo = userId;
                alert.Status = AlertStatuses.Assigned;
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "AcceptAlert",
                    entityType: "Alert",
                    entityId: alert.AlertId,
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