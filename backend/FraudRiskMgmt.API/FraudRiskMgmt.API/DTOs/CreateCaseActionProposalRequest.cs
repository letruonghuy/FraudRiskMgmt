using System.ComponentModel.DataAnnotations;

namespace FraudRiskMgmt.API.DTOs
{
    public class CreateCaseActionProposalRequest
    {
        //public int OfficerId { get; set; }
        [Required, StringLength(50)]
        public string Action { get; set; } = string.Empty;
        [Required, StringLength(2000)]
        public string Reason { get; set; } = string.Empty;
    }
}
