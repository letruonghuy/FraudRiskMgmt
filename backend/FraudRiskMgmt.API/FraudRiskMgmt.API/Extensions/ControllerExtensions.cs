using FraudRiskMgmt.API.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace FraudRiskMgmt.API.Extensions
{
    public static class ControllerExtensions
    {
        public static IActionResult ApiNotFound(this ControllerBase controller, string message)
            => controller.NotFound(ApiResponse<object>.Fail(message));

        public static IActionResult ApiConflict(this ControllerBase controller, string message)
            => controller.Conflict(ApiResponse<object>.Fail(message));

        public static IActionResult ApiBadRequest(this ControllerBase controller, string message)
            => controller.BadRequest(ApiResponse<object>.Fail(message));

        public static IActionResult ApiOk<T>(this ControllerBase controller, T data, string message = "Thành công")
            => controller.Ok(ApiResponse<T>.Ok(data, message));

        public static (bool isValid, IActionResult? error) ValidatePagination(
       this ControllerBase controller,
       int page,
       int pageSize)
        {
            if (page < 1)
                return (false, controller.BadRequest(ApiResponse<object>.Fail("page phải lớn hơn 0")));
            if (pageSize < 1)
                return (false, controller.BadRequest(ApiResponse<object>.Fail("pageSize phải lớn hơn 0")));
            if (pageSize > 100)
                return (false, controller.BadRequest(ApiResponse<object>.Fail("pageSize không được vượt quá 100")));
            return (true, null);
        }

        public static (bool isValid, IActionResult? error) ValidateSortBy(
            this ControllerBase controller,
            string? sortBy,
            string? sortOrder,
            string[] allowedFields)
        {
            if (!string.IsNullOrEmpty(sortBy) && !allowedFields.Contains(sortBy.ToLowerInvariant()))
                return (false, controller.BadRequest(ApiResponse<object>.Fail(
                    $"sortBy không hợp lệ. Các giá trị hợp lệ: {string.Join(", ", allowedFields)}")));

            if (!string.IsNullOrEmpty(sortOrder) &&
                sortOrder.ToLowerInvariant() != "asc" &&
                sortOrder.ToLowerInvariant() != "desc")
                return (false, controller.BadRequest(ApiResponse<object>.Fail("sortOrder chỉ nhận 'asc' hoặc 'desc'")));

            return (true, null);
        }
    }
}