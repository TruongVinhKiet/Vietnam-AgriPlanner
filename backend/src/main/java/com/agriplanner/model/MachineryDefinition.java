package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Machinery Definition Entity
 */
@Entity
@Table(name = "machinery_definitions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MachineryDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String type; // harvest, tillage, planting

    @Column(name = "suitable_crops", columnDefinition = "TEXT")
    private String suitableCrops; // JSON array

    @Column(name = "efficiency_rate")
    private BigDecimal efficiencyRate; // hectares per hour

    @Column(name = "rental_cost_per_hour")
    private BigDecimal rentalCostPerHour;

    @Column(columnDefinition = "TEXT")
    private String description;
}
