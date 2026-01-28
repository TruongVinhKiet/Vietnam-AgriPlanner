package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Asset Transaction Entity - Lịch sử giao dịch tài sản
 */
@Entity
@Table(name = "asset_transactions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(name = "transaction_type", nullable = false)
    private String transactionType; // INCOME, EXPENSE

    @Column(nullable = false)
    private String category; // TOPUP, HARVEST, SEED, FERTILIZER, PESTICIDE, MACHINERY

    private String description;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "field_id")
    private Long fieldId;

    @Column(name = "image_name")
    private String imageName; // For top-up transactions

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
