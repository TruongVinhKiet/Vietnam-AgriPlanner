package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.ZonedDateTime;

@Entity
@Table(name = "distribution_votes", uniqueConstraints = @UniqueConstraint(columnNames = { "plan_id", "member_id" }))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DistributionVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private DistributionPlan plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private CooperativeMember member;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private VoteType vote;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "voted_at")
    @Builder.Default
    private ZonedDateTime votedAt = ZonedDateTime.now();

    public enum VoteType {
        APPROVE,
        REJECT
    }
}
