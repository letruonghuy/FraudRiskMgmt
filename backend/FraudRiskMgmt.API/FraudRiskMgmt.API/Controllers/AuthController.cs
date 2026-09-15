using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FraudRiskMgmt.API.DTOs;

namespace FraudRiskMgmt.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;
        private readonly PasswordService _passwordService;
        private readonly JwtService _jwtService;

        public AuthController(AppDbContext appDbContext, PasswordService passwordService, JwtService jwtService)
        {
            _appDbContext = appDbContext;
            _passwordService = passwordService;
            _jwtService = jwtService;
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
                    return Unauthorized("Email chưa đăng ký");
                }

                var isValid = _passwordService.VerifyPassword(user, request.Password, user.PasswordHash);
                if (!isValid)
                {
                    return Unauthorized("Email hoặc mật khẩu không đúng");
                }

                return Ok(new LoginResponse
                {
                    UserId = user.UserId,
                    FullName = user.FullName,
                    Email = user.Email,
                    Role = user.Role.ToString(),
                    Token = _jwtService.GenerateToken(user)
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during login: {ex.Message}");
                return StatusCode(500, "Đã xảy ra lỗi trong quá trình đăng nhập");
            }
        }
    }
}
