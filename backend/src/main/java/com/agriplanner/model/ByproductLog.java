package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * ByproductLog Entity - Tracks daily byproduct output (eggs, milk, honey, silk)
 */
@Entity
@Table(name = "byproduct_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ByproductLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pen_id", nullable = false)
    private Long penId;

    // EGGS, MILK, HONEY, SILK
    @Column(name = "product_type", nullable = false)
    private String productType;

    @Column(nullable = false)
    private BigDecimal quantity;

    @Column(nullable = false)
    private String unit; // quả, lít, kg

    @Column(name = "recorded_date", nullable = false)
    private LocalDate recordedDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (recordedDate == null) recordedDate = LocalDate.now();
    }
}
