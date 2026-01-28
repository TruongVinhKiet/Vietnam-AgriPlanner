package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Pest Detection Entity - Phát hiện sâu bệnh
 */
@Entity
@Table(name = "pest_detections")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PestDetection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "field_id")
    private Long fieldId;

    @Column(name = "pest_name", nullable = false)
    private String pestName;

    private String severity; // LOW, MEDIUM, HIGH, CRITICAL

    @Column(name = "detected_at")
    private LocalDateTime detectedAt;

    @Column(name = "treatment_applied")
    private String treatmentApplied;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    private String notes;

    @PrePersist
    protected void onCreate() {
        detectedAt = LocalDateTime.now();
        if (severity == null) {
            severity = "LOW";
        }
    }
}
