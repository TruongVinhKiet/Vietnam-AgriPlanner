package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Feed Definition Entity - Master data for feed types
 */
@Entity
@Table(name = "feed_definitions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeedDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category; // CONCENTRATE, ROUGHAGE, MIXED, AQUATIC, SPECIAL

    @Builder.Default
    private String unit = "kg";

    @Column(name = "price_per_unit", nullable = false)
    private BigDecimal pricePerUnit;

    @Column(name = "protein_percent")
    private BigDecimal proteinPercent;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "storage_type")
    private String storageType; // DRY, COOL, FROZEN

    @Column(name = "shelf_life_days")
    private Integer shelfLifeDays;

    @Column(name = "icon_name")
    private String iconName;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
