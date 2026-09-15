using System.ComponentModel.DataAnnotations;

namespace FraudRiskMgmt.API.DTOs
{
    public class ManagerProposalDecisionRequest
    {
        //public int ManagerId { get; set; }
        [Required, StringLength(2000)]
        public string DecisionNote { get; set; } = string.Empty;
    }
}
