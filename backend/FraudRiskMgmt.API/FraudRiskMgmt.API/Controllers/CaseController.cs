using FraudRiskMgmt.API.Data;
using FraudRiskMgmt.API.DTOs;
using FraudRiskMgmt.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using FraudRiskMgmt.API.Services;
using FraudRiskMgmt.API.Extensions;

namespace FraudRiskMgmt.API.Controllers
{
    [Authorize(Roles = "Officer,Manager")]
    [Route("api/[controller]")]
    [ApiController]
    public class CaseController : ControllerBase
    {
        private readonly AppDbContext _appDbContext;
        private readonly AuditLogService _auditLogService;
        private readonly ILogger<CaseController> _logger;

        public CaseController(
            AppDbContext appDbContext,
            AuditLogService auditLogService,
            ILogger<CaseController> logger)
        {
            _appDbContext = appDbContext;
            _auditLogService = auditLogService;
            _logger = logger;
        }

        [HttpPost]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> CreatedCase([FromBody] CreateCaseRequest request)
        {
            var alert = await _appDbContext.Alerts
                .Include(item => item.Transaction)
                .SingleOrDefaultAsync(item => item.AlertId == request.AlertId);
            if (alert == null) return this.ApiNotFound("Alert không tồn tại");
            if (alert.CaseId.HasValue) return this.ApiConflict("Alert đã thuộc một Case khác");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (alert.AssignedTo != userId) return Forbid();

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                var newCase = new Cases
                {
                    CustomerId = alert.Transaction.CustomerId,
                    Status = CaseStatuses.Open,
                    OpenedBy = userId,
                    CreatedAt = DateTime.UtcNow,
                };

                _appDbContext.Cases.Add(newCase);
                alert.Case = newCase;
                alert.Status = AlertStatuses.UnderReview;
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "CreateCase",
                    entityType: "Case",
                    entityId: newCase.CaseId,
                    oldStatus: null,
                    newStatus: CaseStatuses.Open,
                    reason: $"Case tạo từ Alert {alert.AlertId}"
                );

                await dbTransaction.CommitAsync();
                return CreatedAtAction(nameof(GetCase), new { id = newCase.CaseId }, new
                {
                    CaseId = newCase.CaseId,
                    AlertIds = new[] { alert.AlertId },
                    Status = newCase.Status
                });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi tạo Case từ Alert {AlertId}", request.AlertId);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpGet]
        [Authorize(Roles = "Officer,Manager")]
        public async Task<IActionResult> GetCase(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? status = null,
            [FromQuery] string? sortBy = "createdAt",
            [FromQuery] string? sortOrder = "desc")
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var role = User.FindFirst(ClaimTypes.Role)!.Value;

            var (pageValid, pageError) = this.ValidatePagination(page, pageSize);
            if (!pageValid) return pageError!;

            var (sortValid, sortError) = this.ValidateSortBy(sortBy, sortOrder,
                new[] { "createdat", "status" });  

            if (!sortValid) return sortError!;

            var query = _appDbContext.Cases
                .Include(c => c.Customer)
                .Include(c => c.OpenedByUser)
                .Include(c => c.Alerts)
                .AsQueryable();

            if (role == UserRole.Officer.ToString())
                query = query.Where(c => c.OpenedBy == userId);

            if (!string.IsNullOrEmpty(status))
                query = query.Where(c => c.Status == status);

            query = sortBy?.ToLower() switch
            {
                "status" => sortOrder == "asc"
                    ? query.OrderBy(c => c.Status)
                    : query.OrderByDescending(c => c.Status),
                _ => sortOrder == "asc"
                    ? query.OrderBy(c => c.CreatedAt)
                    : query.OrderByDescending(c => c.CreatedAt)
            };

            var totalCount = await query.CountAsync();

            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new CaseResponse
                {
                    CaseId = c.CaseId,
                    CustomerName = c.Customer.FullName,
                    AlertIds = c.Alerts.Select(a => a.AlertId).ToList(),
                    Status = c.Status,
                    OpenByName = c.OpenedByUser.FullName,
                    CreatedAt = c.CreatedAt,
                    ClosedAt = c.ClosedAt,
                })
                .ToListAsync();

