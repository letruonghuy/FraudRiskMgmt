namespace FraudRiskMgmt.API.DTOs
{
    public class TransactionRequest
    {
        public int CustomerId { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public string NameOrig { get; set; } = string.Empty;
        public string NameDest { get; set; } = string.Empty;
        public double Amount { get; set; }
        public int Hour { get; set; }
        public int IsMerchant { get; set; }
        public double ErrorBalanceOrig { get; set; }
        public double ErrorBalanceDest { get; set; }
        public double OldBalanceOrg { get; set; }
        public double NewBalanceOrig { get; set; }
        public double OldBalanceDest { get; set; }
        public double NewBalanceDest { get; set; }
    }
}

