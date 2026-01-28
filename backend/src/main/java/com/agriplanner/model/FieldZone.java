package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Field Zone Entity - Vùng đa cây trồng trong ruộng
 */
@Entity
@Table(name = "field_zones")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldZone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "field_id")
    private Long fieldId;

    @Column(nullable = false)
    private String name;

    @Column(name = "area_sqm")
    private BigDecimal areaSqm;

    @Column(name = "crop_id")
    private Long cropId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crop_id", insertable = false, updatable = false)
    private CropDefinition crop;

    @Column(name = "workflow_stage")
    private String workflowStage;

    @Column(name = "planting_date")
    private LocalDate plantingDate;

    @Column(name = "expected_harvest_date")
    private LocalDate expectedHarvestDate;

    @Column(name = "boundary_coordinates", columnDefinition = "TEXT")
    private String boundaryCoordinates;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (workflowStage == null) {
            workflowStage = "EMPTY";
        }
    }
}
