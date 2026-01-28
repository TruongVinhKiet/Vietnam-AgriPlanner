package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "inventory_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "farm_id")
    private Long farmId;

    @Column(nullable = false)
    private String name;

    @Column(name = "category", nullable = false)
    private String type; // FERTILIZER, PESTICIDE, SEED, FEED

    @Column(name = "current_stock", nullable = false)
    private BigDecimal quantity;

    @Column(nullable = false)
    private String unit; // kg, liter, mask, pcs

    @Column(name = "reorder_level")
    private BigDecimal minThreshold; // Low stock alert level

    @Column(name = "cost_per_unit")
    private BigDecimal costPerUnit;
}
