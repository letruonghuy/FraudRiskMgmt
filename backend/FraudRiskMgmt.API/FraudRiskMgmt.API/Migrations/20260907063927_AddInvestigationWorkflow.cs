using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FraudRiskMgmt.API.Migrations
{
    /// <inheritdoc />
    public partial class AddInvestigationWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Alerts_Cases_CaseId",
                table: "Alerts");

            migrationBuilder.CreateTable(
                name: "CaseActionProposals",
                columns: table => new
                {
                    CaseActionProposalId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CaseId = table.Column<int>(type: "int", nullable: false),
                    ProposedBy = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DecisionNote = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DecidedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaseActionProposals", x => x.CaseActionProposalId);
                    table.ForeignKey(
                        name: "FK_CaseActionProposals_Cases_CaseId",
                        column: x => x.CaseId,
                        principalTable: "Cases",
                        principalColumn: "CaseId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CaseActionProposals_Users_DecidedBy",
                        column: x => x.DecidedBy,
                        principalTable: "Users",
                        principalColumn: "UserId");
                    table.ForeignKey(
                        name: "FK_CaseActionProposals_Users_ProposedBy",
                        column: x => x.ProposedBy,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "InvestigationNotes",
                columns: table => new
                {
                    InvestigationNoteId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CaseId = table.Column<int>(type: "int", nullable: false),
                    AuthorId = table.Column<int>(type: "int", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestigationNotes", x => x.InvestigationNoteId);
                    table.ForeignKey(
                        name: "FK_InvestigationNotes_Cases_CaseId",
                        column: x => x.CaseId,
                        principalTable: "Cases",
                        principalColumn: "CaseId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InvestigationNotes_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_CaseActionProposals_CaseId",
                table: "CaseActionProposals",
                column: "CaseId");

            migrationBuilder.CreateIndex(
                name: "IX_CaseActionProposals_DecidedBy",
                table: "CaseActionProposals",
                column: "DecidedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CaseActionProposals_ProposedBy",
                table: "CaseActionProposals",
                column: "ProposedBy");

            migrationBuilder.CreateIndex(
                name: "IX_InvestigationNotes_AuthorId",
                table: "InvestigationNotes",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestigationNotes_CaseId",
                table: "InvestigationNotes",
                column: "CaseId");

            migrationBuilder.AddForeignKey(
                name: "FK_Alerts_Cases_CaseId",
                table: "Alerts",
                column: "CaseId",
                principalTable: "Cases",
                principalColumn: "CaseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Alerts_Cases_CaseId",
                table: "Alerts");

            migrationBuilder.DropTable(
                name: "CaseActionProposals");

            migrationBuilder.DropTable(
                name: "InvestigationNotes");

            migrationBuilder.AddForeignKey(
                name: "FK_Alerts_Cases_CaseId",
                table: "Alerts",
                column: "CaseId",
                principalTable: "Cases",
                principalColumn: "CaseId",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
