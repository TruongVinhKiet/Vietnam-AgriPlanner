package com.agriplanner.controller;

import com.agriplanner.dto.OrderDTO.*;
import com.agriplanner.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final com.agriplanner.repository.UserRepository userRepository;

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody CreateOrderRequest request) {
        Long userId = getUserId(userDetails);
        OrderResponse order = orderService.createOrder(userId, request);
        return ResponseEntity.ok(order);
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> getMyOrders(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(orderService.getUserOrders(userId));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderResponse> getOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long orderId) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(orderService.getOrder(userId, orderId));
    }

    @GetMapping("/code/{orderCode}")
    public ResponseEntity<OrderResponse> getOrderByCode(@PathVariable String orderCode) {
        return ResponseEntity.ok(orderService.getOrderByCode(orderCode));
    }

    @PostMapping("/{orderId}/confirm-delivery")
    public ResponseEntity<OrderResponse> confirmDelivery(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long orderId) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(orderService.confirmDelivery(userId, orderId));
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<OrderResponse> cancelOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long orderId) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(orderService.cancelOrder(userId, orderId));
    }

    @GetMapping("/{orderId}/tracking")
    public ResponseEntity<TrackingInfo> getTracking(@PathVariable Long orderId) {
        TrackingInfo tracking = orderService.getTrackingInfo(orderId);
        if (tracking == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(tracking);
    }

    @PostMapping("/calculate-shipping")
    public ResponseEntity<ShippingCalculationResponse> calculateShipping(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody ShippingCalculationRequest request) {
        Long userId = getUserId(userDetails);
        return ResponseEntity.ok(orderService.calculateShipping(userId, request));
    }

    // Admin endpoints
    @PostMapping("/{orderId}/start-shipping")
    public ResponseEntity<OrderResponse> startShipping(@PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.startShipping(orderId));
    }

    private Long getUserId(UserDetails userDetails) {
        if (userDetails == null) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "User not authenticated. Please login first.");
        }
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }
}
