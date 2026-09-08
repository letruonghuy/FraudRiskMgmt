using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FraudRiskMgmt.API.Models
{
    public class CaseActionProposal
    {
        [Key]
        public int CaseActionProposalId { get; set; }
        public int CaseId { get; set; }
        [ForeignKey(nameof(CaseId))]
        public Cases Case { get; set; } = null!;
        public int ProposedBy { get; set; }
        [ForeignKey(nameof(ProposedBy))]
        public User ProposedByUser { get; set; } = null!;
        [Required]
        public string Action { get; set; } = string.Empty;
        [Required]
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = ProposalStatuses.Pending;
        public string? DecisionNote { get; set; }
        public int? DecidedBy { get; set; }
        [ForeignKey(nameof(DecidedBy))]
        public User? DecidedByUser { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? DecidedAt { get; set; }
    }
}
