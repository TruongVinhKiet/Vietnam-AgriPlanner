package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "cooperatives")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Cooperative {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(unique = true, nullable = false, length = 20)
    private String code; // Auto-generated cooperative code

    @Column(name = "invite_code", unique = true, length = 10)
    private String inviteCode; // 6-char invite code for joining

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leader_id")
    private User leader;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private CooperativeStatus status = CooperativeStatus.PENDING;

    @Column(name = "max_members")
    @Builder.Default
    private Integer maxMembers = 50;

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    @Column(name = "approved_at")
    private ZonedDateTime approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    @OneToMany(mappedBy = "cooperative", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CooperativeMember> members = new ArrayList<>();

    public enum CooperativeStatus {
        PENDING, // Waiting for admin approval
        APPROVED, // Active and operational
        REJECTED, // Registration rejected
        SUSPENDED, // Temporarily suspended
        DISSOLVED // Cooperative has been dissolved
    }

    // Helper method to add balance
    public void addBalance(BigDecimal amount) {
        this.balance = this.balance.add(amount);
    }

    // Helper method to subtract balance
    public void subtractBalance(BigDecimal amount) {
        if (this.balance.compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient cooperative balance");
        }
        this.balance = this.balance.subtract(amount);
    }

    // Get member count
    public int getMemberCount() {
        return members != null ? members.size() : 0;
    }
}
