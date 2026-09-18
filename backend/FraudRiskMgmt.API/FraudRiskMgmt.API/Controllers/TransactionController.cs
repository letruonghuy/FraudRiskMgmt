using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FraudRiskMgmt.API.Models;
using FraudRiskMgmt.API.Extensions;

namespace FraudRiskMgmt.API.Controllers
{
    [Authorize(Roles = "Officer")]
    [Route("api/[controller]")]
    [ApiController]
    public class TransactionController : ControllerBase
    {
        private readonly MLService _mlService;
        private readonly AppDbContext _appDbContext;
        private readonly ILogger<TransactionController> _logger;

        public TransactionController(
            MLService mLService,
            AppDbContext appDbcontext,
            ILogger<TransactionController> logger)
        {
            _mlService = mLService;
            _appDbContext = appDbcontext;
            _logger = logger;
        }

        [HttpPost("predict")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> Predict([FromBody] TransactionRequest request)
        {
            var result = await _mlService.PredictAsync(request);

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                var transaction = new Transactions
                {
                    Amount = request.Amount,
                    OldBalanceOrg = request.OldBalanceOrg,
                    NewBalanceOrig = request.NewBalanceOrig,
                    OldBalanceDest = request.OldBalanceDest,
                    NewBalanceDest = request.NewBalanceDest,
                    RiskScore = result.RiskScore,
                    CustomerId = request.CustomerId,
                    TransactionType = request.TransactionType,
                    NameOrig = request.NameOrig,
                    NameDest = request.NameDest,
                    RiskLevel = result.RiskScore >= 0.89 ? RiskLevels.Critical :
                                result.RiskScore >= 0.75 ? RiskLevels.High :
                                result.RiskScore >= 0.50 ? RiskLevels.Medium :
                                result.RiskScore >= 0.30 ? RiskLevels.Low : RiskLevels.Safe,
                    TransactionTime = DateTime.UtcNow,
                };

                _appDbContext.Transactions.Add(transaction);
                await _appDbContext.SaveChangesAsync();

                if (result.RiskScore >= 0.3)
                {
                    var alert = new Alert
                    {
                        TransactionId = transaction.TransactionId,
                        RiskScore = result.RiskScore,
                        RiskLevel = transaction.RiskLevel,
                        Status = AlertStatuses.New,
                        CreatedAt = DateTime.UtcNow,
                    };
                    _appDbContext.Alerts.Add(alert);
                    await _appDbContext.SaveChangesAsync();
                }

                await dbTransaction.CommitAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi predict transaction cho CustomerId {CustomerId}", request.CustomerId);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }
    }
}