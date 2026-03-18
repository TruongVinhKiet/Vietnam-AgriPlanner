package com.agriplanner.controller;

import com.agriplanner.dto.PaymentDTO.*;
import com.agriplanner.model.LoyaltyTransaction;
import com.agriplanner.model.Order;
import com.agriplanner.repository.OrderRepository;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.service.LoyaltyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/loyalty")
@RequiredArgsConstructor
public class LoyaltyController {

    private final LoyaltyService loyaltyService;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    /**
     * Lấy số điểm tích lũy hiện tại
     */
    @GetMapping("/points")
    public ResponseEntity<LoyaltyPointsResponse> getPoints(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        int points = loyaltyService.getUserPoints(userId);

        return ResponseEntity.ok(LoyaltyPointsResponse.builder()
                .currentPoints(points)
                .equivalentAmount(BigDecimal.valueOf(points)) // 1 point = 1 VND
                .build());
    }

    /**
     * Lịch sử giao dịch điểm
     */
    @GetMapping("/history")
    public ResponseEntity<List<LoyaltyHistoryItem>> getHistory(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        List<LoyaltyTransaction> transactions = loyaltyService.getPointsHistory(userId);

        List<LoyaltyHistoryItem> items = transactions.stream()
                .map(tx -> {
                    String orderCode = null;
                    if (tx.getOrderId() != null) {
                        orderCode = orderRepository.findById(tx.getOrderId().longValue())
                                .map(Order::getOrderCode)
                                .orElse(null);
                    }
                    return LoyaltyHistoryItem.builder()
                            .id(tx.getId())
                            .points(tx.getPoints())
                            .type(tx.getType())
                            .description(tx.getDescription())
                            .balanceAfter(tx.getBalanceAfter())
                            .orderCode(orderCode)
                            .createdAt(tx.getCreatedAt())
                            .build();
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(items);
    }

    /**
     * Tính preview điểm sẽ nhận từ subtotal
     */
    @GetMapping("/calculate")
    public ResponseEntity<Map<String, Object>> calculatePoints(
            @RequestParam BigDecimal subtotal) {
        int points = loyaltyService.calculateEarnedPoints(subtotal);
        return ResponseEntity.ok(Map.of(
                "subtotal", subtotal,
                "earnedPoints", points,
                "pointsValue", points // 1 point = 1 VND
        ));
    }

    private Long getUserId(UserDetails userDetails) {
        if (userDetails == null) {
            throw new org.springframework.security.access.AccessDeniedException("User not authenticated");
        }
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }
}
