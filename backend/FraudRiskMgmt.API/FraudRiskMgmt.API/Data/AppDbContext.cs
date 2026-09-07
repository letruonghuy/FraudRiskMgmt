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

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Alert>()
                .HasOne(alert => alert.Case)
                .WithMany(caseItem => caseItem.Alerts)
                .HasForeignKey(alert => alert.CaseId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Alert>()
                .HasIndex(alert => alert.CaseId);
        }
    }
}
