using System.Text;
using System.Text.Json;
using FraudRiskMgmt.API.DTOs;

namespace FraudRiskMgmt.API.Services
{
    public class MLService
    {
        private readonly HttpClient _httpClient;

        public MLService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private static readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        public async Task<PredictResponse> PredictAsync(TransactionRequest request)
        {
            var payload = new
            {
                hour = request.Hour,
                amount = request.Amount,
                is_merchant = request.IsMerchant,
                errorBalanceOrig = request.ErrorBalanceOrig,
                errorBalanceDest = request.ErrorBalanceDest,
                oldbalanceOrg = request.OldBalanceOrg,
                newbalanceOrig = request.NewBalanceOrig,
                oldbalanceDest = request.OldBalanceDest,
                newbalanceDest = request.NewBalanceDest

            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var reponse = await _httpClient.PostAsync("http://localhost:8000/predict", content);
            var reponseBody = await reponse.Content.ReadAsStringAsync();

            return JsonSerializer.Deserialize<PredictResponse>(reponseBody, _jsonOptions)!;
        }


    }
}
