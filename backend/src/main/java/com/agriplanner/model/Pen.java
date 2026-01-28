package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Pen Entity - Represents a cage, pond, or facility for raising animals
 */
@Entity
@Table(name = "pens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pen {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "farm_id")
    private Long farmId;

    @Column(name = "facility_id")
    private Long facilityId;

    // Pen code/name (A1, B2, etc.)
    private String code;

    // Maximum capacity
    private Integer capacity;

    // CAGED, POND, FREE_RANGE, SPECIAL
    @Column(name = "farming_type")
    private String farmingType;

    // For POND: FRESHWATER, BRACKISH, SALTWATER
    @Column(name = "water_type")
    private String waterType;

    // Dimensions
    @Column(name = "length_m")
    private BigDecimal lengthM;

    @Column(name = "width_m")
    private BigDecimal widthM;

    @Column(name = "area_sqm")
    private BigDecimal areaSqm;

    // Animal information
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "animal_definition_id")
    private AnimalDefinition animalDefinition;

    @Column(name = "animal_count")
    private Integer animalCount;

    // SMALL, MEDIUM, LARGE
    @Column(name = "animal_size")
    private String animalSize;

    // Timeline
    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "expected_harvest_date")
    private LocalDate expectedHarvestDate;

    // EMPTY, CLEAN, DIRTY, SICK
    @Builder.Default
    private String status = "EMPTY";

    // Total investment cost
    @Column(name = "total_investment")
    private BigDecimal totalInvestment;

    // Feeding tracking
    @Column(name = "last_fed_at")
    private LocalDateTime lastFedAt;

    @Column(name = "next_feeding_at")
    private LocalDateTime nextFeedingAt;

    // PENDING, FED, OVERDUE
    @Column(name = "feeding_status")
    @Builder.Default
    private String feedingStatus = "PENDING";
}
