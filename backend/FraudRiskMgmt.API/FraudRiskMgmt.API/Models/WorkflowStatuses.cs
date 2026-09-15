namespace FraudRiskMgmt.API.Models
{
    public static class AlertStatuses
    {
        public const string New = "New";
        public const string Assigned = "Assigned";
        public const string UnderReview = "UnderReview";
        public const string AwaitingApproval = "AwaitingApproval";
        public const string Closed = "Closed";
        public const string FalsePositive = "FalsePositive";
        public const string Reopened = "Reopened";
    }

    public static class CaseStatuses
    {
        public const string Open = "Open";
        public const string Investigating = "Investigating";
        public const string PendingApproval = "PendingApproval";
        public const string Approved = "Approved";
        public const string Rework = "Rework";
        public const string FalsePositive = "FalsePositive";
        public const string Closed = "Closed";
    }

    public static class ProposalStatuses
    {
        public const string Pending = "Pending";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";
    }

    public static class RiskLevels
    {
        public const string Critical = "Critical";
        public const string High = "High";
        public const string Medium = "Medium";
        public const string Low = "Low";
        public const string Safe = "Safe";
    }
}