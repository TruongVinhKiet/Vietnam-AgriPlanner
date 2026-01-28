package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "group_buy_campaigns")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyCampaign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_id")
    private Cooperative cooperative; // null for admin-created global sessions

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shop_item_id")
    private ShopItem shopItem;

    @Column(nullable = false)
    private String title;

    @Column(name = "target_quantity", nullable = false)
    private Integer targetQuantity;

    @Column(name = "current_quantity")
    @Builder.Default
    private Integer currentQuantity = 0;

    @Column(name = "wholesale_price", precision = 15, scale = 2)
    private BigDecimal wholesalePrice; // Discounted price when target reached

    @Column(name = "retail_price", precision = 15, scale = 2)
    private BigDecimal retailPrice; // Original price

    private ZonedDateTime deadline;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private CampaignStatus status = CampaignStatus.OPEN;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    // Admin-created campaign fields
    @Column(name = "is_admin_created")
    @Builder.Default
    private Boolean isAdminCreated = false;

    @Column(name = "market_price", precision = 15, scale = 2)
    private BigDecimal marketPrice; // Reference market price

    @Column(name = "market_quantity")
    private Integer marketQuantity; // Reference market quantity

    @Column(columnDefinition = "TEXT")
    private String note; // Admin note

    // Close tracking fields
    @Enumerated(EnumType.STRING)
    @Column(name = "closed_reason", length = 30)
    private CloseReason closedReason; // AUTO_COMPLETED, ADMIN_FORCED, EXPIRED

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by")
    private User closedBy; // Who closed (null for auto)

    @Column(name = "closed_at")
    private ZonedDateTime closedAt;

    @Column(name = "close_note", columnDefinition = "TEXT")
    private String closeNote; // Reason note for admin force close

    @OneToMany(mappedBy = "campaign", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<GroupBuyContribution> contributions = new ArrayList<>();

    public enum CloseReason {
        AUTO_COMPLETED, // Target reached automatically - green tick
        ADMIN_FORCED, // Admin force closed - red tick
        EXPIRED // Deadline passed
    }

    public enum CampaignStatus {
        OPEN, // Accepting contributions
        COMPLETED, // Target reached, ready to order
        ORDERED, // Orders placed for all members
        CANCELLED, // Campaign cancelled
        EXPIRED // Deadline passed without reaching target
    }

    // Calculate progress percentage
    public int getProgressPercent() {
        if (targetQuantity == null || targetQuantity == 0)
            return 0;
        return Math.min(100, (currentQuantity * 100) / targetQuantity);
    }

    // Check if target reached
    public boolean isTargetReached() {
        return currentQuantity >= targetQuantity;
    }

    // Calculate discount percentage
    public int getDiscountPercent() {
        if (retailPrice == null || retailPrice.compareTo(BigDecimal.ZERO) == 0)
            return 0;
        BigDecimal discount = retailPrice.subtract(wholesalePrice);
        return discount.multiply(BigDecimal.valueOf(100))
                .divide(retailPrice, 0, java.math.RoundingMode.HALF_UP)
                .intValue();
    }

    // Add contribution
    public void addContribution(int quantity) {
        this.currentQuantity += quantity;
        if (isTargetReached() && this.status == CampaignStatus.OPEN) {
            this.status = CampaignStatus.COMPLETED;
            this.closedReason = CloseReason.AUTO_COMPLETED;
            this.closedAt = ZonedDateTime.now();
        }
    }

    // Admin force close
    public void forceClose(User admin, String reason) {
        this.status = CampaignStatus.CANCELLED;
        this.closedReason = CloseReason.ADMIN_FORCED;
        this.closedBy = admin;
        this.closedAt = ZonedDateTime.now();
        this.closeNote = reason;
    }
}
