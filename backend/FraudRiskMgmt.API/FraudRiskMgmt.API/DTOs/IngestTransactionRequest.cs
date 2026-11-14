using System.ComponentModel.DataAnnotations;

namespace FraudRiskMgmt.API.DTOs
{
    public class AccountSnapshot
    {
        [Required, MaxLength(50)] public string AccountNumber { get; set; } = string.Empty;
        [MaxLength(100)] public string? HolderName { get; set; }
        [Range(0, double.MaxValue)] public double BalanceBefore { get; set; }
        [Range(0, double.MaxValue)] public double BalanceAfter { get; set; }
    }

    public class IngestTransactionRequest
    {
        [Required, MaxLength(64)] public string ExternalRef { get; set; } = string.Empty;
        public DateTime? OccurredAt { get; set; }
        [Range(0, 23)] public int? Hour { get; set; }
        [Required, RegularExpression("^(TRANSFER|CASH_OUT|PAYMENT|CASH_IN|DEBIT)$")]
        public string Type { get; set; } = string.Empty;
        [Range(0.01, double.MaxValue)] public double Amount { get; set; }
        [Required] public AccountSnapshot Source { get; set; } = null!;
        [Required] public AccountSnapshot Destination { get; set; } = null!;
    }
}