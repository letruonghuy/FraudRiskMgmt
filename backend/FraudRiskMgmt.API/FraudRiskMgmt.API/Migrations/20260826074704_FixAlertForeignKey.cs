using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudRiskMgmt.API.Migrations
{
    /// <inheritdoc />
    public partial class FixAlertForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Alerts_Users_AssignedToUserUserId",
                table: "Alerts");

            migrationBuilder.DropIndex(
                name: "IX_Alerts_AssignedToUserUserId",
                table: "Alerts");

            migrationBuilder.DropColumn(
                name: "AssignedToUserUserId",
                table: "Alerts");

            migrationBuilder.CreateIndex(
                name: "IX_Alerts_AssignedTo",
                table: "Alerts",
                column: "AssignedTo");

            migrationBuilder.AddForeignKey(
                name: "FK_Alerts_Users_AssignedTo",
                table: "Alerts",
                column: "AssignedTo",
                principalTable: "Users",
                principalColumn: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Alerts_Users_AssignedTo",
                table: "Alerts");

            migrationBuilder.DropIndex(
                name: "IX_Alerts_AssignedTo",
                table: "Alerts");

            migrationBuilder.AddColumn<int>(
                name: "AssignedToUserUserId",
                table: "Alerts",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Alerts_AssignedToUserUserId",
                table: "Alerts",
                column: "AssignedToUserUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Alerts_Users_AssignedToUserUserId",
                table: "Alerts",
                column: "AssignedToUserUserId",
                principalTable: "Users",
                principalColumn: "UserId");
        }
    }
}
