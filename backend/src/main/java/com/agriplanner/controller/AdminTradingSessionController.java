package com.agriplanner.controller;

import com.agriplanner.dto.*;
import com.agriplanner.model.User;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.service.AdminTradingSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/trading")
@RequiredArgsConstructor
@Slf4j
public class AdminTradingSessionController {

    private final AdminTradingSessionService adminTradingSessionService;
    private final UserRepository userRepository;

    // ========== GROUP BUY SESSIONS ==========

    @GetMapping("/buy-sessions")
    public ResponseEntity<List<AdminBuySessionResponse>> getAllBuySessions() {
        return ResponseEntity.ok(adminTradingSessionService.getAllBuySessions());
    }

    @GetMapping("/buy-sessions/open")
    public ResponseEntity<List<AdminBuySessionResponse>> getOpenBuySessions() {
        return ResponseEntity.ok(adminTradingSessionService.getOpenBuySessions());
    }

    @PostMapping("/buy-sessions")
    public ResponseEntity<AdminBuySessionResponse> createBuySession(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody CreateAdminBuySessionRequest request) {
        Long adminId = getUserId(userDetails);
        log.info("Admin {} creating buy session", adminId);
        return ResponseEntity.ok(adminTradingSessionService.createBuySession(adminId, request));
    }

    // ========== GROUP SELL SESSIONS ==========

    @GetMapping("/sell-sessions")
    public ResponseEntity<List<AdminSellSessionResponse>> getAllSellSessions() {
        return ResponseEntity.ok(adminTradingSessionService.getAllSellSessions());
    }

    @GetMapping("/sell-sessions/open")
    public ResponseEntity<List<AdminSellSessionResponse>> getOpenSellSessions() {
        return ResponseEntity.ok(adminTradingSessionService.getOpenSellSessions());
    }

    @PostMapping("/sell-sessions")
    public ResponseEntity<AdminSellSessionResponse> createSellSession(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody CreateAdminSellSessionRequest request) {
        Long adminId = getUserId(userDetails);
        log.info("Admin {} creating sell session", adminId);
        return ResponseEntity.ok(adminTradingSessionService.createSellSession(adminId, request));
    }

    // ========== MARKET PRICES (for reference) ==========

    @GetMapping("/market-prices/buy")
    public ResponseEntity<List<MarketPriceInfo>> getMarketPricesForBuy() {
        return ResponseEntity.ok(adminTradingSessionService.getMarketPricesForBuy());
    }

    @GetMapping("/market-prices/sell")
    public ResponseEntity<List<MarketPriceInfo>> getMarketPricesForSell() {
        return ResponseEntity.ok(adminTradingSessionService.getMarketPricesForSell());
    }

    // ========== FORCE CLOSE SESSIONS ==========

    @PostMapping("/buy-sessions/{id}/force-close")
    public ResponseEntity<?> forceCloseBuySession(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody ForceCloseRequest request) {
        Long adminId = getUserId(userDetails);
        log.warn("Admin {} force closing buy session {} with reason: {}", adminId, id, request.getReason());
        adminTradingSessionService.forceCloseBuySession(adminId, id, request.getReason());
        return ResponseEntity.ok().body(java.util.Map.of(
                "success", true,
                "message", "Phiên gom mua đã bị đóng"));
    }

    @PostMapping("/sell-sessions/{id}/force-close")
    public ResponseEntity<?> forceCloseSellSession(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody ForceCloseRequest request) {
        Long adminId = getUserId(userDetails);
        log.warn("Admin {} force closing sell session {} with reason: {}", adminId, id, request.getReason());
        adminTradingSessionService.forceCloseSellSession(adminId, id, request.getReason());
        return ResponseEntity.ok().body(java.util.Map.of(
                "success", true,
                "message", "Phiên gom bán đã bị đóng"));
    }

    // ========== HELPER ==========

    private Long getUserId(UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
