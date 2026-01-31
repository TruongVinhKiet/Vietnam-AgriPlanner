package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entity representing soil types (loại đất thổ nhưỡng)
 */
@Entity
@Table(name = "soil_types")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SoilType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "default_color", nullable = false, length = 7)
    private String defaultColor;

    @Column(length = 50)
    private String icon;

    // Soil characteristics
    @Column(name = "ph_range", length = 20)
    private String phRange;

    @Column(name = "organic_matter", length = 50)
    private String organicMatter;

    @Column(length = 50)
    private String texture;

    @Column(length = 50)
    private String drainage;

    @Column(length = 20)
    private String fertility;

    @Column(name = "suitable_crops", columnDefinition = "TEXT")
    private String suitableCrops;

    @Column(columnDefinition = "TEXT")
    private String limitations;
}
