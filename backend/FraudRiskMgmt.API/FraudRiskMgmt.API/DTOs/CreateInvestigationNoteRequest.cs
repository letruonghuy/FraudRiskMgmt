using System.ComponentModel.DataAnnotations;

namespace FraudRiskMgmt.API.DTOs
{
    public class CreateInvestigationNoteRequest
    {
        public int OfficerId { get; set; }
        [Required, StringLength(2000)]
        public string Content { get; set; } = string.Empty;
    }
}
