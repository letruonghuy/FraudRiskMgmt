namespace FraudRiskMgmt.API.Models
{
    public class AuditLog
    {
        public int AuditLogId { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; } 

        public string Action { get; set; } = string.Empty;

        public string EntityType { get; set; } = string.Empty;
        public int EntityId { get; set; } 

        public string? OldStatus { get; set; } 
        public string? NewStatus { get; set; }

        public string? Reason { get; set; }

        public DateTime CreatedAt { get; set; } 
    }
}
