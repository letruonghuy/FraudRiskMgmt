using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudRiskMgmt.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueEmailIndexAndRoleConversion : Migration
    {
        /// <inheritdoc />
        //protected override void Up(MigrationBuilder migrationBuilder)
        //{
        //    // Add unique index on Email
        //    migrationBuilder.CreateIndex(
        //        name: "IX_Users_Email",
        //        table: "Users",
        //        column: "Email",
        //        unique: true);

        //    // Convert Role from int to string
        //    migrationBuilder.AlterColumn<string>(
        //        name: "Role",
        //        table: "Users",
        //        type: "nvarchar(max)",
        //        nullable: false,
        //        oldClrType: typeof(int),
        //        oldType: "int");
        //}

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Đổi Email sang nvarchar(256) trước
            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Users",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            // Rồi mới tạo index
            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            // Convert Role từ int sang string
            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop unique index on Email
            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            // Convert Role back from string to int
            migrationBuilder.AlterColumn<int>(
                name: "Role",
                table: "Users",
                type: "int",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");
        }
    }
}
