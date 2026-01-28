package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Farming Activity Entity - Logs farm operations
 */
@Entity
@Table(name = "farming_activities")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FarmingActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "field_id")
    private Long fieldId;

    @Column(name = "activity_type", nullable = false)
    private String activityType; // WATERING, FERTILIZING, PESTICIDE, HARVEST, PLANTING, MACHINERY

    private String description;

    private BigDecimal quantity;

    private String unit;

    private BigDecimal cost;

    @Column(name = "performed_at")
    private LocalDateTime performedAt;

    @Column(name = "performed_by")
    private Long performedBy;

    private String notes;

    @PrePersist
    protected void onCreate() {
        performedAt = LocalDateTime.now();
    }
}
