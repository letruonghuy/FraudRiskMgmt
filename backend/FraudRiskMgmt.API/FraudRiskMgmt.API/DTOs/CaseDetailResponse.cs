namespace FraudRiskMgmt.API.DTOs
{
    public class CaseDetailResponse
    {
        public int CaseId { get; set; }
        public string Status { get; set; } = string.Empty;
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public int DistinctCustomerCount { get; set; } = 1;
        public int OpenedBy { get; set; }
        public string OpenByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public List<CaseDetailAlert> Alerts { get; set; } = new();
        public List<CaseDetailNote> Notes { get; set; } = new();
        public List<CaseDetailProposal> Proposals { get; set; } = new();
        public string MergePattern { get; set; } = "SameCustomer";
        public string? CorrelationKey { get; set; }
    }

    public class CaseDetailAlert
    {
        public int AlertId { get; set; }
        public string Status { get; set; } = string.Empty;
        public double RiskScore { get; set; }
        public string RiskLevel { get; set; } = string.Empty;
        public string? CustomerName { get; set; }
        public double Amount { get; set; }
        public string? NameOrig { get; set; }
        public string? NameDest { get; set; }
        public DateTime TransactionTime { get; set; }
    }

    public class CaseDetailNote
    {
        public int InvestigationNoteId { get; set; }
        public int AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class CaseDetailProposal
    {
        public int CaseActionProposalId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string ProposedByName { get; set; } = string.Empty;
        public string? DecisionNote { get; set; }
        public string? DecidedByName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? DecidedAt { get; set; }
    }
}