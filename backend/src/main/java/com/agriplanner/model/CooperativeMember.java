package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "cooperative_members", uniqueConstraints = @UniqueConstraint(columnNames = { "cooperative_id",
        "user_id" }))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CooperativeMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_id", nullable = false)
    private Cooperative cooperative;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private MemberRole role = MemberRole.MEMBER;

    @Column(name = "joined_at")
    @Builder.Default
    private ZonedDateTime joinedAt = ZonedDateTime.now();

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal contribution = BigDecimal.ZERO; // Total deposited to fund

    public enum MemberRole {
        LEADER, // Can manage cooperative, create campaigns, invite members
        MEMBER // Can participate in campaigns, deposit to fund
    }

    public boolean isLeader() {
        return this.role == MemberRole.LEADER;
    }

    public void addContribution(BigDecimal amount) {
        this.contribution = this.contribution.add(amount);
    }
}
