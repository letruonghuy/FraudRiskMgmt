namespace FraudRiskMgmt.API.DTOs
{
    public class AlertStatusCount
    {
        public string Status { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class CaseStatusCount
    {
        public string Status { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class OfficerProductivity
    {
        public string OfficerName { get; set; } = string.Empty;
        public int TotalCases { get; set; }
        public int ClosedCases { get; set; }
    }

    public class DailyTransaction
    {
        public DateTime Date { get; set; }
        public int Count { get; set; }
    }
    public class RiskLevelCount
    {
        public string RiskLevel { get; set; } = string.Empty;
        public int Count { get; set; }
    }
    public class DashboardResponse
    {
        public int TotalTransactions { get; set; }
        public int TotalNewAlerts { get; set; }
        public int TotalCaseInvestigating { get; set; }
        //public int TotalFraudApproved { get; set; }
        public int TotalCaseApproved { get; set; }
        public double FalsePositiveRate { get; set; }
        public List<AlertStatusCount> AlertByStatus { get; set; } = new();
        public List<CaseStatusCount> CaseByStatus { get; set; } = new();
        public List<OfficerProductivity> OfficerProductivity { get; set; } = new();
        public List<DailyTransaction> TransactionsByDay { get; set; } = new();
        public List<RiskLevelCount> AlertByRiskLevel { get; set; } = new();

    }
}
