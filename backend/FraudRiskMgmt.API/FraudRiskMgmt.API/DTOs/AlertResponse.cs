namespace FraudRiskMgmt.API.DTOs
{
    public class AlertResponse
    {
        public int AlertId { get; set; }
        public string CustomerName { get; set; } = string.Empty;    
        public double RiskScore { get; set; }
        public string RiskLevel { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;  
        public int? AssignedTo {  get; set; }
        public int? CaseId { get; set; }
        public double Amount { get; set; }
        public DateTime CreateAt { get; set; }
    }
}
