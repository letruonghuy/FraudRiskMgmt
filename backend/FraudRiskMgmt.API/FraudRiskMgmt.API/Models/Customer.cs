using System.ComponentModel.DataAnnotations;

namespace FraudRiskMgmt.API.Models
{
    public class Customer
    {
        [Key]
        public int CustomerId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string AccountNumber {  get; set; }= string.Empty;
        public DateTime CreatedAt {  get; set; }
        public DateTime? DeletedAt { get; set; } = null;
    }
}
