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
        // DB lưu giờ UTC. Việt Nam không có giờ mùa hè nên cố định UTC+7
        // để chia ngày/lọc khoảng ngày theo giờ Việt Nam.
        private const int VnOffsetHours = 7;

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

            // from/to là NGÀY theo giờ Việt Nam (yyyy-MM-dd) → đổi sang mốc UTC để lọc DB
            var vnToday = DateTime.UtcNow.AddHours(VnOffsetHours).Date;
            var fromLocal = (from ?? vnToday.AddDays(-29)).Date;
            var toLocal = (to ?? vnToday).Date;
            var dateFrom = fromLocal.AddHours(-VnOffsetHours);
            var dateToExclusive = toLocal.AddDays(1).AddHours(-VnOffsetHours);

            var totalTransactions = await _appDbContext.Transactions.CountAsync(t => t.TransactionTime >= dateFrom && t.TransactionTime < dateToExclusive);
            var totalNewAlerts = await _appDbContext.Alerts.CountAsync(a => a.Status == AlertStatuses.New && a.CreatedAt >= dateFrom && a.CreatedAt < dateToExclusive);
            var totalCaseInvestigating = await _appDbContext.Cases.CountAsync(c => c.Status == CaseStatuses.Investigating && c.CreatedAt >= dateFrom && c.CreatedAt < dateToExclusive);
            var totalCaseApproved = await _appDbContext.Cases.CountAsync(c => c.Status == CaseStatuses.Approved && c.CreatedAt >= dateFrom && c.CreatedAt < dateToExclusive);
            var totalClosedAlerts = await _appDbContext.Alerts.CountAsync(a => (a.Status == AlertStatuses.Closed || a.Status == AlertStatuses.FalsePositive) && a.CreatedAt >= dateFrom && a.CreatedAt < dateToExclusive);
            var totalFalsePositiveAlerts = await _appDbContext.Alerts.CountAsync(a => a.Status == AlertStatuses.FalsePositive && a.CreatedAt >= dateFrom && a.CreatedAt < dateToExclusive);
            var falsePositiveRate = totalClosedAlerts == 0 ? 0.0 : Math.Round((double)totalFalsePositiveAlerts / totalClosedAlerts * 100, 2);

            var alertByStatus = await _appDbContext.Alerts
                .Where(a => a.CreatedAt >= dateFrom && a.CreatedAt < dateToExclusive)
                .GroupBy(a => a.Status)
                .Select(g => new AlertStatusCount { Status = g.Key, Count = g.Count() })
                .ToListAsync();
            var caseByStatus = await _appDbContext.Cases
                .Where(c => c.CreatedAt >= dateFrom && c.CreatedAt < dateToExclusive)
                .GroupBy(c => c.Status)
                .Select(g => new CaseStatusCount { Status = g.Key, Count = g.Count() })
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
                .Select(g => new RiskLevelCount { RiskLevel = g.Key, Count = g.Count() })
                .ToListAsync();

            // Chia ngày theo giờ Việt Nam
            var transactionsByDay = await _appDbContext.Transactions
                .Where(t => t.TransactionTime >= dateFrom && t.TransactionTime < dateToExclusive)
                .GroupBy(t => t.TransactionTime.AddHours(VnOffsetHours).Date)
                .Select(g => new DailyTransaction { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            // Thời gian xử lý trung bình (phút): chỉ tính hồ sơ đã đóng, mở trong khoảng đã chọn
            var avgHandlingMinutes = await _appDbContext.Cases
                .Where(c => c.DeletedAt == null
                    && c.ClosedAt != null
                    && c.CreatedAt >= dateFrom && c.CreatedAt < dateToExclusive)
                .AverageAsync(c => (double?)EF.Functions.DateDiffMinute(c.CreatedAt, c.ClosedAt!.Value));

            var dashboardResponse = new DashboardResponse
            {
                TotalTransactions = totalTransactions,
                TotalNewAlerts = totalNewAlerts,
                TotalCaseInvestigating = totalCaseInvestigating,
                TotalCaseApproved = totalCaseApproved,
                FalsePositiveRate = falsePositiveRate,
                AvgHandlingMinutes = avgHandlingMinutes.HasValue ? Math.Round(avgHandlingMinutes.Value, 1) : null,
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