            return Ok(new PagedResult<CaseResponse>
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                Items = items
            });
        }

        [HttpPut("{id}/proposals/{proposalId}/approve")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> ApproveProposal(
            int id, int proposalId,
            [FromBody] ManagerProposalDecisionRequest request)
        {
            var caseItem = await _appDbContext.Cases
                .SingleOrDefaultAsync(item => item.CaseId == id);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");
            if (caseItem.Status != CaseStatuses.PendingApproval)
                return this.ApiConflict("Case chưa ở trạng thái chờ phê duyệt");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy == userId) return Forbid();

            var decisionNote = request.DecisionNote.Trim();
            if (decisionNote.Length == 0) return this.ApiBadRequest("DecisionNote không được để trống");

            var proposal = await _appDbContext.CaseActionProposals
                .SingleOrDefaultAsync(item => item.CaseId == id && item.CaseActionProposalId == proposalId);
            if (proposal == null) return this.ApiNotFound("Proposal không thuộc Case này hoặc không tồn tại");
            if (proposal.Status != ProposalStatuses.Pending)
                return this.ApiConflict("Proposal đã được quyết định trước đó");

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                proposal.Status = ProposalStatuses.Approved;
                proposal.DecidedBy = userId;
                proposal.DecisionNote = decisionNote;
                proposal.DecidedAt = DateTime.UtcNow;

                var hasPendingProposal = await _appDbContext.CaseActionProposals
                    .AnyAsync(item =>
                        item.CaseId == id &&
                        item.CaseActionProposalId != proposalId &&
                        item.Status == ProposalStatuses.Pending);

                if (!hasPendingProposal)
                {
                    caseItem.Status = CaseStatuses.Approved;
                    caseItem.ClosedAt = DateTime.UtcNow;
                    var alerts = await _appDbContext.Alerts
                        .Where(alert => alert.CaseId == caseItem.CaseId)
                        .ToListAsync();
                    alerts.ForEach(alert => alert.Status = AlertStatuses.Closed);
                }

                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "ApproveProposal",
                    entityType: "Proposal",
                    entityId: proposal.CaseActionProposalId,
                    oldStatus: ProposalStatuses.Pending,
                    newStatus: ProposalStatuses.Approved,
                    reason: decisionNote
                );

                await dbTransaction.CommitAsync();
                return Ok(new
                {
                    Message = hasPendingProposal
                        ? "Proposal đã được Manager phê duyệt; Case vẫn còn Proposal chờ xử lý"
                        : "Proposal đã được Manager phê duyệt và Case đã hoàn tất",
                    CaseId = caseItem.CaseId,
                    ProposalId = proposal.CaseActionProposalId,
                    CaseStatus = caseItem.Status,
                    ProposalStatus = proposal.Status
                });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi approve Proposal {ProposalId} của Case {CaseId}", proposalId, id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpPut("{id}/proposals/{proposalId}/reject")]
        [Authorize(Roles = "Manager")]
        public async Task<IActionResult> RejectProposal(
            int id, int proposalId,
            [FromBody] ManagerProposalDecisionRequest request)
        {
            var caseItem = await _appDbContext.Cases
                .SingleOrDefaultAsync(item => item.CaseId == id);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");
            if (caseItem.Status != CaseStatuses.PendingApproval)
                return this.ApiConflict("Case chưa ở trạng thái chờ phê duyệt");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy == userId) return Forbid();

            var decisionNote = request.DecisionNote.Trim();
            if (decisionNote.Length == 0) return this.ApiBadRequest("DecisionNote không được để trống");

            var proposal = await _appDbContext.CaseActionProposals
                .SingleOrDefaultAsync(item => item.CaseId == id && item.CaseActionProposalId == proposalId);
            if (proposal == null) return this.ApiNotFound("Proposal không thuộc Case này hoặc không tồn tại");
            if (proposal.Status != ProposalStatuses.Pending)
                return this.ApiConflict("Proposal đã được quyết định trước đó");

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                proposal.Status = ProposalStatuses.Rejected;
                proposal.DecidedBy = userId;
                proposal.DecisionNote = decisionNote;
                proposal.DecidedAt = DateTime.UtcNow;
                caseItem.Status = CaseStatuses.Rework;

                var alerts = await _appDbContext.Alerts
                    .Where(alert => alert.CaseId == caseItem.CaseId)
                    .ToListAsync();
                alerts.ForEach(alert => alert.Status = AlertStatuses.UnderReview);

                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "RejectProposal",
                    entityType: "Proposal",
                    entityId: proposal.CaseActionProposalId,
                    oldStatus: ProposalStatuses.Pending,
                    newStatus: ProposalStatuses.Rejected,
                    reason: decisionNote
                );

                await dbTransaction.CommitAsync();
                return Ok(new
                {
                    Message = "Proposal bị từ chối; Case cần được Officer làm lại",
                    CaseId = caseItem.CaseId,
                    ProposalId = proposal.CaseActionProposalId,
                    CaseStatus = caseItem.Status,
                    ProposalStatus = proposal.Status
                });
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi reject Proposal {ProposalId} của Case {CaseId}", proposalId, id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpPut("{id}/investigate")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> InvestigateCase(int id)
        {
            var caseItem = await _appDbContext.Cases.FindAsync(id);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            if (caseItem.Status != CaseStatuses.Open && caseItem.Status != CaseStatuses.Rework)
                return this.ApiConflict("Case không ở trạng thái Open");

            var oldStatus = caseItem.Status;

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                caseItem.Status = CaseStatuses.Investigating;
                var alerts = await _appDbContext.Alerts
                    .Where(alert => alert.CaseId == caseItem.CaseId)
                    .ToListAsync();
                alerts.ForEach(alert => alert.Status = AlertStatuses.UnderReview);
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "InvestigateCase",
                    entityType: "Case",
                    entityId: caseItem.CaseId,
                    oldStatus: oldStatus,
                    newStatus: CaseStatuses.Investigating
                );

                await dbTransaction.CommitAsync();
                return Ok("Case đang được điều tra");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi investigate Case {CaseId}", id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }

        [HttpPost("{id}/notes")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> AddInvestigationNote(int id, [FromBody] CreateInvestigationNoteRequest request)
        {
            var caseItem = await _appDbContext.Cases.FindAsync(id);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            if (caseItem.Status != CaseStatuses.Investigating)
                return this.ApiConflict("Case chưa ở trạng thái đang điều tra");

            var note = new InvestigationNote
            {
                CaseId = id,
                AuthorId = userId,
                Content = request.Content.Trim(),
                CreatedAt = DateTime.UtcNow,
            };

            _appDbContext.InvestigationNotes.Add(note);
            await _appDbContext.SaveChangesAsync();

            await _auditLogService.LogAsync(
                userId: userId,
                action: "AddInvestigationNote",
                entityType: "Case",
                entityId: note.InvestigationNoteId,
                oldStatus: null,
                newStatus: null,
                reason: $"Ghi chú: {request.Content.Trim()[..Math.Min(100, request.Content.Trim().Length)]}"
            );
            return Ok(new { note.InvestigationNoteId, note.CaseId, note.CreatedAt });
        }

        [HttpPost("{id}/proposals")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> AddActionProposal(int id, [FromBody] CreateCaseActionProposalRequest request)
        {
            var caseItem = await _appDbContext.Cases.FindAsync(id);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            if (caseItem.Status != CaseStatuses.Investigating)
                return this.ApiConflict("Chỉ có thể đề xuất hành động khi Case đang điều tra");

            var allowedActions = new[]
            {
                "NoAction", "Monitor", "ContactCustomer", "RestrictTransaction",
                "BlockAccount", "Escalate", "FalsePositive"
            };
            if (!allowedActions.Contains(request.Action, StringComparer.OrdinalIgnoreCase))
                return this.ApiBadRequest("Hành động đề xuất không hợp lệ");

            var proposal = new CaseActionProposal
            {
                CaseId = id,
                ProposedBy = userId,
                Action = request.Action.Trim(),
                Reason = request.Reason.Trim(),
                CreatedAt = DateTime.UtcNow,
            };

            _appDbContext.CaseActionProposals.Add(proposal);
            await _appDbContext.SaveChangesAsync();

            await _auditLogService.LogAsync(
                userId: userId,
                action: "AddActionProposal",
                entityType: "Case",
                entityId: proposal.CaseActionProposalId,
                oldStatus: null,
                reason: $"Đề xuất: {request.Action} - {request.Reason.Trim()[..Math.Min(100, request.Reason.Trim().Length)]}");

            return Ok(new { proposal.CaseActionProposalId, proposal.CaseId, proposal.Action, proposal.Status });
        }

        [HttpPut("{id}/submit-for-approval")]
        [Authorize(Roles = "Officer")]
        public async Task<IActionResult> SubmitForApproval(int id)
        {
            var caseItem = await _appDbContext.Cases
                .Include(item => item.ActionProposals)
                .SingleOrDefaultAsync(item => item.CaseId == id);
            if (caseItem == null) return this.ApiNotFound("Case không tồn tại");

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (caseItem.OpenedBy != userId) return Forbid();

            if (caseItem.Status != CaseStatuses.Investigating)
                return this.ApiConflict("Case chưa ở trạng thái đang điều tra");

            if (caseItem.ActionProposals.Count == 0)
                return this.ApiBadRequest("Case phải có ít nhất một đề xuất hành động");

            using var dbTransaction = await _appDbContext.Database.BeginTransactionAsync();
            try
            {
                caseItem.Status = CaseStatuses.PendingApproval;
                var alerts = await _appDbContext.Alerts
                    .Where(alert => alert.CaseId == id)
                    .ToListAsync();
                alerts.ForEach(alert => alert.Status = AlertStatuses.AwaitingApproval);
                await _appDbContext.SaveChangesAsync();

                await _auditLogService.LogAsync(
                    userId: userId,
                    action: "SubmitForApproval",
                    entityType: "Case",
                    entityId: caseItem.CaseId,
                    oldStatus: CaseStatuses.Investigating,
                    newStatus: CaseStatuses.PendingApproval
                );

                await dbTransaction.CommitAsync();
                return Ok("Case đã được gửi Manager phê duyệt");
            }
            catch (Exception ex)
            {
                await dbTransaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi submit Case {CaseId} for approval", id);
                return this.ApiBadRequest("Không thể xử lý yêu cầu, vui lòng thử lại sau");
            }
        }
    }
}