using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Mvc;
using FraudRiskMgmt.API.Models;

namespace FraudRiskMgmt.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TransactionController : ControllerBase
    {
        private readonly MLService _mlService;
        private readonly AppDbContext _appDbContext; 

        public TransactionController(MLService mLService, AppDbContext appDbcontext)
        {
            _mlService = mLService;
            _appDbContext = appDbcontext;
        }

        [HttpPost("predict")]
        public async Task<IActionResult> Predict([FromBody] TransactionRequest request)
        {
            var result = await _mlService.PredictAsync(request);

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
                RiskLevel = result.RiskScore >= 0.89 ? "Critical" :
                            result.RiskScore >= 0.75 ? "High" :
                            result.RiskScore >= 0.50 ? "Medium" :
                            result.RiskScore >= 0.30 ? "Low" : "Safe",
                TransactionTime = DateTime.Now,
            };

            try
            {
                _appDbContext.Transactions.Add(transaction);
                await _appDbContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException?.Message ?? ex.Message;
                return BadRequest(innerMessage);
            }

            if (result.RiskScore >= 0.3)
            {
                var alert = new Alert
                {
                    TransactionId = transaction.TransactionId,
                    RiskScore = result.RiskScore,
                    RiskLevel = transaction.RiskLevel,
                    Status = "New",
                    CreatedAt = DateTime.Now,

                };
                _appDbContext.Alerts.Add(alert);
                await _appDbContext.SaveChangesAsync();
            }    
            
            return Ok(result);
        }
    }
}
