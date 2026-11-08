using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudRiskMgmt.API.Migrations
{
    /// <inheritdoc />
    public partial class AddHourToTransactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Hour",
                table: "Transactions",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Hour",
                table: "Transactions");
        }
    }
}
