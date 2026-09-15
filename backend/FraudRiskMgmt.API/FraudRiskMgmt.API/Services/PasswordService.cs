using FraudRiskMgmt.API.Models;
using Microsoft.AspNetCore.Identity;

namespace FraudRiskMgmt.API.Services
{
    public class PasswordService
    {
        private readonly PasswordHasher<User> _passwordHasher;

        public PasswordService()
        {
             _passwordHasher = new PasswordHasher<User>();
        }

        //public (bool isValid, string message) ValidatePassword(string password)
        //{
        //    if (password.Length < 8)
        //        return (false, "Password phải ≥ 8 ký tự");

        //    if (!password.Any(c => char.IsUpper(c)))
        //        return (false, "Password phải có chữ hoa");

        //    if (!password.Any(c => char.IsDigit(c)))
        //        return (false, "Password phải có số");

        //    return (true, "OK");
        //}


        public string HashPassword(User user, string password)
        {
            return _passwordHasher.HashPassword(user, password);
        }

        public bool VerifyPassword(User user, string password, string passwordHash)
        {
            var result = _passwordHasher.VerifyHashedPassword(
                user,
                passwordHash,
                password);

            return result == PasswordVerificationResult.Success ||
                   result == PasswordVerificationResult.SuccessRehashNeeded;
        }
    }
}
