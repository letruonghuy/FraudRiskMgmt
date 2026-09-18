using System.ComponentModel.DataAnnotations;

namespace FraudRiskMgmt.API.DTOs
{
    public class TransactionRequest
    {
        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "CustomerId phải lớn hơn 0")]
        public int CustomerId { get; set; }

        [Required]
        [RegularExpression("^(TRANSFER|CASH_OUT|PAYMENT|CASH_IN|DEBIT)$",
            ErrorMessage = "TransactionType không hợp lệ")]
        public string TransactionType { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string NameOrig { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string NameDest { get; set; } = string.Empty;

        [Range(0.01, double.MaxValue, ErrorMessage = "Amount phải lớn hơn 0")]
        public double Amount { get; set; }

        [Range(0, 23, ErrorMessage = "Hour phải từ 0 đến 23")]
        public int Hour { get; set; }

        [Range(0, 1, ErrorMessage = "IsMerchant chỉ nhận giá trị 0 hoặc 1")]
        public int IsMerchant { get; set; }

        public double ErrorBalanceOrig { get; set; }
        public double ErrorBalanceDest { get; set; }
        public double OldBalanceOrg { get; set; }
        public double NewBalanceOrig { get; set; }
        public double OldBalanceDest { get; set; }
        public double NewBalanceDest { get; set; }
    }
}