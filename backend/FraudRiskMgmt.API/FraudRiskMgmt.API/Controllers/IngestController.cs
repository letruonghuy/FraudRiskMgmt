using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Filters;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FraudRiskMgmt.API.Controllers
{
    public record EscalateTransactionRequest(string? Reason);

    [AllowAnonymous]
    [ApiKey]
    [ApiController]
    [Route("api/ingest")]
    public class IngestController : ControllerBase
    {
        private readonly IngestService _ingest;
        public IngestController(IngestService ingest) => _ingest = ingest;

        [HttpPost("transactions")]
        public async Task<IActionResult> Ingest([FromBody] IngestTransactionRequest request)
        {
            try
            {
                var result = await _ingest.IngestAsync(request);
                return result.Duplicate ? Ok(result) : StatusCode(StatusCodes.Status201Created, result);
            }
            catch (MlUnavailableException ex)
            {
                Response.Headers["Retry-After"] = "5";
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { success = false, message = ex.Message });
            }
        }

        [HttpPost("transactions/{transactionId:int}/escalate")]
        public async Task<IActionResult> Escalate(int transactionId, [FromBody] EscalateTransactionRequest? request)
        {
            var result = await _ingest.CreateManualAlertAsync(transactionId, request?.Reason);
            if (result == null)
                return NotFound(new { success = false, message = "Không tìm thấy giao dịch cần hậu kiểm." });

            return result.Created ? StatusCode(StatusCodes.Status201Created, result) : Ok(result);
        }
    }
}