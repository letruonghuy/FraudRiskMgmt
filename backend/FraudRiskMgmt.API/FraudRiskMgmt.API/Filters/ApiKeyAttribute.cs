using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace FraudRiskMgmt.API.Filters
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class ApiKeyAttribute : Attribute, IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var expected = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>()["Ingest:ApiKey"];
            if (string.IsNullOrEmpty(expected))
            {
                context.Result = new StatusCodeResult(500);   // chưa cấu hình khoá thì từ chối tất cả
                return;
            }
            if (!context.HttpContext.Request.Headers.TryGetValue("X-Api-Key", out var provided) ||
                !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(provided.ToString()), Encoding.UTF8.GetBytes(expected)))
            {
                context.Result = new UnauthorizedObjectResult(new { success = false, message = "API key không hợp lệ" });
                return;
            }
            await next();
        }
    }
}