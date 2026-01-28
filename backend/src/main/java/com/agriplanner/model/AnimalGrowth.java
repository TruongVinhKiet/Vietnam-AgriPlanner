package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "animal_growth")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnimalGrowth {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pen_id", nullable = false)
    private Long penId;

    @Column(name = "recorded_date", nullable = false)
    private LocalDate recordedDate;

    @Column(name = "avg_weight_kg", nullable = false)
    private BigDecimal avgWeightKg;

    @Column(name = "total_weight_kg")
    private BigDecimal totalWeightKg;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
