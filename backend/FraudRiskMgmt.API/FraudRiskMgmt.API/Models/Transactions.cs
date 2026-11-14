using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Models
{
    [Index(nameof(ExternalRef), IsUnique = true)]
    public class Transactions
    {
        public double Amount { get; set; }
        public double OldBalanceOrg { get; set; }
        public double NewBalanceOrig { get; set; }
        public double OldBalanceDest { get; set; }
        public double NewBalanceDest { get; set; }
        [Key]
        public int TransactionId { get; set; }
        public int CustomerId {  get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public DateTime TransactionTime {  get; set; }
        public double RiskScore { get; set; }
        public string RiskLevel { get; set; } = string.Empty;
        public string NameOrig { get; set; } = string.Empty;
        public string NameDest { get; set; } = string.Empty;
        public int? Hour { get; set; }
        [MaxLength(64)] public string? ExternalRef { get; set; }
        public DateTime? DeletedAt { get; set; } = null;
        public Customer? Customer { get; set; } = null!;

    }
}
