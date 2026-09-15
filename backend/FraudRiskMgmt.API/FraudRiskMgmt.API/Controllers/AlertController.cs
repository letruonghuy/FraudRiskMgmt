using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
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
    public class AlertController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;
        private readonly AuditLogService _auditLogService;

        public AlertController(AppDbContext appDbContext, AuditLogService auditLogService)
        {
            _appDbContext = appDbContext;
            _auditLogService = auditLogService;
        }

        [HttpGet]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> GetAlert()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)!.Value;

            var alertQuery = _appDbContext.Alerts
                .Include(a => a.Transaction)
                .Include(a => a.Transaction.Customer)
                .AsQueryable();

            if (role == UserRole.Officer.ToString())
            {
                alertQuery = alertQuery.Where(a => a.AssignedTo == userId);
            }

            var alert = await alertQuery.ToListAsync();

            var result = alert.Select(static a => new AlertResponse
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
            }).ToList();

           
            
            return Ok(result);
        }

        [HttpPut("{id}/assign")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> AssignAlert(int id, [FromBody] AssignAlertRequest request)
        {
            var alert = await _appDbContext.Alerts.FindAsync(id);
            if (alert == null)
            {
                return NotFound("Alert không tồn tại");
            }
            
            var assignableStatuses = new[] { AlertStatuses.New, AlertStatuses.Assigned };
            if (!assignableStatuses.Contains(alert.Status))
            {
                return Conflict($"Alert không thể phân công khi ở trạng thái {alert.Status}");
            }

            var officerExists = await _appDbContext.Users
                .AnyAsync(user => user.UserId == request.OfficerId && user.Role == UserRole.Officer);
            if (!officerExists)
            {
                return BadRequest("Officer không tồn tại hoặc không có vai trò phù hợp");
            }

            var oldStatus = alert.Status;
            alert.AssignedTo = request.OfficerId;
            alert.Status = AlertStatuses.Assigned;

            await _appDbContext.SaveChangesAsync();

            await _auditLogService.LogAsync(
                userId: int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value),
                action: "AssignAlert",
                entityType: "Alert",
                entityId: alert.AlertId,
                oldStatus: oldStatus,
                newStatus: AlertStatuses.Assigned,
                reason: $"Assigned to Officer {request.OfficerId}"
            );

            return Ok("Phân công alert cho Officer thành công");
        }

        [HttpPut("{id}/accept")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> AcceptAlert(int id)
        {
            var alert = await _appDbContext.Alerts.FindAsync(id);
            if (alert == null)
            {
                return NotFound("Alert không tồn tại");
            }

            if (alert.Status != AlertStatuses.New || alert.AssignedTo.HasValue)
            {
                return Conflict("Alert không còn ở trạng thái chờ nhận");
            }

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
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
                reason: "Officer tự nhận alert");

            return Ok("Officer đã tự nhận alert");
        }

        [HttpPut("{id}/close")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> CloseAlert(int id, [FromBody] CloseAlertRequest request)
        {
            var alert = await _appDbContext.Alerts.FindAsync(id);
            if (alert == null)
            {
                return NotFound("Alert không tồn tại");
            }

            
            var closableStatuses = new[] { AlertStatuses.Assigned, AlertStatuses.UnderReview };
            if (!closableStatuses.Contains(alert.Status))
            {
                return Conflict($"Alert không thể đóng khi ở trạng thái {alert.Status}");
            }

            if (alert.CaseId.HasValue)
            {
                return Conflict("Alert đã thuộc một Case; hãy xử lý qua Case");
            }

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (alert.AssignedTo != userId)
            {
                return Forbid();
            }

            if (request.Resolution == "FalsePositive")
            {
                var oldStatus = alert.Status;
                alert.Status = AlertStatuses.FalsePositive;
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "CloseAlert",
                    entityType: "Alert",
                    entityId: alert.AlertId,
                    oldStatus: oldStatus,
                    newStatus: AlertStatuses.FalsePositive,
                    reason: "False Positive"
                );

                return Ok("Alert đã đóng - Cảnh báo giả");
            }
            else if (request.Resolution == "Escalate")
            {
                var oldStatus = alert.Status;
                alert.Status = AlertStatuses.AwaitingApproval;
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "EscalateAlert",
                    entityType: "Alert",
                    entityId: alert.AlertId,
                    oldStatus: oldStatus,
                    newStatus: AlertStatuses.AwaitingApproval,
                    reason: "Escalated to Manager"
                );
                return Ok("Alert đã xử lý - Chờ Manager duyệt");

            }
            else
            {
                return BadRequest("Giải pháp không phù hợp");
            }
        }
    }
}
