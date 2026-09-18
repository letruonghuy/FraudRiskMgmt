using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using Microsoft.EntityFrameworkCore;
using FraudRiskMgmt.API.Models;
using FraudRiskMgmt.API.Extensions;

namespace FraudRiskMgmt.API.Controllers
{
    [Authorize(Roles = "Manager")]
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;

        public DashboardController(AppDbContext appDbContext)
        {
            _appDbContext = appDbContext;
        }
        [HttpGet]
        public async Task<IActionResult> GetDashboardData([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            if (from.HasValue && to.HasValue && from > to)
                return this.ApiBadRequest("Khoảng thời gian không hợp lệ");
            var dateFrom = from ?? DateTime.UtcNow.AddDays(-30);
            var dateToExclusive = (to ?? DateTime.UtcNow).Date.AddDays(1);
            var totalTransactions = await _appDbContext.Transactions.CountAsync(t => t.TransactionTime >= dateFrom && t.TransactionTime < dateToExclusive);
            var totalNewAlerts = await _appDbContext.Alerts.CountAsync(a => a.Status == AlertStatuses.New&& a.CreatedAt >= dateFrom && a.CreatedAt < dateToExclusive);
            var totalCaseInvestigating = await _appDbContext.Cases.CountAsync(c => c.Status == CaseStatuses.Investigating&& c.CreatedAt >= dateFrom && c.CreatedAt < dateToExclusive);
            var totalCaseApproved = await _appDbContext.Cases.CountAsync(c => c.Status == CaseStatuses.Approved&& c.CreatedAt >= dateFrom && c.CreatedAt < dateToExclusive);
            var totalClosedAlerts = await _appDbContext.Alerts.CountAsync(a => (a.Status == AlertStatuses.Closed || a.Status == AlertStatuses.FalsePositive)&& a.CreatedAt >= dateFrom && a.CreatedAt < dateToExclusive);
            var totalFalsePositiveAlerts = await _appDbContext.Alerts.CountAsync(a => a.Status == AlertStatuses.FalsePositive&& a.CreatedAt >= dateFrom && a.CreatedAt < dateToExclusive);
            var falsePositiveRate = totalClosedAlerts == 0? 0.0: Math.Round((double)totalFalsePositiveAlerts / totalClosedAlerts * 100, 2);
            var alertByStatus = await _appDbContext.Alerts
                .Where(a => a.CreatedAt >= dateFrom && a.CreatedAt < dateToExclusive)
                .GroupBy(a => a.Status)
                .Select(g => new AlertStatusCount
                {
                    Status = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();
            var caseByStatus = await _appDbContext.Cases
                .Where(c => c.CreatedAt >= dateFrom && c.CreatedAt < dateToExclusive)
                .GroupBy(c => c.Status)
                .Select(g => new CaseStatusCount
                {
                    Status = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();
            var officerProductivity = await _appDbContext.Cases
                .Where(c => c.CreatedAt >= dateFrom && c.CreatedAt < dateToExclusive)
                .GroupBy(c => c.OpenedByUser.FullName)
                .Select(g => new OfficerProductivity
                {
                    OfficerName = g.Key,
                    TotalCases = g.Count(),
                    ClosedCases = g.Count(c =>
                        c.Status == CaseStatuses.Approved ||
                        c.Status == CaseStatuses.FalsePositive ||
                        c.Status == CaseStatuses.Closed)
                })
                .ToListAsync();
            var alertByRiskLevel = await _appDbContext.Alerts
                .Where(a => a.CreatedAt >= dateFrom && a.CreatedAt < dateToExclusive)
                .GroupBy(a => a.RiskLevel)
                .Select(g => new RiskLevelCount
                {
                    RiskLevel = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();
            var transactionsByDay = await _appDbContext.Transactions
                .Where(t => t.TransactionTime >= dateFrom && t.TransactionTime < dateToExclusive)
                .GroupBy(t => t.TransactionTime.Date)
                .Select(g => new DailyTransaction { Date = g.Key, Count = g.Count() })
                .ToListAsync();
            var dashboardResponse = new DashboardResponse
            {
                TotalTransactions = totalTransactions,
                TotalNewAlerts = totalNewAlerts,
                TotalCaseInvestigating = totalCaseInvestigating,
                TotalCaseApproved = totalCaseApproved,
                FalsePositiveRate = falsePositiveRate,
                AlertByStatus = alertByStatus,
                AlertByRiskLevel = alertByRiskLevel,
                CaseByStatus = caseByStatus,
                OfficerProductivity = officerProductivity,
                TransactionsByDay = transactionsByDay,
            };
            return Ok(dashboardResponse);
        }
     }
}
