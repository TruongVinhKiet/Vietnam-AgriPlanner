package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Pest Definition Entity - Định nghĩa sâu bệnh
 */
@Entity
@Table(name = "pest_definitions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PestDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "scientific_name")
    private String scientificName;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String treatment;

    @Column(columnDefinition = "TEXT")
    private String prevention;

    private String severity; // LOW, MEDIUM, HIGH, CRITICAL
}
