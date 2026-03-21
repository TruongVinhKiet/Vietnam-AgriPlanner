package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "distribution_plan_items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DistributionPlanItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private DistributionPlan plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private CooperativeMember member;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal quantity;

    @Column
    @Builder.Default
    private Boolean received = false;

    @Column(name = "received_at")
    private ZonedDateTime receivedAt;
}
