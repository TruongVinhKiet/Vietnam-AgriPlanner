package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * UtilitySetting - Stores electricity & water configuration per pen.
 * Used to estimate monthly utility costs for livestock operations.
 */
@Entity
@Table(name = "utility_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UtilitySetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pen_id")
    private Long penId;

    @Column(name = "field_id")
    private Long fieldId;

    @Column(name = "farm_id")
    private Long farmId;

    /** Electricity power consumption in kW */
    @Column(name = "power_kw", precision = 10, scale = 2)
    private BigDecimal powerKw;

    /** Electricity rate in VND per kWh */
    @Column(name = "electricity_rate", precision = 15, scale = 2)
    private BigDecimal electricityRate;

    /** Daily water consumption in cubic meters */
    @Column(name = "water_m3_per_day", precision = 10, scale = 2)
    private BigDecimal waterM3PerDay;

    /** Water rate in VND per cubic meter */
    @Column(name = "water_rate", precision = 15, scale = 2)
    private BigDecimal waterRate;

    /** Hours of operation per day */
    @Column(name = "hours_per_day")
    private Integer hoursPerDay;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Calculate estimated monthly electricity cost.
     * Formula: powerKw * hoursPerDay * 30 * electricityRate
     */
    public BigDecimal getMonthlyElectricityCost() {
        if (powerKw == null || electricityRate == null || hoursPerDay == null)
            return BigDecimal.ZERO;
        return powerKw
                .multiply(BigDecimal.valueOf(hoursPerDay))
                .multiply(BigDecimal.valueOf(30))
                .multiply(electricityRate);
    }

    /**
     * Calculate estimated monthly water cost.
     * Formula: waterM3PerDay * 30 * waterRate
     */
    public BigDecimal getMonthlyWaterCost() {
        if (waterM3PerDay == null || waterRate == null)
            return BigDecimal.ZERO;
        return waterM3PerDay
                .multiply(BigDecimal.valueOf(30))
                .multiply(waterRate);
    }

    /**
     * Total estimated monthly utility cost.
     */
    public BigDecimal getMonthlyTotalCost() {
        return getMonthlyElectricityCost().add(getMonthlyWaterCost());
    }
}
