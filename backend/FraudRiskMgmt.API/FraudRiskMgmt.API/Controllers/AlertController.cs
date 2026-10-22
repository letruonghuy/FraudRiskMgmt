using System.Security.Claims;
using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class AlertController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;

        public AlertController(AppDbContext appDbContext)
        {
            _appDbContext = appDbContext;
        }

        [HttpGet]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> GetAlert()
        {
            var result = await _appDbContext.Alerts
                .AsNoTracking()
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

            return Ok(result);
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> GetAlertDetail(int id)
        {
            var result = await _appDbContext.Alerts
                .AsNoTracking()
                .Where(alert => alert.AlertId == id)
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
                    NameOrig = alert.Transaction.NameOrig,
                    NameDest = alert.Transaction.NameDest,
                    OldBalanceOrg = alert.Transaction.OldBalanceOrg,
                    NewBalanceOrig = alert.Transaction.NewBalanceOrig,
                    OldBalanceDest = alert.Transaction.OldBalanceDest,
                    NewBalanceDest = alert.Transaction.NewBalanceDest
                })
                .SingleOrDefaultAsync();

            if (result == null)
            {
                return NotFound(new { message = "Alert không tồn tại" });
            }

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

            var officer = await _appDbContext.Users.FindAsync(request.OfficerId);
            if (officer == null || officer.Role != UserRole.Officer)
            {
                return BadRequest("Officer không hợp lệ");
            }

            alert.AssignedTo = request.OfficerId;
            alert.Status = AlertStatuses.Assigned;

            await _appDbContext.SaveChangesAsync();
            return Ok(new { Message = "Assign thành công", AlertId = alert.AlertId, AssignedTo = request.OfficerId });
        }

        [HttpPut("{id}/close")]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> CloseAlert(int id, [FromBody] CloseAlertRequest request)
        {
            var alert = await _appDbContext.Alerts
                .Include(a => a.AssignedToUser)
                .SingleOrDefaultAsync(a => a.AlertId == id);

            if (alert == null)
            {
                return NotFound("Alert không tồn tại");
            }

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = User.FindFirst(ClaimTypes.Role)?.Value;

            if (role == UserRole.Officer.ToString() && alert.AssignedTo != null && alert.AssignedTo != userId)
            {
                return Forbid();
            }

            if (request.Resolution == "FalsePositive")
            {
                alert.Status = AlertStatuses.FalsePositive;
                alert.AssignedTo = null;
                await _appDbContext.SaveChangesAsync();
                return Ok("Alert đã đóng - Cảnh báo giả");
            }
            else if (request.Resolution == "Escalate")
            {
                alert.Status = AlertStatuses.AwaitingApproval;
                await _appDbContext.SaveChangesAsync();
                return Ok("Alert đã xử lý - Chờ Manager duyệt");
            }
            else
            {
                return BadRequest("Giải pháp không phù hợp");
            }
        }
    }
}
