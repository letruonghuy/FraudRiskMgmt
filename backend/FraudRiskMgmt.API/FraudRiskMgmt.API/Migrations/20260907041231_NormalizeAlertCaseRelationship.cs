using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudRiskMgmt.API.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeAlertCaseRelationship : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE Alerts
                SET CaseId = CaseId1
                WHERE CaseId IS NULL AND CaseId1 IS NOT NULL;

                UPDATE alert
                SET CaseId = caseItem.CaseId
                FROM Alerts AS alert
                INNER JOIN Cases AS caseItem ON caseItem.AlertId = alert.AlertId
                WHERE alert.CaseId IS NULL AND caseItem.AlertId <> 0;
            ");

            migrationBuilder.DropForeignKey(
                name: "FK_Alerts_Cases_CaseId1",
                table: "Alerts");

            migrationBuilder.DropIndex(
                name: "IX_Alerts_CaseId1",
                table: "Alerts");

            migrationBuilder.DropColumn(
                name: "AlertId",
                table: "Cases");

            migrationBuilder.DropColumn(
                name: "CaseId1",
                table: "Alerts");

            migrationBuilder.CreateIndex(
                name: "IX_Alerts_CaseId",
                table: "Alerts",
                column: "CaseId");

            migrationBuilder.AddForeignKey(
                name: "FK_Alerts_Cases_CaseId",
                table: "Alerts",
                column: "CaseId",
                principalTable: "Cases",
                principalColumn: "CaseId",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Alerts_Cases_CaseId",
                table: "Alerts");

            migrationBuilder.DropIndex(
                name: "IX_Alerts_CaseId",
                table: "Alerts");

            migrationBuilder.AddColumn<int>(
                name: "AlertId",
                table: "Cases",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CaseId1",
                table: "Alerts",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Alerts_CaseId1",
                table: "Alerts",
                column: "CaseId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Alerts_Cases_CaseId1",
                table: "Alerts",
                column: "CaseId1",
                principalTable: "Cases",
                principalColumn: "CaseId");
        }
    }
}
