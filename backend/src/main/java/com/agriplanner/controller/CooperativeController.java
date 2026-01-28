package com.agriplanner.controller;

import com.agriplanner.dto.CooperativeDTO.*;
import com.agriplanner.dto.AdminBuySessionResponse;
import com.agriplanner.dto.AdminSellSessionResponse;
import com.agriplanner.model.User;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.service.AdminTradingSessionService;
import com.agriplanner.service.CooperativeService;
import com.agriplanner.service.GroupBuyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cooperatives")
@RequiredArgsConstructor
public class CooperativeController {

    private final CooperativeService cooperativeService;
    private final GroupBuyService groupBuyService;
    private final AdminTradingSessionService adminTradingSessionService;
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
