package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Harvest Record Entity - Lịch sử thu hoạch
 */
@Entity
@Table(name = "harvest_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HarvestRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "field_id")
    private Long fieldId;

    @Column(name = "crop_id")
    private Long cropId;

    @Column(name = "crop_name")
    private String cropName;

    @Column(name = "planting_date")
    private LocalDate plantingDate;

    @Column(name = "harvest_date")
    private LocalDate harvestDate;

    @Column(name = "yield_kg")
    private BigDecimal yieldKg;

    private BigDecimal revenue;

    @Column(name = "total_cost")
    private BigDecimal totalCost;

    private BigDecimal profit;

    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (harvestDate == null) {
            harvestDate = LocalDate.now();
        }
    }
}
