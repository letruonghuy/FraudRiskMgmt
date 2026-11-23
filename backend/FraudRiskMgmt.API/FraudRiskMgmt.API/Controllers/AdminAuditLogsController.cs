using System.Globalization;
using System.Text;
using FraudRiskMgmt.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Controllers
{
    [Route("api/admin/audit-logs")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminAuditLogsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public AdminAuditLogsController(AppDbContext db)
        {
            _db = db;
        }

        // GET /api/admin/audit-logs
        [HttpGet]
        public async Task<IActionResult> GetAuditLogs(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 15,
            [FromQuery] string? scope = null,
            [FromQuery] string? action = null,
            [FromQuery] int? actorId = null,
            [FromQuery] string? fromDate = null,
            [FromQuery] string? toDate = null,
            [FromQuery] string? search = null,
            CancellationToken ct = default)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 5, 100);

            // Thống kê số lượng theo từng nhóm nghiệp vụ trên toàn bộ nhật ký
            var typeGroups = await _db.AuditLogs
                .AsNoTracking()
                .GroupBy(a => a.EntityType)
                .Select(g => new { EntityType = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var userCount = typeGroups
                .Where(g => string.Equals(g.EntityType, "User", StringComparison.OrdinalIgnoreCase))
                .Sum(g => g.Count);
            var policyCount = typeGroups
                .Where(g => string.Equals(g.EntityType, "RiskPolicy", StringComparison.OrdinalIgnoreCase))
                .Sum(g => g.Count);
            var totalAllCount = typeGroups.Sum(g => g.Count);
            var opsCount = Math.Max(0, totalAllCount - userCount - policyCount);

            var query = BuildFilteredQuery(scope, action, actorId, fromDate, toDate, search);

            var totalCount = await query.CountAsync(ct);

            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .ThenByDescending(a => a.AuditLogId)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new
                {
                    a.AuditLogId,
                    a.UserId,
                    ActorName = a.User != null ? a.User.FullName : $"User #{a.UserId}",
                    ActorEmail = a.User != null ? a.User.Email : string.Empty,
                    ActorRole = a.User != null ? a.User.Role.ToString() : string.Empty,
                    a.Action,
                    a.EntityType,
                    a.EntityId,
                    a.OldStatus,
                    a.NewStatus,
                    a.Reason,
                    a.Details,
                    a.CreatedAt
                })
                .ToListAsync(ct);

            // Danh sách người thực hiện và loại hành động có trong log để đổ vào dropdown lọc
            var actors = await _db.AuditLogs
                .AsNoTracking()
                .Where(a => a.User != null)
                .Select(a => new
                {
                    a.UserId,
                    FullName = a.User!.FullName,
                    Email = a.User!.Email
                })
                .Distinct()
                .OrderBy(u => u.FullName)
                .ToListAsync(ct);

            var actions = await _db.AuditLogs
                .AsNoTracking()
                .Select(a => a.Action)
                .Distinct()
                .OrderBy(x => x)
                .ToListAsync(ct);

            return Ok(new
            {
                page,
                pageSize,
                totalCount,
                counts = new
                {
                    all = totalAllCount,
                    user = userCount,
                    policy = policyCount,
                    ops = opsCount
                },
                actors,
                actions,
                items
            });
        }

        // GET /api/admin/audit-logs/export
        [HttpGet("export")]
        public async Task<IActionResult> ExportCsv(
            [FromQuery] string? scope = null,
            [FromQuery] string? action = null,
            [FromQuery] int? actorId = null,
            [FromQuery] string? fromDate = null,
            [FromQuery] string? toDate = null,
            [FromQuery] string? search = null,
            CancellationToken ct = default)
        {
            var query = BuildFilteredQuery(scope, action, actorId, fromDate, toDate, search);

            var rows = await query
                .OrderByDescending(a => a.CreatedAt)
                .ThenByDescending(a => a.AuditLogId)
                .Take(5000)
                .Select(a => new
                {
                    a.AuditLogId,
                    a.CreatedAt,
                    ActorName = a.User != null ? a.User.FullName : $"User #{a.UserId}",
                    ActorEmail = a.User != null ? a.User.Email : string.Empty,
                    ActorRole = a.User != null ? a.User.Role.ToString() : string.Empty,
                    a.EntityType,
                    a.EntityId,
                    a.Action,
                    a.OldStatus,
                    a.NewStatus,
                    a.Details,
                    a.Reason
                })
                .ToListAsync(ct);

            var sb = new StringBuilder();
            sb.AppendLine("AuditLogId,ThoiGian_UTC+7,NguoiThucHien,Email,VaiTro,DoiTuong,MaDoiTuong,HanhDong,TrangThaiCu,TrangThaiMoi,ChiTietThayDoi,LyDo");

            foreach (var r in rows)
            {
                var vnTime = r.CreatedAt.AddHours(7).ToString("HH:mm:ss dd/MM/yyyy", CultureInfo.InvariantCulture);
                sb.AppendLine(string.Join(",",
                    r.AuditLogId,
                    EscapeCsv(vnTime),
                    EscapeCsv(r.ActorName),
                    EscapeCsv(r.ActorEmail),
                    EscapeCsv(r.ActorRole),
                    EscapeCsv(r.EntityType),
                    r.EntityId,
                    EscapeCsv(r.Action),
                    EscapeCsv(r.OldStatus),
                    EscapeCsv(r.NewStatus),
                    EscapeCsv(r.Details),
                    EscapeCsv(r.Reason)));
            }

            var bytes = Encoding.UTF8.GetPreamble()
                .Concat(Encoding.UTF8.GetBytes(sb.ToString()))
                .ToArray();

            var fileName = $"audit_logs_{DateTime.UtcNow.AddHours(7):yyyyMMdd_HHmm}.csv";
            return File(bytes, "text/csv; charset=utf-8", fileName);
        }

        private IQueryable<Models.AuditLog> BuildFilteredQuery(
            string? scope,
            string? action,
            int? actorId,
            string? fromDate,
            string? toDate,
            string? search)
        {
            var query = _db.AuditLogs
                .AsNoTracking()
                .Include(a => a.User)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(scope))
            {
                switch (scope.Trim().ToLowerInvariant())
                {
                    case "user":
                        query = query.Where(a => a.EntityType == "User");
                        break;
                    case "policy":
                        query = query.Where(a => a.EntityType == "RiskPolicy");
                        break;
                    case "ops":
                        query = query.Where(a => a.EntityType != "User" && a.EntityType != "RiskPolicy");
                        break;
                }
            }

            if (!string.IsNullOrWhiteSpace(action))
            {
                var act = action.Trim();
                query = query.Where(a => a.Action == act);
            }

            if (actorId.HasValue && actorId.Value > 0)
            {
                query = query.Where(a => a.UserId == actorId.Value);
            }

            // Quy đổi ngày lọc theo giờ Việt Nam (UTC+7) sang UTC trong DB
            if (DateTime.TryParseExact(fromDate?.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedFrom))
            {
                var utcFrom = DateTime.SpecifyKind(parsedFrom, DateTimeKind.Utc).AddHours(-7);
                query = query.Where(a => a.CreatedAt >= utcFrom);
            }

            if (DateTime.TryParseExact(toDate?.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedTo))
            {
                var utcToExclusive = DateTime.SpecifyKind(parsedTo.AddDays(1), DateTimeKind.Utc).AddHours(-7);
                query = query.Where(a => a.CreatedAt < utcToExclusive);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                var numericRaw = term.TrimStart('#');
                if (int.TryParse(numericRaw, out var idVal))
                {
                    query = query.Where(a =>
                        a.AuditLogId == idVal ||
                        a.EntityId == idVal ||
                        (a.Reason != null && a.Reason.Contains(term)) ||
                        (a.Details != null && a.Details.Contains(term)));
                }
                else
                {
                    query = query.Where(a =>
                        a.Action.Contains(term) ||
                        a.EntityType.Contains(term) ||
                        (a.Reason != null && a.Reason.Contains(term)) ||
                        (a.Details != null && a.Details.Contains(term)) ||
                        (a.OldStatus != null && a.OldStatus.Contains(term)) ||
                        (a.NewStatus != null && a.NewStatus.Contains(term)) ||
                        (a.User != null && (a.User.FullName.Contains(term) || a.User.Email.Contains(term))));
                }
            }

            return query;
        }

        private static string EscapeCsv(string? value)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            var escaped = value.Replace("\"", "\"\"");
            return $"\"{escaped}\"";
        }
    }
}