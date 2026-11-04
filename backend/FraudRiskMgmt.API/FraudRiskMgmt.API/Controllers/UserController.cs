using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Controllers
{
    public class OfficerResponse
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        // Số cảnh báo Officer đang xử lý dở (đã nhận / đang xem xét / chờ duyệt) để Manager cân nhắc khi phân công
        public int ActiveAlerts { get; set; }
    }

    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;

        public UserController(AppDbContext appDbContext)
        {
            _appDbContext = appDbContext;
        }

        [HttpGet("officers")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> GetOfficers()
        {
            // Lưu ý: nếu khóa chính của User không tên là UserId, đổi u.UserId ở 2 chỗ dưới cho khớp
            var officers = await _appDbContext.Users
                .AsNoTracking()
                .Where(u => u.Role == UserRole.Officer && u.DeletedAt == null)
                .Select(u => new OfficerResponse
                {
                    UserId = u.UserId,
                    FullName = u.FullName,
                    ActiveAlerts = _appDbContext.Alerts.Count(a =>
                        a.AssignedTo == u.UserId
                        && a.DeletedAt == null
                        && (a.Status == AlertStatuses.Assigned
                            || a.Status == AlertStatuses.UnderReview
                            || a.Status == AlertStatuses.AwaitingApproval))
                })
                .OrderBy(o => o.ActiveAlerts)
                .ThenBy(o => o.FullName)
                .ToListAsync();

            return Ok(officers);
        }
    }
}