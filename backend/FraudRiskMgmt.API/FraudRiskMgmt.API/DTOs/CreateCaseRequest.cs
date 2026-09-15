namespace FraudRiskMgmt.API.DTOs
{
    public class CreateCaseRequest
    {
        public int AlertId {  get; set; }
        public int CustomerId {  get; set; }
        public string Note { get; set; } = string.Empty;
        //public int OfficerId { get; set; }
    }
}
