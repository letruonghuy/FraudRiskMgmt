namespace FraudRiskMgmt.API.DTOs
{
    public class CaseDetailResponse
    {
        public int CaseId { get; set; }
        public string Status { get; set; } = string.Empty;
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public int OpenedBy { get; set; }
        public string OpenByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public List<CaseDetailAlert> Alerts { get; set; } = new();
        public List<CaseDetailNote> Notes { get; set; } = new();
        public List<CaseDetailProposal> Proposals { get; set; } = new();
    }

    public class CaseDetailAlert
    {
        public int AlertId { get; set; }
        public string Status { get; set; } = string.Empty;

        // Nếu entity Alert của bạn có điểm rủi ro, thêm vào đây (và vào phép chiếu trong GetCaseById)
        // để trang chi tiết hiện thêm điểm + mức độ rủi ro của từng cảnh báo:
        public double RiskScore { get; set; }      // đổi kiểu cho khớp entity (0..1 như API danh sách alert)
        public string RiskLevel { get; set; } = string.Empty;
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