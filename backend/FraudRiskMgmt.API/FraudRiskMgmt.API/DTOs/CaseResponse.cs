namespace FraudRiskMgmt.API.DTOs
{
    public class CaseResponse
    {
        public int CaseId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public List<int> AlertIds { get; set; } = new();
        public string Status { get; set; } = string.Empty;
        public string OpenByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
    }
}
