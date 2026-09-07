using System.Text.Json.Serialization;

namespace FraudRiskMgmt.API.DTOs
{
    public class PredictResponse
    {
        [JsonPropertyName("risk_score")]
        public double RiskScore { get; set; }

        [JsonPropertyName("is_fraud")]
        public bool IsFraud { get; set; }
    }
}
