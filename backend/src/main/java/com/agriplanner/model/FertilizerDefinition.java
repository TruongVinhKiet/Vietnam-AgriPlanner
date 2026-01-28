package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Fertilizer Definition Entity
 */
@Entity
@Table(name = "fertilizer_definitions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FertilizerDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String type; // organic, inorganic, bio

    @Column(name = "suitable_crops", columnDefinition = "TEXT")
    private String suitableCrops; // JSON array

    @Column(name = "application_rate")
    private BigDecimal applicationRate; // kg per sqm

    @Column(name = "cost_per_kg")
    private BigDecimal costPerKg;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(columnDefinition = "TEXT")
    private String ingredients; // Thanh phan: N-P-K...

    @Column(name = "usage_instructions", columnDefinition = "TEXT")
    private String usageInstructions; // Cach dung/Cong dung
}
