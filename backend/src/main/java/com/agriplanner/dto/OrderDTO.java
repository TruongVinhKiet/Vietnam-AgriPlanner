package com.agriplanner.dto;

import com.agriplanner.model.Order;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;

public class OrderDTO {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateOrderRequest {
        private Order.PurchaseType purchaseType;
        private Order.ShippingType shippingType;
        private Long shippingAddressId;
        private String shippingAddressText; // Direct address text from profile
        private BigDecimal destLat; // Direct coordinates from profile
        private BigDecimal destLng;
        private Order.PaymentMethod paymentMethod;
        private BigDecimal selfPurchasePrice;
        private String notes;
        private List<OrderItemRequest> items;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemRequest {
        private Long shopItemId;
        private Integer quantity;
        private BigDecimal unitPrice;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderResponse {
        private Long id;
        private String orderCode;
        private Order.PurchaseType purchaseType;
        private Order.ShippingType shippingType;
        private String shippingAddressText;
        private BigDecimal shippingFee;
        private BigDecimal distanceKm;
        private Order.PaymentMethod paymentMethod;
        private BigDecimal discountPercent;
        private BigDecimal subtotal;
        private BigDecimal discountAmount;
        private BigDecimal totalAmount;
        private BigDecimal selfPurchasePrice;
        private Order.OrderStatus status;
        private ZonedDateTime estimatedDeliveryDate;
        private ZonedDateTime actualDeliveryDate;
        private Boolean isPaid;
        private ZonedDateTime paidAt;
        private String notes;
        private ZonedDateTime createdAt;
        private List<OrderItemResponse> items;
        // Tracking info
        private TrackingInfo tracking;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemResponse {
        private Long id;
        private Long shopItemId;
        private String itemName;
        private String itemImage;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal totalPrice;
        private BigDecimal weightKg;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrackingInfo {
        private BigDecimal currentLat;
        private BigDecimal currentLng;
        private BigDecimal originLat;
        private BigDecimal originLng;
        private BigDecimal destLat;
        private BigDecimal destLng;
        private ZonedDateTime trackingStartedAt;
        private BigDecimal progressPercent;
        private String estimatedTimeRemaining;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShippingCalculationRequest {
        private Long addressId;
        private BigDecimal latitude; // Direct coordinates when address is from user profile
        private BigDecimal longitude;
        private List<OrderItemRequest> items;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShippingCalculationResponse {
        private BigDecimal distanceKm;
        private BigDecimal totalWeightKg;
        private List<ShippingOption> options;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShippingOption {
        private Order.ShippingType type;
        private String displayName;
        private BigDecimal fee;
        private String estimatedDays;
        private Integer minDays;
        private Integer maxDays;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateStatusRequest {
        private Order.OrderStatus status;
    }
}
