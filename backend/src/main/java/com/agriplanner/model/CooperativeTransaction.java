package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "cooperative_transactions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CooperativeTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cooperative_id", nullable = false)
    private Cooperative cooperative;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private CooperativeMember member; // null for system transactions

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransactionType type;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "balance_after", precision = 15, scale = 2)
    private BigDecimal balanceAfter;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();

    public enum TransactionType {
        DEPOSIT, // Member deposits to fund
        WITHDRAWAL, // Member withdraws from fund
        PURCHASE, // Fund used for group purchase
        REFUND, // Refund from cancelled order
        REVENUE, // Revenue from group selling
        SALE, // Product sold from inventory
        CONTRIBUTE_PRODUCT, // Member contributes product to inventory
        WITHDRAW_PRODUCT, // Member withdraws product from inventory
        CLAIM_EARNINGS // Member claims earnings from sales
    }
}
