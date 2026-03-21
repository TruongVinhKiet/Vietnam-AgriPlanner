package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "distribution_plans")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DistributionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_id", nullable = false)
    private Cooperative cooperative;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_id", nullable = false)
    private CooperativeInventory inventory;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private CooperativeMember createdBy;

    @Column(nullable = false)
    private String title;

    @Column(name = "total_quantity", precision = 15, scale = 2, nullable = false)
    private BigDecimal totalQuantity;

    @Column(length = 30)
    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    @Builder.Default
    private PlanStatus status = PlanStatus.PENDING;

    @Column(name = "required_votes")
    @Builder.Default
    private Integer requiredVotes = 2;

    @Column(name = "approve_count")
    @Builder.Default
    private Integer approveCount = 0;

    @Column(name = "reject_count")
    @Builder.Default
    private Integer rejectCount = 0;

    @Column(name = "executed_at")
    private ZonedDateTime executedAt;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private ZonedDateTime updatedAt = ZonedDateTime.now();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DistributionPlanItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DistributionVote> votes = new ArrayList<>();

    public enum PlanStatus {
        PENDING,   // Waiting for votes
        APPROVED,  // Enough votes received
        REJECTED,  // Majority rejected
        EXECUTED   // Items distributed to members
    }

    public boolean hasEnoughApprovals() {
        return approveCount >= requiredVotes;
    }

    public void addApproval() {
        this.approveCount++;
        if (hasEnoughApprovals()) {
            this.status = PlanStatus.APPROVED;
        }
        this.updatedAt = ZonedDateTime.now();
    }

    public void addRejection() {
        this.rejectCount++;
        this.updatedAt = ZonedDateTime.now();
    }
}
