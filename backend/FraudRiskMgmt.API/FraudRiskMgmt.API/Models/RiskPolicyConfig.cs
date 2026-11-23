using System.ComponentModel.DataAnnotations;

namespace FraudRiskMgmt.API.Models
{
    public class RiskPolicyConfig
    {
        [Key]
        public int RiskPolicyConfigId { get; set; }

        public double AlertThreshold { get; set; } = 0.32;
        public double HighConfidenceScore { get; set; } = 0.85;
        public double LargeAmount { get; set; } = 1_500_000;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public int? UpdatedByUserId { get; set; }
        public User? UpdatedByUser { get; set; }

        [MaxLength(500)]
        public string? LastChangeReason { get; set; }
    }
}