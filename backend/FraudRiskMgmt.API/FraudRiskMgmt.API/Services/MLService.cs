using System.Diagnostics;
using System.Text;
using System.Text.Json;
using FraudRiskMgmt.API.DTOs;

namespace FraudRiskMgmt.API.Services
{
    public record MlHealthStatus(bool Online, long? LatencyMs, string Endpoint, string Detail);

    public class MLService
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;

        public MLService(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _baseUrl = (configuration["MLService:BaseUrl"] ?? "http://localhost:8000").TrimEnd('/');
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

            var response = await _httpClient.PostAsync($"{_baseUrl}/predict", content);
            var responseBody = await response.Content.ReadAsStringAsync();

            return JsonSerializer.Deserialize<PredictResponse>(responseBody, _jsonOptions)!;
        }

        public async Task<MlHealthStatus> CheckHealthAsync(CancellationToken ct = default)
        {
            var predictUrl = $"{_baseUrl}/predict";
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(3));

            var sw = Stopwatch.StartNew();
            try
            {
                // Thử /health trước; nếu FastAPI chưa định nghĩa route /health thì server vẫn phản hồi HTTP (404) -> chứng tỏ service đang chạy
                using var res = await _httpClient.GetAsync($"{_baseUrl}/health", cts.Token);
                sw.Stop();
                return new MlHealthStatus(
                    Online: true,
                    LatencyMs: sw.ElapsedMilliseconds,
                    Endpoint: predictUrl,
                    Detail: res.IsSuccessStatusCode ? "Dịch vụ ML đang hoạt động bình thường" : $"Server phản hồi HTTP {(int)res.StatusCode}");
            }
            catch (Exception ex)
            {
                sw.Stop();
                return new MlHealthStatus(
                    Online: false,
                    LatencyMs: null,
                    Endpoint: predictUrl,
                    Detail: $"Không kết nối được tới dịch vụ ML ({ex.GetType().Name})");
            }
        }
    }
}