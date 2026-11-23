using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Models;
using FraudRiskMgmt.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using FraudRiskMgmt.API.Middlewares;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:SecretKey"]!))
        };

        // Mỗi request đều đối chiếu lại DB: tài khoản bị khóa / xóa / đổi vai trò
        // thì token cũ lập tức mất hiệu lực (không phải chờ hết hạn).
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async ctx =>
            {
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var rawUserId = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                var tokenRole = ctx.Principal?.FindFirstValue(ClaimTypes.Role);

                if (!int.TryParse(rawUserId, out var userId))
                {
                    ctx.Fail("Token không hợp lệ.");
                    return;
                }

                var account = await db.Users
                    .AsNoTracking()
                    .Where(u => u.UserId == userId)
                    .Select(u => new { u.IsActive, u.DeletedAt, u.Role })
                    .FirstOrDefaultAsync();

                if (account == null
                    || !account.IsActive
                    || account.DeletedAt != null
                    || account.Role.ToString() != tokenRole)
                {
                    ctx.Fail("Tài khoản đã bị khóa hoặc đổi quyền, vui lòng đăng nhập lại.");
                }
            }
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:5175"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<AuditLogService>();

builder.Services.Configure<RiskPolicyOptions>(builder.Configuration.GetSection("RiskPolicy"));
//builder.Services.AddSingleton<RiskPolicy>();
builder.Services.AddScoped<RiskPolicy>();

builder.Services.AddScoped<IngestService>();

// Add services to the container.
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .SelectMany(e => e.Value!.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();

            var response = ApiResponse<object>.Fail("Dữ liệu không hợp lệ", errors);
            return new BadRequestObjectResult(response);
        };
    }).AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
        o.JsonSerializerOptions.Converters.Add(new UtcNullableDateTimeConverter());
    });

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Nhập JWT token. Ví dụ: Bearer eyJhbGci..."
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddHttpClient<MLService>();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// ---------------------------------------------------------------------------
// Seed tài khoản mặc định (chỉ tạo khi chưa tồn tại, KHÔNG đụng tới tài khoản có sẵn).
// Mật khẩu đọc từ cấu hình (Seed:AdminPassword / Seed:OfficerPassword, nên đặt trong
// user-secrets hoặc appsettings.Development.json). Riêng môi trường Development có
// mật khẩu mặc định để tiện chạy thử; môi trường khác mà không cấu hình thì bỏ qua.
// Lưu ý: đã bỏ đoạn "tự mở khóa tài khoản chưa đăng nhập" vì nó làm mất tác dụng chức năng Khóa.
// ---------------------------------------------------------------------------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var passwordService = scope.ServiceProvider.GetRequiredService<PasswordService>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    var isDev = app.Environment.IsDevelopment();
    var adminPassword = builder.Configuration["Seed:AdminPassword"] ?? (isDev ? "Admin@123" : null);
    var officerPassword = builder.Configuration["Seed:OfficerPassword"] ?? (isDev ? "123456789" : null);

    if (!db.RiskPolicyConfigs.Any())
    {
        var defaultAlertThreshold = builder.Configuration.GetValue<double?>("RiskPolicy:AlertThreshold") ?? 0.32;
        var defaultHighConfidence = builder.Configuration.GetValue<double?>("RiskPolicy:HighConfidenceScore") ?? 0.85;
        var defaultLargeAmount = builder.Configuration.GetValue<double?>("RiskPolicy:LargeAmount") ?? 1_500_000;

        db.RiskPolicyConfigs.Add(new RiskPolicyConfig
        {
            AlertThreshold = defaultAlertThreshold,
            HighConfidenceScore = defaultHighConfidence,
            LargeAmount = defaultLargeAmount,
            UpdatedAt = DateTime.UtcNow,
            LastChangeReason = "Khởi tạo tham số mặc định từ cấu hình hệ thống"
        });
        db.SaveChanges();
    }

    void SeedUser(string email, string fullName, UserRole role, string? password)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        if (db.Users.Any(u => u.Email.ToLower() == normalizedEmail)) return;

        if (string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning(
                "Bỏ qua tạo tài khoản mặc định {Email}: chưa cấu hình mật khẩu (mục Seed trong cấu hình).",
                normalizedEmail);
            return;
        }

        var user = new User
        {
            FullName = fullName,
            Email = normalizedEmail,
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            DeletedAt = null
        };
        user.PasswordHash = passwordService.HashPassword(user, password);

        db.Users.Add(user);
        db.SaveChanges();
    }

    SeedUser("officer@bank.com", "Nguyễn Văn Officer", UserRole.Officer, officerPassword);
    SeedUser("admin@bank.vn", "Quản trị viên hệ thống", UserRole.Admin, adminPassword);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowReactApp");
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public class UtcDateTimeConverter : System.Text.Json.Serialization.JsonConverter<DateTime>
{
    public override DateTime Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
        => DateTime.Parse(reader.GetString()!, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal);

    public override void Write(System.Text.Json.Utf8JsonWriter writer, DateTime value, System.Text.Json.JsonSerializerOptions options)
        => writer.WriteStringValue(value.Kind == DateTimeKind.Local
            ? value.ToUniversalTime()
            : DateTime.SpecifyKind(value, DateTimeKind.Utc));
}

public class UtcNullableDateTimeConverter : System.Text.Json.Serialization.JsonConverter<DateTime?>
{
    public override DateTime? Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
        => reader.TokenType == System.Text.Json.JsonTokenType.Null
            ? null
            : DateTime.Parse(reader.GetString()!, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal);

    public override void Write(System.Text.Json.Utf8JsonWriter writer, DateTime? value, System.Text.Json.JsonSerializerOptions options)
    {
        if (value is null) { writer.WriteNullValue(); return; }
        writer.WriteStringValue(value.Value.Kind == DateTimeKind.Local
            ? value.Value.ToUniversalTime()
            : DateTime.SpecifyKind(value.Value, DateTimeKind.Utc));
    }
}