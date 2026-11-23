using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

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
        private readonly AppDbContext _db;
        private readonly RiskPolicyOptions _fallback;

        public RiskPolicy(AppDbContext db, IOptions<RiskPolicyOptions> options)
        {
            _db = db;
            _fallback = options.Value;
        }

        public RiskPolicyOptions GetCurrentOptions()
        {
            var cfg = _db.RiskPolicyConfigs
                .AsNoTracking()
                .OrderBy(c => c.RiskPolicyConfigId)
                .FirstOrDefault();

            if (cfg == null) return _fallback;

            return new RiskPolicyOptions
            {
                AlertThreshold = cfg.AlertThreshold,
                HighConfidenceScore = cfg.HighConfidenceScore,
                LargeAmount = cfg.LargeAmount
            };
        }

        public bool ShouldAlert(double score)
        {
            var o = GetCurrentOptions();
            return score >= o.AlertThreshold;
        }

        public string Classify(double score, double amount)
        {
            var o = GetCurrentOptions();
            return ClassifyWithOptions(score, amount, o);
        }

        public string ClassifyManualReview(double amount)
        {
            var o = GetCurrentOptions();
            return amount >= o.LargeAmount ? RiskLevels.High : RiskLevels.Medium;
        }

        public static string ClassifyWithOptions(double score, double amount, RiskPolicyOptions o)
        {
            if (score < o.AlertThreshold) return RiskLevels.Safe;
            var large = amount >= o.LargeAmount;
            return score >= o.HighConfidenceScore
                ? (large ? RiskLevels.Critical : RiskLevels.High)
                : (large ? RiskLevels.Medium : RiskLevels.Low);
        }
    }
}