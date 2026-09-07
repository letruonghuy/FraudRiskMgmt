using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CaseController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;

        public CaseController(AppDbContext appDbContext)
        {
            _appDbContext = appDbContext;
        }

        [HttpPost]
        public async Task<IActionResult> CreatedCase([FromBody] CreateCaseRequest request)
        {
            var alert = await _appDbContext.Alerts
                .Include(item => item.Transaction)
                .SingleOrDefaultAsync(item => item.AlertId == request.AlertId);
            if (alert == null)
            {
                return NotFound("Alert không tồn tại");
            }

            if (alert.CaseId.HasValue)
            {
                return Conflict("Alert đã thuộc một Case khác");
            }

            var officerExists = await _appDbContext.Users
                .AnyAsync(user => user.UserId == request.OfficerId && user.Role == "Officer");
            if (!officerExists)
            {
                return BadRequest("Officer không tồn tại hoặc không có vai trò phù hợp");
            }

            var newCase = new Cases
            {
                CustomerId = alert.Transaction.CustomerId,
                Status = CaseStatuses.Open,
                OpenedBy = request.OfficerId,
                CreatedAt = DateTime.UtcNow,
            };

            _appDbContext.Cases.Add(newCase);
            alert.Case = newCase;
            alert.Status = AlertStatuses.UnderReview;
            await _appDbContext.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCase), new { id = newCase.CaseId }, new
            {
                CaseId = newCase.CaseId,
                AlertIds = new[] { alert.AlertId },
                Status = newCase.Status
            });
        }
        [HttpGet]
        public async Task<IActionResult> GetCase()
        {
            var cases = await _appDbContext.Cases
                .Include( a =>  a.Customer )
                .Include( a => a.OpenedByUser)
                .ToListAsync();

            var result = cases.Select( c => new CaseResponse
            {
                CaseId = c.CaseId,
                CustomerName = c.Customer.FullName,
                AlertIds = c.Alerts.Select(alert => alert.AlertId).ToList(),
                Status = c.Status,
                OpenByName = c.OpenedByUser.FullName,
                CreatedAt = c.CreatedAt,
                ClosedAt = c.ClosedAt,
            }).ToList();

            return Ok(result);

        }

        [HttpPut("{id}/resolve")]
        public async Task<IActionResult> ApproveCase(int id)
        {
            var caseItem = await _appDbContext.Cases.FindAsync(id);
            if (caseItem == null)
            {
                return NotFound("Case không tồn tại");
            }

            if (caseItem.Status != CaseStatuses.PendingApproval)
            {
                return Conflict("Case chưa ở trạng thái chờ phê duyệt");
            }

            caseItem.Status = CaseStatuses.Approved;
            caseItem.ClosedAt = DateTime.UtcNow;

            var alerts = await _appDbContext.Alerts
                .Where(alert => alert.CaseId == caseItem.CaseId)
                .ToListAsync();
            alerts.ForEach(alert => alert.Status = AlertStatuses.Closed);

            await _appDbContext.SaveChangesAsync();
            return Ok("Case đã được Manager phê duyệt"); 
    
        }

        [HttpPut("{id}/false-positive")]
        public async Task<IActionResult> RejectCase(int id)
        {
            var caseItem = await _appDbContext.Cases.FindAsync(id);
            if (caseItem == null)
            {
                return NotFound("Case không tồn tại");
            }

            if (caseItem.Status != CaseStatuses.PendingApproval)
            {
                return Conflict("Case chưa ở trạng thái chờ phê duyệt");
            }

            caseItem.Status = CaseStatuses.FalsePositive;
            caseItem.ClosedAt = DateTime.UtcNow;

            var alerts = await _appDbContext.Alerts
                .Where(alert => alert.CaseId == caseItem.CaseId)
                .ToListAsync();
            alerts.ForEach(alert => alert.Status = AlertStatuses.FalsePositive);
            await _appDbContext.SaveChangesAsync();
            return Ok("Case đã bị Manager từ chối");
        }

        [HttpPut("{id}/investigate")]
        public async Task<IActionResult> InvestigateCase(int id)
        {
            var caseItem = await _appDbContext.Cases.FindAsync(id);
            if (caseItem == null)
                return NotFound("Case không tồn tại");

            if (caseItem.Status != CaseStatuses.Open && caseItem.Status != CaseStatuses.Rework)
                return Conflict("Case không ở trạng thái Open");

            caseItem.Status = CaseStatuses.Investigating;
            var alerts = await _appDbContext.Alerts
                .Where(alert => alert.CaseId == caseItem.CaseId)
                .ToListAsync();
            alerts.ForEach(alert => alert.Status = AlertStatuses.UnderReview);
            await _appDbContext.SaveChangesAsync();
            return Ok("Case đang được điều tra");
        }
    }
}
