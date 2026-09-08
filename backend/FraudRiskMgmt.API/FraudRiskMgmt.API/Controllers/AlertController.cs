using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Controllers
{
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
        public async Task<IActionResult> GetAlert()
        {
            var alert = await _appDbContext.Alerts
                .Include(a => a.Transaction)
                .Include(a => a.Transaction.Customer)
                .ToListAsync();

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
        public async Task<IActionResult> AssignAlert(int id, [FromBody] AssignAlertRequest request)
        {
            var alert = await _appDbContext.Alerts.FindAsync(id);
            if(alert == null)
            {
                return NotFound("Alert không tồn tại");
            }

            var officerExists = await _appDbContext.Users
                .AnyAsync(user => user.UserId == request.OfficerId && user.Role == "Officer");
            if (!officerExists)
            {
                return BadRequest("Officer không tồn tại hoặc không có vai trò phù hợp");
            }

            alert.AssignedTo = request.OfficerId;
            alert.Status = AlertStatuses.Assigned;

            await _appDbContext.SaveChangesAsync();
            return Ok("Assign thành công");
        }

        [HttpPut("{id}/close")]
        public async Task<IActionResult> CloseAlert(int id, [FromBody] CloseAlertRequest request)
        {
            var alert = await _appDbContext.Alerts.FindAsync(id);
            if (alert == null)
            {
                return NotFound("Alert không tồn tại");
            }

            if (alert.CaseId.HasValue)
            {
                return Conflict("Alert đã thuộc một Case; hãy xử lý qua Case");
            }

            if (request.Resolution == "FalsePositive")
            {
                alert.Status = AlertStatuses.FalsePositive;
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
