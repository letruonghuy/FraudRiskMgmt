using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Extensions;

namespace FraudRiskMgmt.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;
        private readonly PasswordService _passwordService;
        private readonly JwtService _jwtService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            AppDbContext appDbContext,
            PasswordService passwordService,
            JwtService jwtService,
            ILogger<AuthController> logger)
        {
            _appDbContext = appDbContext;
            _passwordService = passwordService;
            _jwtService = jwtService;
            _logger = logger;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                var normalizedEmail = request.Email.Trim().ToLowerInvariant();
                var user = await _appDbContext.Users
                    .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

                if (user == null)
                {
                    _logger.LogWarning("Login thất bại - Email không tồn tại: {Email}", normalizedEmail);
                    return Unauthorized(ApiResponse<object>.Fail("Email hoặc mật khẩu không đúng"));
                }

                var isValid = _passwordService.VerifyPassword(user, request.Password, user.PasswordHash);
                if (!isValid)
                {
                    _logger.LogWarning("Login thất bại - Sai mật khẩu: {Email}", normalizedEmail);
                    return Unauthorized(ApiResponse<object>.Fail("Email hoặc mật khẩu không đúng"));
                }

                _logger.LogInformation("Login thành công: {Email}, Role: {Role}", normalizedEmail, user.Role);
                return Ok(ApiResponse<LoginResponse>.Ok(new LoginResponse
                {
                    UserId = user.UserId,
                    FullName = user.FullName,
                    Email = user.Email,
                    Role = user.Role.ToString(),
                    Token = _jwtService.GenerateToken(user)
                }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi hệ thống khi login: {Email}", request.Email);
                return StatusCode(500, ApiResponse<object>.Fail("Đã xảy ra lỗi trong quá trình đăng nhập"));
            }
        }
    }
}