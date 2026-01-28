package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Notification Entity - Thông báo
 */
@Entity
@Table(name = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "field_id")
    private Long fieldId;

    @Column(nullable = false)
    private String type; // WATER_REMINDER, FERTILIZE_REMINDER, HARVEST_READY, PEST_ALERT,
                         // WEATHER_WARNING

    @Column(nullable = false)
    private String title;

    private String message;

    @Column(name = "is_read")
    private Boolean isRead;

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isRead == null) {
            isRead = false;
        }
    }
}
