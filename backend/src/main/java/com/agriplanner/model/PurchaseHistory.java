package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "purchase_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PurchaseHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "shop_item_id", nullable = false)
    private ShopItem shopItem;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "total_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalPrice;

    @Column(name = "purchased_at")
    private LocalDateTime purchasedAt;

    // Liên kết với review (nếu có)
    @OneToOne(mappedBy = "purchase", fetch = FetchType.LAZY)
    private ProductReview review;

    @PrePersist
    protected void onCreate() {
        purchasedAt = LocalDateTime.now();
    }

    // Check if this purchase has been reviewed
    @Transient
    public boolean isReviewed() {
        return review != null;
    }
}
