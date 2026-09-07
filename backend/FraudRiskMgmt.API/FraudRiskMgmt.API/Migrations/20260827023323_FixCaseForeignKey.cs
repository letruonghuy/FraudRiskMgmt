using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudRiskMgmt.API.Migrations
{
    /// <inheritdoc />
    public partial class FixCaseForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cases_Users_OpenedByUserUserId",
                table: "Cases");

            migrationBuilder.DropIndex(
                name: "IX_Cases_OpenedByUserUserId",
                table: "Cases");

            migrationBuilder.DropColumn(
                name: "OpenedByUserUserId",
                table: "Cases");

            migrationBuilder.CreateIndex(
                name: "IX_Cases_OpenedBy",
                table: "Cases",
                column: "OpenedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_Cases_Users_OpenedBy",
                table: "Cases",
                column: "OpenedBy",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cases_Users_OpenedBy",
                table: "Cases");

            migrationBuilder.DropIndex(
                name: "IX_Cases_OpenedBy",
                table: "Cases");

            migrationBuilder.AddColumn<int>(
                name: "OpenedByUserUserId",
                table: "Cases",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Cases_OpenedByUserUserId",
                table: "Cases",
                column: "OpenedByUserUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Cases_Users_OpenedByUserUserId",
                table: "Cases",
                column: "OpenedByUserUserId",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
