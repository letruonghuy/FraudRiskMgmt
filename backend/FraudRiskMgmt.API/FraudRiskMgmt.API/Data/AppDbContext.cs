using FraudRiskMgmt.API.Models;
using Microsoft.EntityFrameworkCore;

namespace FraudRiskMgmt.API.Data
{
    public class AppDbContext: DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }


        public DbSet<Customer> Customers { get; set; }
        public DbSet<Transactions> Transactions { get; set; }
        public DbSet<Alert> Alerts { get; set; }
        public DbSet<Cases> Cases { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<InvestigationNote> InvestigationNotes { get; set; }
        public DbSet<CaseActionProposal> CaseActionProposals { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Alert>()
                .HasOne(alert => alert.Case)
                .WithMany(caseItem => caseItem.Alerts)
                .HasForeignKey(alert => alert.CaseId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Alert>()
                .HasIndex(alert => alert.CaseId);

            modelBuilder.Entity<InvestigationNote>()
                .HasOne(note => note.Case)
                .WithMany(caseItem => caseItem.InvestigationNotes)
                .HasForeignKey(note => note.CaseId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<InvestigationNote>()
                .HasOne(note => note.Author)
                .WithMany()
                .HasForeignKey(note => note.AuthorId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<CaseActionProposal>()
                .HasOne(proposal => proposal.Case)
                .WithMany(caseItem => caseItem.ActionProposals)
                .HasForeignKey(proposal => proposal.CaseId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CaseActionProposal>()
                .HasOne(proposal => proposal.ProposedByUser)
                .WithMany()
                .HasForeignKey(proposal => proposal.ProposedBy)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<CaseActionProposal>()
                .HasOne(proposal => proposal.DecidedByUser)
                .WithMany()
                .HasForeignKey(proposal => proposal.DecidedBy)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
