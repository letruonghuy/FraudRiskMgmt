using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FraudRiskMgmt.API.Models
{
    public class Alert
    {
        [Key]
        public int AlertId { get; set; }
        public int TransactionId { get; set; }
        public Transactions Transaction { get; set; } = null!; 

        public int? CaseId { get; set; }
        public Cases? Case { get; set; }
        
        public double RiskScore { get; set; }
        public string RiskLevel { get; set; } = string.Empty;
        public string Status { get; set; } = AlertStatuses.New;
        public DateTime CreatedAt {  get; set; }
        public int? AssignedTo { get; set; }
        [ForeignKey("AssignedTo")]
        public User? AssignedToUser { get; set; }
        public DateTime? DeletedAt { get; set; } = null;
    }

}
