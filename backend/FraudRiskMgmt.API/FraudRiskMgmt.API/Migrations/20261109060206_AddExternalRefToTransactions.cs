using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudRiskMgmt.API.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalRefToTransactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalRef",
                table: "Transactions",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_ExternalRef",
                table: "Transactions",
                column: "ExternalRef",
                unique: true,
                filter: "[ExternalRef] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_ExternalRef",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ExternalRef",
                table: "Transactions");
        }
    }
}
