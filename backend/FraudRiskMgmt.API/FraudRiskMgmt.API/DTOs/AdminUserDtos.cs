using System.ComponentModel.DataAnnotations;

namespace FraudRiskMgmt.API.DTOs
{
    public class AdminUserDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }
    }

    public class CreateUserRequest
    {
        [Required(ErrorMessage = "Họ tên là bắt buộc.")]
        [StringLength(120, MinimumLength = 2)]
        public string FullName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email là bắt buộc.")]
        [EmailAddress(ErrorMessage = "Định dạng email không hợp lệ.")]
        [StringLength(160)]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mật khẩu khởi tạo là bắt buộc.")]
        [StringLength(100, MinimumLength = 6, ErrorMessage = "Mật khẩu phải từ 6 ký tự trở lên.")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Vai trò là bắt buộc.")]
        public string Role { get; set; } = "Officer";
    }

    public class UpdateUserRoleRequest
    {
        [Required(ErrorMessage = "Vai trò mới là bắt buộc.")]
        public string Role { get; set; } = string.Empty;

        [Required(ErrorMessage = "Lý do điều chuyển vai trò là bắt buộc.")]
        [StringLength(500, MinimumLength = 5, ErrorMessage = "Lý do phải từ 5 đến 500 ký tự.")]
        public string Reason { get; set; } = string.Empty;
    }

    public class ToggleUserStatusRequest
    {
        public bool IsActive { get; set; }

        [Required(ErrorMessage = "Lý do khóa/mở khóa tài khoản là bắt buộc.")]
        [StringLength(500, MinimumLength = 5, ErrorMessage = "Lý do phải từ 5 đến 500 ký tự.")]
        public string Reason { get; set; } = string.Empty;
    }

    public class ResetUserPasswordRequest
    {
        [Required(ErrorMessage = "Mật khẩu mới là bắt buộc.")]
        [StringLength(100, MinimumLength = 6, ErrorMessage = "Mật khẩu mới phải từ 6 ký tự trở lên.")]
        public string NewPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "Lý do đặt lại mật khẩu là bắt buộc.")]
        [StringLength(500, MinimumLength = 5, ErrorMessage = "Lý do phải từ 5 đến 500 ký tự.")]
        public string Reason { get; set; } = string.Empty;
    }
}