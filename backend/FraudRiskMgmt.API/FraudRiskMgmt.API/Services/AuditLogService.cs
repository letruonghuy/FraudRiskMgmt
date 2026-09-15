using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.Models;

namespace FraudRiskMgmt.API.Services
{
    public class AuditLogService
    {
        private readonly AppDbContext _appDbContext;
        public AuditLogService(AppDbContext context)
        {
            _appDbContext = context;
        }
        public async Task LogAsync(
            int userId,
            string action,
            string entityType,
            int entityId,
            string? oldStatus = null,
            string? newStatus = null,
            string? reason = null)
        {
            var log = new AuditLog
            {
                UserId = userId,
                Action = action,
                EntityId = entityId,
                EntityType = entityType,
                OldStatus = oldStatus,
                NewStatus = newStatus,
                Reason = reason,
                CreatedAt = DateTime.UtcNow
            };

            _appDbContext.AuditLogs.Add(log);
            await _appDbContext.SaveChangesAsync();
        }
    }
}
