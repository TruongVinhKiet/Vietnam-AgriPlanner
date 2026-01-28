package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Market Price Entity - Giá thị trường
 */
@Entity
@Table(name = "market_prices")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MarketPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "crop_id")
    private Long cropId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crop_id", insertable = false, updatable = false)
    private CropDefinition crop;

    private String region;

    @Column(name = "price_per_kg", nullable = false)
    private BigDecimal pricePerKg;

    @Column(name = "price_date")
    private LocalDateTime priceDate;

    private String source;

    private String notes;
}
