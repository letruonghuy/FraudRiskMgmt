using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FraudRiskMgmt.API.Models
{
    public class InvestigationNote
    {
        [Key]
        public int InvestigationNoteId { get; set; }
        public int CaseId { get; set; }
        [ForeignKey(nameof(CaseId))]
        public Cases Case { get; set; } = null!;
        public int AuthorId { get; set; }
        [ForeignKey(nameof(AuthorId))]
        public User Author { get; set; } = null!;
        [Required]
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
