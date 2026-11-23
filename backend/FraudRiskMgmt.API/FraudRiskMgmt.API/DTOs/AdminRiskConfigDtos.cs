using System.ComponentModel.DataAnnotations;

namespace FraudRiskMgmt.API.DTOs
{
    public class RiskPolicyPayloadDto
    {
        public double AlertThreshold { get; set; }
        public double HighConfidenceScore { get; set; }
        public double LargeAmount { get; set; }
    }

    public class UpdateRiskPolicyRequest : RiskPolicyPayloadDto
    {
        [Required(ErrorMessage = "Lý do điều chỉnh tham số rủi ro là bắt buộc.")]
        [StringLength(500, MinimumLength = 5, ErrorMessage = "Lý do phải từ 5 đến 500 ký tự.")]
        public string Reason { get; set; } = string.Empty;
    }

    public class RiskLevelBreakdownDto
    {
        public int Safe { get; set; }
        public int Low { get; set; }
        public int Medium { get; set; }
        public int High { get; set; }
        public int Critical { get; set; }
    }

    public class RiskSimulationResultDto
    {
        public string WindowLabel { get; set; } = string.Empty;
        public int TotalScoredTransactions { get; set; }
        public int CurrentAlerts { get; set; }
        public int ProposedAlerts { get; set; }
        public int DeltaAlerts { get; set; }
        public double? DeltaPercent { get; set; }
        public int NewlyTriggeredCount { get; set; }
        public int SuppressedCount { get; set; }
        public RiskLevelBreakdownDto CurrentBreakdown { get; set; } = new();
        public RiskLevelBreakdownDto ProposedBreakdown { get; set; } = new();
    }
}