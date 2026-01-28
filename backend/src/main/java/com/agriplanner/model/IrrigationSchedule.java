package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Irrigation Schedule Entity - Lịch tưới
 */
@Entity
@Table(name = "irrigation_schedules")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IrrigationSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "field_id")
    private Long fieldId;

    @Column(name = "schedule_type", nullable = false)
    private String scheduleType; // DAILY, EVERY_OTHER_DAY, WEEKLY, CUSTOM

    @Column(name = "time_of_day")
    private LocalTime timeOfDay;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "water_amount_liters")
    private BigDecimal waterAmountLiters;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "last_irrigated_at")
    private LocalDateTime lastIrrigatedAt;

    @Column(name = "next_irrigation_at")
    private LocalDateTime nextIrrigationAt;

    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isActive == null) {
            isActive = true;
        }
        if (timeOfDay == null) {
            timeOfDay = LocalTime.of(6, 0);
        }
        if (durationMinutes == null) {
            durationMinutes = 30;
        }
    }
}
