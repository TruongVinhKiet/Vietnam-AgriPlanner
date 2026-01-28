package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Crop Definition Entity - Master data for crop types
 */
@Entity
@Table(name = "crop_definitions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CropDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    private String category; // GRAIN, FRUIT, VEGETABLE, LEGUME, INDUSTRIAL

    @Column(name = "ideal_temp_range")
    private String idealTempRange;

    @Column(name = "ideal_humidity_range")
    private String idealHumidityRange;

    @Column(name = "growth_duration_days")
    private Integer growthDurationDays;

    @Column(name = "seeds_per_sqm")
    private BigDecimal seedsPerSqm;

    @Column(name = "seed_cost_per_kg")
    private BigDecimal seedCostPerKg;

    @Column(name = "care_cost_per_sqm")
    private BigDecimal careCostPerSqm;

    @Column(name = "expected_yield_per_sqm")
    private BigDecimal expectedYieldPerSqm;

    @Column(name = "market_price_per_kg")
    private BigDecimal marketPricePerKg;

    @Column(name = "min_temp")
    private Integer minTemp;

    @Column(name = "max_temp")
    private Integer maxTemp;

    @Column(name = "avoid_weather")
    private String avoidWeather;

    @Column(name = "ideal_seasons")
    private String idealSeasons;

    @Column(name = "common_pests")
    private String commonPests;

    @Column(name = "water_needs")
    private String waterNeeds; // LOW, MEDIUM, HIGH

    @Column(name = "soil_type_preferred")
    private String soilTypePreferred;

    @Column(columnDefinition = "TEXT")
    private String description;

    // ====== TIMING COLUMNS FOR FARM MANAGEMENT ======

    @Column(name = "fertilizer_interval_days")
    private Integer fertilizerIntervalDays; // Days between fertilizing

    @Column(name = "germination_days")
    private Integer germinationDays; // Days for seed to germinate

    @Column(name = "watering_interval_days")
    private Integer wateringIntervalDays; // Days between watering

    @Column(name = "pesticide_interval_days")
    private Integer pesticideIntervalDays; // Days between pesticide application
}
