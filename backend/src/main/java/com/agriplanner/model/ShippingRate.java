package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "shipping_rates")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShippingRate {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "shipping_type", unique = true, nullable = false)
    @Enumerated(EnumType.STRING)
    private Order.ShippingType shippingType;
    
    @Column(name = "display_name", nullable = false)
    private String displayName;
    
    @Column(name = "base_fee", nullable = false)
    private BigDecimal baseFee;
    
    @Column(name = "fee_per_km", nullable = false)
    private BigDecimal feePerKm;
    
    @Column(name = "fee_per_kg", nullable = false)
    private BigDecimal feePerKg;
    
    @Column(name = "min_days", nullable = false)
    private Integer minDays;
    
    @Column(name = "max_days", nullable = false)
    private Integer maxDays;
    
    @Column(name = "speed_km_per_day", nullable = false)
    private BigDecimal speedKmPerDay;
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    @Column(name = "created_at")
    @Builder.Default
    private ZonedDateTime createdAt = ZonedDateTime.now();
    
    /**
     * Calculate shipping fee based on distance and weight
     * Formula: base_fee + (distance_km * fee_per_km) + (weight_kg * fee_per_kg)
     */
    public BigDecimal calculateFee(BigDecimal distanceKm, BigDecimal weightKg) {
        BigDecimal distanceFee = distanceKm.multiply(feePerKm);
        BigDecimal weightFee = weightKg.multiply(feePerKg);
        return baseFee.add(distanceFee).add(weightFee);
    }
}
