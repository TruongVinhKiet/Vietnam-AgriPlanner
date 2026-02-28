package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Animal Definition Entity - Master data for animal types
 * Supports land animals, freshwater, brackish, saltwater, and special
 * environments
 */
@Entity
@Table(name = "animal_definitions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnimalDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "icon_name")
    private String iconName; // Material Symbol icon name

    // LAND, FRESHWATER, BRACKISH, SALTWATER, SPECIAL
    private String category;

    // JSON array: ["CAGED", "POND", "FREE_RANGE", "SPECIAL"]
    @Column(name = "farming_types")
    private String farmingTypes;

    // For POND category, water type: FRESHWATER, BRACKISH, SALTWATER
    @Column(name = "water_type")
    private String waterType;

    // Required space per animal/unit (m²)
    @Column(name = "space_per_unit_sqm")
    private BigDecimal spacePerUnitSqm;

    // JSON: {"small": {"weight": "0.5-1kg", "buyPrice": 50000, "sellPrice": 80000},
    // "medium": {...}, "large": {...}}
    @Column(columnDefinition = "TEXT")
    private String sizes;

    // Days to raise before sale
    @Column(name = "growth_duration_days")
    private Integer growthDurationDays;

    // Average market buy price per unit (VND)
    @Column(name = "buy_price_per_unit")
    private BigDecimal buyPricePerUnit;

    // Average market sell price per unit (VND)
    @Column(name = "sell_price_per_unit")
    private BigDecimal sellPricePerUnit;

    // Unit of measurement (con, kg, etc.)
    private String unit;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Image URL for the animal
    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    // ====== ENVIRONMENT & HEALTH PARAMETERS ======

    @Column(name = "ideal_temp_min")
    private Integer idealTempMin; // Minimum ideal temperature (°C)

    @Column(name = "ideal_temp_max")
    private Integer idealTempMax; // Maximum ideal temperature (°C)

    @Column(name = "ideal_humidity_min")
    private Integer idealHumidityMin; // Minimum ideal humidity (%)

    @Column(name = "ideal_humidity_max")
    private Integer idealHumidityMax; // Maximum ideal humidity (%)

    @Column(name = "survival_rate")
    private BigDecimal survivalRate; // Expected survival rate (%)

    @Column(name = "maturity_age_days")
    private Integer maturityAgeDays; // Age to reach reproductive maturity (days)

    @Column(name = "common_diseases", columnDefinition = "TEXT")
    private String commonDiseases; // JSON array of common diseases

    @Column(name = "ideal_ph_min")
    private BigDecimal idealPhMin; // Minimum ideal water pH (aquatic)

    @Column(name = "ideal_ph_max")
    private BigDecimal idealPhMax; // Maximum ideal water pH (aquatic)
}
