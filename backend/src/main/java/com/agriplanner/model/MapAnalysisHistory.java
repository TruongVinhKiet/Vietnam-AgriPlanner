package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Entity để lưu lịch sử phân tích bản đồ AI
 * Cho phép admin quản lý và xóa các kết quả phân tích
 */
@Entity
@Table(name = "map_analysis_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MapAnalysisHistory {

    @Id
    @Column(name = "analysis_id", length = 50)
    private String analysisId;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "map_type", length = 20)
    private String mapType; // "soil" or "planning"

    @Column(length = 100)
    private String province;

    @Column(length = 100)
    private String district;

    @Column(name = "zone_count")
    private Integer zoneCount = 0;

    @Column(length = 20)
    private String status = "pending"; // "pending", "completed", "deleted"

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "original_image_path", columnDefinition = "TEXT")
    private String originalImagePath;

    @Column(name = "overlay_image_path", columnDefinition = "TEXT")
    private String overlayImagePath;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
