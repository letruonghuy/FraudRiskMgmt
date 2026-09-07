using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FraudRiskMgmt.API.Models
{
    public class Cases
    {
        [Key]
        public int CaseId { get; set; }
        public int CustomerId { get; set; }
        public Customer Customer { get; set; } = null!;  
        public string Status {  get; set; } = CaseStatuses.Open;
        public int OpenedBy {  get; set; }
        [ForeignKey("OpenedBy")]
        public User OpenedByUser { get; set; } = null!; 
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public DateTime? DeletedAt {  get; set; }
        public ICollection<Alert> Alerts { get; set; } = new List<Alert>();

    }
}
