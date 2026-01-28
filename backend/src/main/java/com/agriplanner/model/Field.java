package com.agriplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Field Entity - Represents a farm plot/field
 */
@Entity
@Table(name = "fields")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Field {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "farm_id")
    private Long farmId;

    @Column(nullable = false)
    private String name;

    @Column(name = "area_sqm")
    private BigDecimal areaSqm;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "boundary_coordinates", columnDefinition = "jsonb")
    private String boundaryCoordinates; // JSON array of [lat, lng] coordinates

    @Column(name = "soil_type")
    private String soilType;

    @Column(length = 50)
    private String status; // ACTIVE, FALLOW, PREPARING

    @Enumerated(EnumType.STRING)
    @Column(name = "condition", length = 20)
    @Builder.Default
    private FieldCondition condition = FieldCondition.GOOD;

    @Column(name = "current_crop_id")
    private Long currentCropId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_crop_id", insertable = false, updatable = false)
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    private CropDefinition currentCrop;

    @Column(name = "planting_date")
    private LocalDate plantingDate;

    @Column(name = "expected_harvest_date")
    private LocalDate expectedHarvestDate;

    @Column(name = "actual_harvest_date")
    private LocalDate actualHarvestDate;

    @Column(name = "total_investment")
    private BigDecimal totalInvestment;

    // Workflow fields
    @Column(name = "workflow_stage", length = 30)
    private String workflowStage; // EMPTY, CROP_SELECTED, FERTILIZED, SEEDED, GROWING, READY_HARVEST, HARVESTED

    @Column(name = "last_watered_at")
    private java.time.LocalDateTime lastWateredAt;

    @Column(name = "last_fertilized_at")
    private java.time.LocalDateTime lastFertilizedAt;

    @Column(name = "last_pesticide_at")
    private java.time.LocalDateTime lastPesticideAt;

    @Column(name = "fertilizer_id")
    private Long fertilizerId;

    @Column(name = "seeding_date")
    private LocalDate seedingDate;

    @Column(name = "seeding_quantity")
    private BigDecimal seedingQuantity;

    @Column(name = "seeding_cost")
    private BigDecimal seedingCost;

    // Harvest timing fields
    @Column(name = "harvesting_started_at")
    private java.time.LocalDateTime harvestingStartedAt;

    @Column(name = "harvesting_duration_minutes")
    private Integer harvestingDurationMinutes;

    @Column(name = "harvesting_machinery_id")
    private Long harvestingMachineryId;

    @Column(name = "harvesting_cost")
    private BigDecimal harvestingCost;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private java.time.LocalDateTime createdAt;
}
