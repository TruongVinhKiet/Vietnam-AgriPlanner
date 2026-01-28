package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "group_sell_campaigns")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupSellCampaign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_id")
    private Cooperative cooperative; // null for admin-created global sessions

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "target_quantity", nullable = false)
    private Integer targetQuantity;

    @Column(name = "current_quantity")
    @Builder.Default
    private Integer currentQuantity = 0;

    @Column(name = "min_price", precision = 15, scale = 2)
    private BigDecimal minPrice; // Minimum acceptable price

    @Column(name = "unit")
    private String unit; // kg, con, etc.

    private ZonedDateTime deadline;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private SellCampaignStatus status = SellCampaignStatus.OPEN;

    @Column(name = "buyer_info", columnDefinition = "TEXT")
    private String buyerInfo; // Info about buyer when deal is made

    @Column(name = "final_price", precision = 15, scale = 2)
    private BigDecimal finalPrice; // Actual selling price

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crop_definition_id")
    private CropDefinition cropDefinition;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "animal_definition_id")
    private AnimalDefinition animalDefinition;

    // Close tracking fields
    @Enumerated(EnumType.STRING)
    @Column(name = "closed_reason", length = 30)
    private CloseReason closedReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by")
    private User closedBy;

    @Column(name = "closed_at")
    private ZonedDateTime closedAt;

    @Column(name = "close_note", columnDefinition = "TEXT")
    private String closeNote;

    @OneToMany(mappedBy = "campaign", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<GroupSellContribution> contributions = new ArrayList<>();

    public enum CloseReason {
        AUTO_COMPLETED,
        ADMIN_FORCED,
        EXPIRED
    }

    public enum SellCampaignStatus {
        OPEN, // Accepting contributions
        READY, // Target reached, looking for buyer
        SOLD, // Deal made with buyer
        CANCELLED,
        EXPIRED
    }

    public int getProgressPercent() {
        if (targetQuantity == null || targetQuantity == 0)
            return 0;
        return Math.min(100, (currentQuantity * 100) / targetQuantity);
    }

    public boolean isTargetReached() {
        return currentQuantity >= targetQuantity;
    }

    public void addContribution(int quantity) {
        this.currentQuantity += quantity;
        if (isTargetReached() && this.status == SellCampaignStatus.OPEN) {
            this.status = SellCampaignStatus.READY;
            this.closedReason = CloseReason.AUTO_COMPLETED;
            this.closedAt = ZonedDateTime.now();
        }
    }

    // Admin force close
    public void forceClose(User admin, String reason) {
        this.status = SellCampaignStatus.CANCELLED;
        this.closedReason = CloseReason.ADMIN_FORCED;
        this.closedBy = admin;
        this.closedAt = ZonedDateTime.now();
        this.closeNote = reason;
    }
}
