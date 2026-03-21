package com.agriplanner.controller;

import com.agriplanner.dto.CooperativeDTO.*;
import com.agriplanner.dto.AdminBuySessionResponse;
import com.agriplanner.dto.AdminSellSessionResponse;
import com.agriplanner.dto.AdminBuySessionDetailResponse;
import com.agriplanner.dto.AdminSellSessionDetailResponse;
import com.agriplanner.model.DistributionVote;
import com.agriplanner.model.User;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.service.AdminTradingSessionService;
import com.agriplanner.service.CooperativeService;
import com.agriplanner.service.CooperativeInventoryService;
import com.agriplanner.service.DistributionService;
import com.agriplanner.service.GroupBuyService;
import com.agriplanner.service.GroupSellService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/cooperatives")
@RequiredArgsConstructor
public class CooperativeController {

    private final CooperativeService cooperativeService;
    private final GroupBuyService groupBuyService;
    private final GroupSellService groupSellService;
    private final AdminTradingSessionService adminTradingSessionService;
    private final DistributionService distributionService;
    private final CooperativeInventoryService cooperativeInventoryService;
    private final UserRepository userRepository;

    // ==================== Cooperative Management ====================

    @PostMapping("/register")
    public ResponseEntity<CooperativeResponse> register(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody RegisterRequest request) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(cooperativeService.registerCooperative(userId, request));
    }

    @GetMapping
    public ResponseEntity<List<CooperativeResponse>> getMyCooperatives(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(cooperativeService.getUserCooperatives(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CooperativeResponse> getCooperative(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(cooperativeService.getCooperative(id, userId));
    }

    @PostMapping("/join")
    public ResponseEntity<CooperativeResponse> joinByInviteCode(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody JoinRequest request) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(cooperativeService.joinByInviteCode(userId, request.getInviteCode()));
    }

    @PostMapping("/{id}/deposit")
    public ResponseEntity<TransactionResponse> deposit(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody DepositRequest request) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(cooperativeService.deposit(id, userId, request));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<MemberResponse>> getMembers(@PathVariable Long id) {
        return ResponseEntity.ok(cooperativeService.getMembers(id));
    }

    @GetMapping("/{id}/transactions")
    public ResponseEntity<List<TransactionResponse>> getTransactions(@PathVariable Long id) {
        return ResponseEntity.ok(cooperativeService.getTransactions(id));
    }

    // ==================== Group Buy ====================

    @PostMapping("/{id}/group-buys")
    public ResponseEntity<GroupBuyResponse> createGroupBuy(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody CreateGroupBuyRequest request) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(groupBuyService.createCampaign(id, userId, request));
    }

    @GetMapping("/{id}/group-buys")
    public ResponseEntity<List<GroupBuyResponse>> getGroupBuys(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false, defaultValue = "false") boolean openOnly) {
        Long userId = getUserId(userDetails);
        if (openOnly) {
            return ResponseEntity.ok(groupBuyService.getOpenCampaigns(id, userId));
        }
        return ResponseEntity.ok(groupBuyService.getCampaigns(id, userId));
    }

    @PostMapping("/group-buys/{campaignId}/contribute")
    public ResponseEntity<GroupBuyResponse> contributeToGroupBuy(
            @PathVariable Long campaignId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody ContributeRequest request) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(groupBuyService.contribute(campaignId, userId, request));
    }

    @PostMapping("/group-buys/{campaignId}/complete")
    public ResponseEntity<GroupBuyResponse> completeGroupBuy(
            @PathVariable Long campaignId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(groupBuyService.completeCampaign(campaignId, userId));
    }

    // ==================== Admin Trading Sessions (for regular users) ====================
    
    /**
     * Get all admin-created buy sessions (regular users can view)
     */
    @GetMapping("/trading/buy-sessions")
    public ResponseEntity<List<AdminBuySessionResponse>> getAdminBuySessions() {
        return ResponseEntity.ok(adminTradingSessionService.getAllBuySessions());
    }
    
    /**
     * Get open admin-created buy sessions (regular users can view)
     */
    @GetMapping("/trading/buy-sessions/open")
    public ResponseEntity<List<AdminBuySessionResponse>> getOpenAdminBuySessions() {
        return ResponseEntity.ok(adminTradingSessionService.getOpenBuySessions());
    }

    @GetMapping("/trading/buy-sessions/{id}")
    public ResponseEntity<AdminBuySessionDetailResponse> getAdminBuySessionDetail(@PathVariable Long id) {
        return ResponseEntity.ok(adminTradingSessionService.getBuySessionDetail(id));
    }
    
    /**
     * Get all admin-created sell sessions (regular users can view)
     */
    @GetMapping("/trading/sell-sessions")
    public ResponseEntity<List<AdminSellSessionResponse>> getAdminSellSessions() {
        return ResponseEntity.ok(adminTradingSessionService.getAllSellSessions());
    }
    
    /**
     * Get open admin-created sell sessions (regular users can view)
     */
    @GetMapping("/trading/sell-sessions/open")
    public ResponseEntity<List<AdminSellSessionResponse>> getOpenAdminSellSessions() {
        return ResponseEntity.ok(adminTradingSessionService.getOpenSellSessions());
    }

    @GetMapping("/trading/sell-sessions/{id}")
    public ResponseEntity<AdminSellSessionDetailResponse> getAdminSellSessionDetail(@PathVariable Long id) {
        return ResponseEntity.ok(adminTradingSessionService.getSellSessionDetail(id));
    }
    // ==================== Group Buy (HTX mua hàng từ Admin) ====================

    @PostMapping("/{id}/group-buys/admin-sessions/{sessionId}/contribute")
    public ResponseEntity<?> contributeToAdminBuySession(
            @PathVariable Long id,
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> request) {
        Long userId = getUserId(userDetails);
        int quantity = Integer.parseInt(request.get("quantity").toString());

        var result = groupBuyService.contributeToAdminSession(sessionId, id, userId, quantity);
        return ResponseEntity.ok(result);
    }

    // ==================== Group Sell (HTX bán hàng cho Admin) ====================


    @PostMapping("/{id}/group-sells/admin-sessions/{sessionId}/contribute")
    public ResponseEntity<?> contributeToAdminSellSession(
            @PathVariable Long id,
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> request) {
        Long userId = getUserId(userDetails);
        Long inventoryId = Long.valueOf(request.get("inventoryId").toString());
        int quantity = Integer.parseInt(request.get("quantity").toString());

        var result = groupSellService.contributeToAdminSession(sessionId, id, userId, inventoryId, quantity);
        return ResponseEntity.ok(result);
    }

    // ==================== Distribution Plans (Phân bổ vật tư) ====================

    @PostMapping("/{id}/distribution-plans")
    public ResponseEntity<?> createDistributionPlan(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> request) {
        Long userId = getUserId(userDetails);
        var member = cooperativeService.getMemberByUserId(id, userId);

        String title = (String) request.get("title");
        Long inventoryId = Long.valueOf(request.get("inventoryId").toString());

        @SuppressWarnings("unchecked")
        Map<String, Object> rawAllocations = (Map<String, Object>) request.get("allocations");
        Map<Long, BigDecimal> allocations = new HashMap<>();
        rawAllocations.forEach((k, v) -> allocations.put(Long.valueOf(k), new BigDecimal(v.toString())));

        var plan = distributionService.createPlan(id, member.getId(), inventoryId, title, allocations);
        return ResponseEntity.ok(Map.of(
                "id", plan.getId(),
                "title", plan.getTitle(),
                "status", plan.getStatus().name(),
                "message", "Kế hoạch phân bổ đã tạo, chờ biểu quyết"));
    }

    @GetMapping("/{id}/distribution-plans")
    public ResponseEntity<?> getDistributionPlans(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        var member = cooperativeService.getMemberByUserId(id, userId);

        var plans = distributionService.getPlans(id);
        var result = plans.stream().map(p -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", p.getId());
            map.put("title", p.getTitle());
            map.put("totalQuantity", p.getTotalQuantity());
            map.put("unit", p.getUnit());
            map.put("status", p.getStatus().name());
            map.put("approveCount", p.getApproveCount());
            map.put("rejectCount", p.getRejectCount());
            map.put("requiredVotes", p.getRequiredVotes());
            map.put("createdByName", p.getCreatedBy().getUser().getFullName());
            map.put("productName", p.getInventory().getProductName());
            map.put("createdAt", p.getCreatedAt().toString());
            map.put("hasVoted", distributionService.hasVoted(p.getId(), member.getId()));
            // items
            var items = distributionService.getPlanItems(p.getId()).stream().map(it -> Map.of(
                    "memberId", it.getMember().getId(),
                    "memberName", it.getMember().getUser().getFullName(),
                    "quantity", it.getQuantity(),
                    "received", it.getReceived()
            )).toList();
            map.put("items", items);
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/distribution-plans/{planId}")
    public ResponseEntity<?> getDistributionPlanDetail(
            @PathVariable Long id,
            @PathVariable Long planId,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        var member = cooperativeService.getMemberByUserId(id, userId);

        var plan = distributionService.getPlan(planId);
        var items = distributionService.getPlanItems(planId);
        var votes = distributionService.getPlanVotes(planId);

        Map<String, Object> result = new HashMap<>();
        result.put("id", plan.getId());
        result.put("title", plan.getTitle());
        result.put("totalQuantity", plan.getTotalQuantity());
        result.put("unit", plan.getUnit());
        result.put("status", plan.getStatus().name());
        result.put("approveCount", plan.getApproveCount());
        result.put("rejectCount", plan.getRejectCount());
        result.put("requiredVotes", plan.getRequiredVotes());
        result.put("createdByName", plan.getCreatedBy().getUser().getFullName());
        result.put("productName", plan.getInventory().getProductName());
        result.put("createdAt", plan.getCreatedAt().toString());
        result.put("hasVoted", distributionService.hasVoted(plan.getId(), member.getId()));
        result.put("items", items.stream().map(it -> Map.of(
                "memberId", it.getMember().getId(),
                "memberName", it.getMember().getUser().getFullName(),
                "quantity", it.getQuantity(),
                "received", it.getReceived()
        )).toList());
        result.put("votes", votes.stream().map(v -> Map.of(
                "memberId", v.getMember().getId(),
                "memberName", v.getMember().getUser().getFullName(),
                "vote", v.getVote().name(),
                "comment", v.getComment() != null ? v.getComment() : "",
                "votedAt", v.getVotedAt().toString()
        )).toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/distribution-plans/{planId}/vote")
    public ResponseEntity<?> voteOnDistributionPlan(
            @PathVariable Long planId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> request) {
        Long userId = getUserId(userDetails);
        var plan = distributionService.getPlan(planId);
        var member = cooperativeService.getMemberByUserId(plan.getCooperative().getId(), userId);

        DistributionVote.VoteType voteType = DistributionVote.VoteType.valueOf(
                request.getOrDefault("vote", "APPROVE").toUpperCase());
        String comment = request.get("comment");

        distributionService.castVote(planId, member.getId(), voteType, comment);

        // Re-fetch plan for updated status
        plan = distributionService.getPlan(planId);
        return ResponseEntity.ok(Map.of(
                "status", plan.getStatus().name(),
                "approveCount", plan.getApproveCount(),
                "rejectCount", plan.getRejectCount(),
                "message", voteType == DistributionVote.VoteType.APPROVE
                        ? "Đã đồng ý kế hoạch phân bổ" : "Đã từ chối kế hoạch phân bổ"));
    }

    // ==================== Inventory Logs ====================

    @GetMapping("/{id}/inventory-logs")
    public ResponseEntity<?> getInventoryLogs(@PathVariable Long id) {
        var logs = distributionService.getInventoryLogs(id);
        var result = logs.stream().map(l -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", l.getId());
            map.put("action", l.getAction().name());
            map.put("productName", l.getProductName());
            map.put("quantity", l.getQuantity());
            map.put("unit", l.getUnit());
            map.put("description", l.getDescription());
            map.put("referenceType", l.getReferenceType());
            map.put("createdAt", l.getCreatedAt().toString());
            if (l.getPerformedBy() != null) {
                map.put("performedByName", l.getPerformedBy().getFullName());
            }
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    // ==================== Claim Earnings ====================

    @PostMapping("/{id}/earnings/claim")
    public ResponseEntity<?> claimEarnings(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        var member = cooperativeService.getMemberByUserId(id, userId);
        BigDecimal claimed = cooperativeInventoryService.claimEarnings(member.getId());
        return ResponseEntity.ok(Map.of(
                "claimed", claimed,
                "message", "Đã nhận " + claimed.toPlainString() + "đ từ thu nhập bán hàng"));
    }

    // ==================== Admin Endpoints ====================

    @GetMapping("/admin/pending")
    public ResponseEntity<List<AdminCooperativeResponse>> getPendingRegistrations() {
        return ResponseEntity.ok(cooperativeService.getAllPendingRegistrations());
    }

    @GetMapping("/admin/all")
    public ResponseEntity<List<AdminCooperativeResponse>> getAllCooperatives() {
        return ResponseEntity.ok(cooperativeService.getAllCooperatives());
    }

    @PostMapping("/admin/{id}/approve")
    public ResponseEntity<AdminCooperativeResponse> approveCooperative(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        Long adminId = getUserId(userDetails);
        return ResponseEntity.ok(cooperativeService.approveCooperative(id, adminId));
    }

    @PostMapping("/admin/{id}/reject")
    public ResponseEntity<AdminCooperativeResponse> rejectCooperative(@PathVariable Long id) {
        return ResponseEntity.ok(cooperativeService.rejectCooperative(id));
    }

    @GetMapping("/admin/stats")
    public ResponseEntity<CooperativeStats> getStats() {
        return ResponseEntity.ok(cooperativeService.getCooperativeStats());
    }

    // ==================== Dissolution Request (User) ====================

    @PostMapping("/{id}/dissolution-request")
    public ResponseEntity<?> submitDissolutionRequest(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody DissolutionRequestDTO request) {
        Long userId = getUserId(userDetails);
        var result = cooperativeService.submitDissolutionRequest(
                id, userId, request.getReason(), request.getContactPhone(), request.getContactEmail());
        return ResponseEntity.ok(java.util.Map.of(
                "id", result.getId(),
                "status", result.getStatus().name(),
                "message", "Yêu cầu giải thể đã được gửi thành công"));
    }

    @GetMapping("/{id}/dissolution-status")
    public ResponseEntity<?> getDissolutionStatus(@PathVariable Long id) {
        var request = cooperativeService.getDissolutionStatus(id);
        if (request == null) {
            return ResponseEntity.ok(java.util.Map.of("hasPendingRequest", false));
        }
        return ResponseEntity.ok(java.util.Map.of(
                "hasPendingRequest", true,
                "id", request.getId(),
                "status", request.getStatus().name(),
                "reason", request.getReason(),
                "createdAt", request.getCreatedAt().toString()));
    }

    // ==================== Dissolution Admin Endpoints ====================

    @GetMapping("/admin/dissolution-requests")
    public ResponseEntity<?> getPendingDissolutionRequests() {
        var requests = cooperativeService.getPendingDissolutionRequests();
        var response = requests.stream().map(r -> java.util.Map.of(
                "id", r.getId(),
                "cooperativeId", r.getCooperative().getId(),
                "cooperativeName", r.getCooperative().getName(),
                "cooperativeCode", r.getCooperative().getCode(),
                "requestedByName", r.getRequestedBy().getFullName(),
                "requestedByEmail", r.getRequestedBy().getEmail(),
                "reason", r.getReason(),
                "contactPhone", r.getContactPhone() != null ? r.getContactPhone() : "",
                "contactEmail", r.getContactEmail() != null ? r.getContactEmail() : "",
                "createdAt", r.getCreatedAt().toString())).toList();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/admin/dissolution/{requestId}/approve")
    public ResponseEntity<?> approveDissolution(
            @PathVariable Long requestId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        Long adminId = getUserId(userDetails);
        String notes = body != null ? body.get("notes") : null;
        var result = cooperativeService.approveDissolution(requestId, adminId, notes);
        return ResponseEntity.ok(java.util.Map.of(
                "message", "Đã phê duyệt giải thể HTX " + result.getCooperative().getName(),
                "status", result.getStatus().name()));
    }

    @PostMapping("/admin/dissolution/{requestId}/reject")
    public ResponseEntity<?> rejectDissolution(
            @PathVariable Long requestId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        Long adminId = getUserId(userDetails);
        String notes = body != null ? body.get("notes") : null;
        var result = cooperativeService.rejectDissolution(requestId, adminId, notes);
        return ResponseEntity.ok(java.util.Map.of(
                "message", "Đã từ chối yêu cầu giải thể",
                "status", result.getStatus().name()));
    }

    // ==================== DTO for Dissolution Request ====================

    @lombok.Data
    public static class DissolutionRequestDTO {
        private String reason;
        private String contactPhone;
        private String contactEmail;
    }

    // ==================== Helper ====================

    private Long getUserId(UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
