using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using Microsoft.EntityFrameworkCore;
using FraudRiskMgmt.API.Models;

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
        public async Task<IActionResult> GetDashboardData()
        {
            var totalTransactions = await _appDbContext.Transactions.CountAsync();
            var totalNewAlerts = await _appDbContext.Alerts.CountAsync(a => a.Status == AlertStatuses.New);
            var totalCaseInvestigating = await _appDbContext.Cases.CountAsync(c => c.Status == CaseStatuses.Investigating);
            var totalFraudApproved = await _appDbContext.Cases.CountAsync(c => c.Status == CaseStatuses.Approved);
            var alertByStatus = await _appDbContext.Alerts
                .GroupBy(a => a.Status)
                .Select(g => new AlertStatusCount
                {
                    Status = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();
            var caseByStatus = await _appDbContext.Cases
                .GroupBy(c => c.Status)
                .Select(g => new CaseStatusCount
                {
                    Status = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();
            var officerProductivity = await _appDbContext.Cases
                .GroupBy(c => c.OpenedByUser.FullName)
                .Select(g => new OfficerProductivity
                {
                    OfficerName = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();
            var transactionLast7Days = await _appDbContext.Transactions
                .Where(t => t.TransactionTime >= DateTime.Now.AddDays(-7))
                .GroupBy(t => t.TransactionTime.Date)
                .Select(g => new DailyTransaction
                {
                    Date = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();
            var dashboardResponse = new DashboardResponse
            {
                TotalTransactions = totalTransactions,
                TotalNewAlerts = totalNewAlerts,
                TotalCaseInvestigating = totalCaseInvestigating,
                TotalFraudApproved = totalFraudApproved,
                AlertByStatus = alertByStatus,
                CaseByStatus = caseByStatus,
                OfficerProductivity = officerProductivity,
                TransactionLast7Days = transactionLast7Days
            };
            return Ok(dashboardResponse);
        }
     }
}
