namespace FraudRiskMgmt.API.DTOs
{
    public class AlertDetailResponse
    {
        public int AlertId { get; set; }
        public int TransactionId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerAccountNumber { get; set; } = string.Empty;
        public double RiskScore { get; set; }
        public string RiskLevel { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int? AssignedTo { get; set; }
        public string? AssignedToName { get; set; }
        public int? CaseId { get; set; }
        public double Amount { get; set; }
        public DateTime CreatedAt { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public DateTime TransactionTime { get; set; }
        public int? Hour { get; set; }
        public string NameOrig { get; set; } = string.Empty;
        public string NameDest { get; set; } = string.Empty;
        public double OldBalanceOrg { get; set; }
        public double NewBalanceOrig { get; set; }
        public double OldBalanceDest { get; set; }
        public double NewBalanceDest { get; set; }
    }
}