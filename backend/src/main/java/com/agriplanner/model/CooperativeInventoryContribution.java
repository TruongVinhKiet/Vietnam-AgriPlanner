package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "cooperative_inventory_contributions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CooperativeInventoryContribution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_id", nullable = false)
    private CooperativeInventory inventory;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private CooperativeMember member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id")
    private GroupSellCampaign campaign; // Linked sell campaign

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal quantity;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal earnings = BigDecimal.ZERO; // Money earned from selling

    @Column(name = "is_claimed")
    @Builder.Default
    private Boolean isClaimed = false; // Has member claimed earnings?

    @Column(name = "claimed_at")
    private ZonedDateTime claimedAt;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    // Calculate earnings percentage based on contribution
    public BigDecimal getContributionPercent(BigDecimal totalQuantity) {
        if (totalQuantity == null || totalQuantity.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return quantity.multiply(BigDecimal.valueOf(100))
                .divide(totalQuantity, 2, java.math.RoundingMode.HALF_UP);
    }
}
