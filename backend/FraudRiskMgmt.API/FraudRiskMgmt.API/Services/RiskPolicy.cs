using Microsoft.Extensions.Options;
using FraudRiskMgmt.API.Models;   // chỉnh namespace cho đúng nơi RiskLevels đang nằm

namespace FraudRiskMgmt.API.Services
{
    public class RiskPolicyOptions
    {
        public double AlertThreshold { get; set; } = 0.32;
        public double HighConfidenceScore { get; set; } = 0.85;
        public double LargeAmount { get; set; } = 1_500_000;
    }

    public class RiskPolicy
    {
        private readonly RiskPolicyOptions _o;
        public RiskPolicy(IOptions<RiskPolicyOptions> options) => _o = options.Value;

        public bool ShouldAlert(double score) => score >= _o.AlertThreshold;

        public string Classify(double score, double amount)
        {
            if (score < _o.AlertThreshold) return RiskLevels.Safe;
            var large = amount >= _o.LargeAmount;
            return score >= _o.HighConfidenceScore
                ? (large ? RiskLevels.Critical : RiskLevels.High)
                : (large ? RiskLevels.Medium : RiskLevels.Low);
        }
    }
}