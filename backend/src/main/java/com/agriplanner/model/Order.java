package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_code", unique = true, nullable = false)
    private String orderCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "orders", "farms", "addresses" })
    private User user;

    // Purchase type: SELF_PURCHASE or WEBSITE_ORDER
    @Column(name = "purchase_type", nullable = false)
    @Enumerated(EnumType.STRING)
    private PurchaseType purchaseType;

    // Shipping info
    @Column(name = "shipping_type")
    @Enumerated(EnumType.STRING)
    private ShippingType shippingType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shipping_address_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "user" })
    private UserAddress shippingAddress;

    @Column(name = "shipping_address_text")
    private String shippingAddressText;

    @Column(name = "shipping_fee")
    @Builder.Default
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @Column(name = "distance_km")
    private BigDecimal distanceKm;

    // Payment method: PAY_NOW or PAY_ON_DELIVERY
    @Column(name = "payment_method")
    @Enumerated(EnumType.STRING)
    private PaymentMethod paymentMethod;

    @Column(name = "discount_percent")
    @Builder.Default
    private BigDecimal discountPercent = BigDecimal.ZERO;

    // Amounts
    @Column(nullable = false)
    private BigDecimal subtotal;

    @Column(name = "discount_amount")
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false)
    private BigDecimal totalAmount;

    // Self purchase specific
    @Column(name = "self_purchase_price")
    private BigDecimal selfPurchasePrice;

    // Status tracking
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;

    @Column(name = "estimated_delivery_date")
    private ZonedDateTime estimatedDeliveryDate;

    @Column(name = "actual_delivery_date")
    private ZonedDateTime actualDeliveryDate;

    // Real-time tracking coordinates
    @Column(name = "current_lat")
    private BigDecimal currentLat;

    @Column(name = "current_lng")
    private BigDecimal currentLng;

    @Column(name = "origin_lat")
    private BigDecimal originLat;

    @Column(name = "origin_lng")
    private BigDecimal originLng;

    @Column(name = "dest_lat")
    private BigDecimal destLat;

    @Column(name = "dest_lng")
    private BigDecimal destLng;

    @Column(name = "tracking_started_at")
    private ZonedDateTime trackingStartedAt;

    // Payment status
    @Column(name = "is_paid")
    @Builder.Default
    private Boolean isPaid = false;

    @Column(name = "paid_at")
    private ZonedDateTime paidAt;

    private String notes;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private ZonedDateTime updatedAt = ZonedDateTime.now();

    // Order items
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonManagedReference
    private List<OrderItem> items = new ArrayList<>();

    // Enums
    public enum PurchaseType {
        SELF_PURCHASE,
        WEBSITE_ORDER
    }

    public enum ShippingType {
        EXPRESS,
        STANDARD,
        INSTANT
    }

    public enum PaymentMethod {
        PAY_NOW,
        PAY_ON_DELIVERY
    }

    public enum OrderStatus {
        PENDING,
        PROCESSING,
        SHIPPING,
        DELIVERED,
        CANCELLED
    }
}
