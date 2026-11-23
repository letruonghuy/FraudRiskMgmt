using System.Security.Claims;
using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Models;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Controllers
{
    [Route("api/admin/users")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminUsersController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly PasswordService _passwordService;
        private readonly AuditLogService _auditLogService;

        public AdminUsersController(
            AppDbContext db,
            PasswordService passwordService,
            AuditLogService auditLogService)
        {
            _db = db;
            _passwordService = passwordService;
            _auditLogService = auditLogService;
        }

        private int GetCurrentUserId()
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? User.FindFirstValue("userId")
                      ?? User.FindFirstValue("sub");
            return int.TryParse(raw, out var id) ? id : 0;
        }

        // GET /api/admin/users?page=1&pageSize=10&search=&role=&status=
        [HttpGet]
        public async Task<IActionResult> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] string? role = null,
            [FromQuery] string? status = null)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 50);

            var query = _db.Users.AsNoTracking().Where(u => u.DeletedAt == null);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var keyword = search.Trim().ToLower();
                query = query.Where(u =>
                    u.FullName.ToLower().Contains(keyword) ||
                    u.Email.ToLower().Contains(keyword) ||
                    u.UserId.ToString() == keyword);
            }

            if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<UserRole>(role, true, out var parsedRole))
            {
                query = query.Where(u => u.Role == parsedRole);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                if (status.Equals("active", StringComparison.OrdinalIgnoreCase))
                    query = query.Where(u => u.IsActive);
                else if (status.Equals("locked", StringComparison.OrdinalIgnoreCase))
                    query = query.Where(u => !u.IsActive);
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(u => u.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new AdminUserDto
                {
                    UserId = u.UserId,
                    FullName = u.FullName,
                    Email = u.Email,
                    Role = u.Role.ToString(),
                    IsActive = u.IsActive,
                    CreatedAt = u.CreatedAt,
                    LastLoginAt = u.LastLoginAt
                })
                .ToListAsync();

            var activeCount = await _db.Users.CountAsync(u => u.DeletedAt == null && u.IsActive);
            var lockedCount = await _db.Users.CountAsync(u => u.DeletedAt == null && !u.IsActive);

            return Ok(new
            {
                items,
                page,
                pageSize,
                totalCount,
                activeCount,
                lockedCount
            });
        }

        // POST /api/admin/users
        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            if (!Enum.TryParse<UserRole>(request.Role, true, out var targetRole))
                return BadRequest(new { message = "Vai trò không hợp lệ (chỉ chấp nhận Admin, Officer, Manager)." });

            var normalizedEmail = request.Email.Trim().ToLowerInvariant();
            var emailExists = await _db.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail);
            if (emailExists)
                return Conflict(new { message = $"Email '{normalizedEmail}' đã tồn tại trong hệ thống." });

            var user = new User
            {
                FullName = request.FullName.Trim(),
                Email = normalizedEmail,
                Role = targetRole,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            user.PasswordHash = _passwordService.HashPassword(user, request.Password);

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var actorId = GetCurrentUserId();
            if (actorId > 0)
            {
                await _auditLogService.LogAsync(
                    userId: actorId,
                    action: "CreateUser",
                    entityType: "User",
                    entityId: user.UserId,
                    oldStatus: null,
                    newStatus: "Active",
                    reason: $"Cấp mới tài khoản {user.Email} ({user.Role})",
                    details: $"Email: {user.Email} | Vai trò: {user.Role}");
            }

            return Ok(new AdminUserDto
            {
                UserId = user.UserId,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role.ToString(),
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt,
                LastLoginAt = user.LastLoginAt
            });
        }

        // PUT /api/admin/users/{id}/role
        [HttpPut("{id:int}/role")]
        public async Task<IActionResult> UpdateUserRole(int id, [FromBody] UpdateUserRoleRequest request)
        {
            if (!Enum.TryParse<UserRole>(request.Role, true, out var nextRole))
                return BadRequest(new { message = "Vai trò mới không hợp lệ." });

            var actorId = GetCurrentUserId();
            if (actorId == id)
                return BadRequest(new { message = "Không thể tự thay đổi vai trò của chính tài khoản đang đăng nhập." });

            var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == id && u.DeletedAt == null);
            if (user == null)
                return NotFound(new { message = "Không tìm thấy người dùng." });

            if (user.Role == nextRole)
                return BadRequest(new { message = $"Người dùng hiện đã giữ vai trò {nextRole}." });

            if (user.Role == UserRole.Admin && user.IsActive && nextRole != UserRole.Admin)
            {
                var otherActiveAdmins = await _db.Users.CountAsync(u =>
                    u.DeletedAt == null && u.IsActive && u.Role == UserRole.Admin && u.UserId != id);
                if (otherActiveAdmins == 0)
                    return BadRequest(new { message = "Hệ thống phải có ít nhất 1 tài khoản Admin đang hoạt động." });
            }

            var prevRole = user.Role.ToString();
            user.Role = nextRole;
            await _db.SaveChangesAsync();

            if (actorId > 0)
            {
                await _auditLogService.LogAsync(
                    userId: actorId,
                    action: "ChangeUserRole",
                    entityType: "User",
                    entityId: user.UserId,
                    oldStatus: prevRole,
                    newStatus: nextRole.ToString(),
                    reason: request.Reason.Trim(),
                    details: $"{user.Email}: {prevRole} → {nextRole}");
            }

            return Ok(new { message = "Đã cập nhật vai trò người dùng." });
        }

        // PUT /api/admin/users/{id}/status
        [HttpPut("{id:int}/status")]
        public async Task<IActionResult> ToggleUserStatus(int id, [FromBody] ToggleUserStatusRequest request)
        {
            var actorId = GetCurrentUserId();
            if (actorId == id)
                return BadRequest(new { message = "Không thể tự khóa hoặc vô hiệu hóa chính tài khoản đang đăng nhập." });

            var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == id && u.DeletedAt == null);
            if (user == null)
                return NotFound(new { message = "Không tìm thấy người dùng." });

            if (user.IsActive == request.IsActive)
                return BadRequest(new { message = request.IsActive ? "Tài khoản này đang hoạt động." : "Tài khoản này đã bị khóa." });

            if (!request.IsActive && user.Role == UserRole.Admin)
            {
                var otherActiveAdmins = await _db.Users.CountAsync(u =>
                    u.DeletedAt == null && u.IsActive && u.Role == UserRole.Admin && u.UserId != id);
                if (otherActiveAdmins == 0)
                    return BadRequest(new { message = "Không thể khóa tài khoản Admin hoạt động cuối cùng của hệ thống." });
            }

            var oldStatus = user.IsActive ? "Active" : "Locked";
            var newStatus = request.IsActive ? "Active" : "Locked";
            user.IsActive = request.IsActive;
            await _db.SaveChangesAsync();

            if (actorId > 0)
            {
                await _auditLogService.LogAsync(
                    userId: actorId,
                    action: request.IsActive ? "UnlockUser" : "LockUser",
                    entityType: "User",
                    entityId: user.UserId,
                    oldStatus: oldStatus,
                    newStatus: newStatus,
                    reason: request.Reason.Trim(),
                    details: $"{user.Email}: {oldStatus} → {newStatus}");
            }

            return Ok(new { message = request.IsActive ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản." });
        }

        // PUT /api/admin/users/{id}/reset-password
        [HttpPut("{id:int}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetUserPasswordRequest request)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == id && u.DeletedAt == null);
            if (user == null)
                return NotFound(new { message = "Không tìm thấy người dùng." });

            user.PasswordHash = _passwordService.HashPassword(user, request.NewPassword);
            await _db.SaveChangesAsync();

            var actorId = GetCurrentUserId();
            if (actorId > 0)
            {
                await _auditLogService.LogAsync(
                    userId: actorId,
                    action: "ResetUserPassword",
                    entityType: "User",
                    entityId: user.UserId,
                    oldStatus: null,
                    newStatus: null,
                    reason: request.Reason.Trim(),
                    details: $"Đặt lại mật khẩu cho {user.Email}");
            }

            return Ok(new { message = "Đã đặt lại mật khẩu thành công." });
        }
    }
}