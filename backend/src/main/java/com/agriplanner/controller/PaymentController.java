package com.agriplanner.controller;

import com.agriplanner.dto.PaymentDTO.*;
import com.agriplanner.model.Order;
import com.agriplanner.model.User;
import com.agriplanner.model.AssetTransaction;
import com.agriplanner.repository.AssetTransactionRepository;
import com.agriplanner.repository.OrderRepository;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.service.LoyaltyService;
import com.agriplanner.service.MomoService;
import com.agriplanner.service.VnpayService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final MomoService momoService;
    private final VnpayService vnpayService;
    private final LoyaltyService loyaltyService;
    private final AssetTransactionRepository assetTransactionRepository;

    /**
     * Bước 2: Tạo URL thanh toán cho đơn hàng đã có
     * Frontend gọi sau khi tạo order thành công
     */
    @PostMapping("/create")
    public ResponseEntity<CreatePaymentResponse> createPayment(
            @RequestBody CreatePaymentRequest request,
            HttpServletRequest httpRequest) {

        Order order = orderRepository.findByOrderCode(request.getOrderCode())
                .orElseThrow(() -> new RuntimeException("Order not found: " + request.getOrderCode()));

        if (order.getIsPaid()) {
            throw new RuntimeException("Order already paid");
        }

        String gateway = request.getGateway().toUpperCase();
        String gatewayOrderId = order.getOrderCode() + "_" + UUID.randomUUID().toString().substring(0, 8);
        long amount = order.getTotalAmount().longValue();
        String orderInfo = "AgriPlanner - Thanh toan don hang " + order.getOrderCode();

        String paymentUrl;

        if ("MOMO".equals(gateway)) {
            paymentUrl = momoService.createPaymentUrl(gatewayOrderId, amount, orderInfo);
        } else if ("VNPAY".equals(gateway)) {
            String ipAddress = getClientIp(httpRequest);
            paymentUrl = vnpayService.createPaymentUrl(gatewayOrderId, amount, orderInfo, ipAddress);
        } else {
            throw new RuntimeException("Unsupported payment gateway: " + gateway);
        }

        // Update order with gateway info
        order.setPaymentGateway(gateway);
        order.setGatewayOrderId(gatewayOrderId);
        orderRepository.save(order);

        log.info("[PAYMENT] Created {} payment URL for order: {}, gatewayOrderId: {}",
                gateway, order.getOrderCode(), gatewayOrderId);

        return ResponseEntity.ok(CreatePaymentResponse.builder()
                .paymentUrl(paymentUrl)
                .orderCode(order.getOrderCode())
                .gatewayOrderId(gatewayOrderId)
                .gateway(gateway)
                .build());
    }

    /**
     * Bước 5 (simplified): Frontend gọi sau khi return từ MoMo/VNPay
     * Chốt đơn hàng - trust frontend result
     */
    @PostMapping("/confirm")
    public ResponseEntity<Map<String, Object>> confirmPayment(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody ConfirmPaymentRequest request) {

        Order order = orderRepository.findByOrderCode(request.getOrderCode())
                .orElseThrow(() -> new RuntimeException("Order not found: " + request.getOrderCode()));

        if (order.getIsPaid()) {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Order already paid",
                    "orderCode", order.getOrderCode()));
        }

        // Check result code
        boolean isSuccess = false;
        String gateway = request.getGateway() != null ? request.getGateway().toUpperCase() : "";

        if ("MOMO".equals(gateway)) {
            isSuccess = "0".equals(request.getResultCode());
        } else if ("VNPAY".equals(gateway)) {
            isSuccess = "00".equals(request.getResponseCode());
        }

        if (!isSuccess) {
            order.setStatus(Order.OrderStatus.CANCELLED);
            orderRepository.save(order);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "Payment failed",
                    "orderCode", order.getOrderCode()));
        }

        // Update order as paid
        order.setIsPaid(true);
        order.setPaidAt(ZonedDateTime.now());
        order.setGatewayTransactionId(request.getTransactionId());
        order.setStatus(Order.OrderStatus.PROCESSING);

        // Trừ balance nội bộ (tài sản)
        User user = order.getUser();
        BigDecimal totalAmount = order.getTotalAmount();

        if (user.getBalance().compareTo(totalAmount) >= 0) {
            user.setBalance(user.getBalance().subtract(totalAmount));
        } else {
            // Nếu không đủ balance, set về 0 (đã thanh toán qua cổng ngoài)
            user.setBalance(BigDecimal.ZERO);
        }
        userRepository.save(user);

        // Ghi lịch sử giao dịch tài sản
        AssetTransaction assetTx = new AssetTransaction();
        assetTx.setUserId(user.getId());
        assetTx.setAmount(totalAmount.negate());
        assetTx.setTransactionType("EXPENSE");
        assetTx.setCategory("ONLINE_PAYMENT");
        assetTx.setDescription("Thanh toán " + gateway + " - Đơn " + order.getOrderCode());
        assetTransactionRepository.save(assetTx);

        // Tính và ghi nhận điểm tích lũy sẽ nhận (cộng khi giao thành công)
        int earnedPoints = loyaltyService.calculateEarnedPoints(order.getSubtotal());
        order.setLoyaltyPointsEarned(earnedPoints);

        orderRepository.save(order);

        log.info("[PAYMENT] Order {} confirmed via {}. Balance deducted: {}. Will earn {} points on delivery.",
                order.getOrderCode(), gateway, totalAmount, earnedPoints);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Thanh toán thành công",
                "orderCode", order.getOrderCode(),
                "earnedPoints", earnedPoints));
    }

    /**
     * Check payment status
     */
    @GetMapping("/status/{orderCode}")
    public ResponseEntity<PaymentStatusResponse> getPaymentStatus(@PathVariable String orderCode) {
        Order order = orderRepository.findByOrderCode(orderCode)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        return ResponseEntity.ok(PaymentStatusResponse.builder()
                .orderCode(order.getOrderCode())
                .status(order.getStatus().name())
                .isPaid(order.getIsPaid())
                .paymentGateway(order.getPaymentGateway())
                .gatewayTransactionId(order.getGatewayTransactionId())
                .build());
    }

    /**
     * MoMo IPN callback (MoMo server gọi - sẽ fail trên localhost, nhưng không sao)
     */
    @PostMapping("/momo/ipn")
    public ResponseEntity<Map<String, Object>> momoIpn(@RequestBody Map<String, Object> body) {
        log.info("[MOMO IPN] Received: {}", body);
        // Trên sandbox/localhost, IPN sẽ không được gọi
        // Chỉ dùng Return URL flow
        return ResponseEntity.ok(Map.of("resultCode", 0, "message", "ok"));
    }

    /**
     * VNPay IPN callback (VNPay server gọi - sẽ fail trên localhost, nhưng không sao)
     */
    @GetMapping("/vnpay/ipn")
    public ResponseEntity<Map<String, String>> vnpayIpn(@RequestParam Map<String, String> params) {
        log.info("[VNPAY IPN] Received: {}", params);
        // Trên sandbox/localhost, IPN sẽ không được gọi
        // Chỉ dùng Return URL flow
        return ResponseEntity.ok(Map.of("RspCode", "00", "Message", "Confirm Success"));
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String ip = request.getRemoteAddr();
        return ip != null ? ip : "127.0.0.1";
    }

}
