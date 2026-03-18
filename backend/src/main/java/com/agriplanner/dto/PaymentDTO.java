package com.agriplanner.dto;

import lombok.*;
import java.math.BigDecimal;

public class PaymentDTO {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreatePaymentRequest {
        private String orderCode;
        private String gateway; // MOMO, VNPAY
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreatePaymentResponse {
        private String paymentUrl;
        private String orderCode;
        private String gatewayOrderId;
        private String gateway;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConfirmPaymentRequest {
        private String orderCode;
        private String gateway; // MOMO, VNPAY
        private String resultCode; // 0 = success for MoMo
        private String responseCode; // 00 = success for VNPay
        private String transactionId;
        private BigDecimal amount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaymentStatusResponse {
        private String orderCode;
        private String status;
        private Boolean isPaid;
        private String paymentGateway;
        private String gatewayTransactionId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoyaltyPointsResponse {
        private Integer currentPoints;
        private BigDecimal equivalentAmount; // points * 1 VND
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoyaltyHistoryItem {
        private Long id;
        private Integer points;
        private String type;
        private String description;
        private Integer balanceAfter;
        private String orderCode;
        private java.time.ZonedDateTime createdAt;
    }
}
