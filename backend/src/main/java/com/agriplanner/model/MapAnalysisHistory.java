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

    // =====================================================
    // Georeferencing - 4 Control Points (like Global Mapper)
    // =====================================================

    // Control Point 1 (typically top-left)
    @Column(name = "point1_pixel_x")
    private Integer point1PixelX;
    @Column(name = "point1_pixel_y")
    private Integer point1PixelY;
    @Column(name = "point1_lat")
    private Double point1Lat;
    @Column(name = "point1_lng")
    private Double point1Lng;

    // Control Point 2 (typically top-right)
    @Column(name = "point2_pixel_x")
    private Integer point2PixelX;
    @Column(name = "point2_pixel_y")
    private Integer point2PixelY;
    @Column(name = "point2_lat")
    private Double point2Lat;
    @Column(name = "point2_lng")
    private Double point2Lng;

    // Control Point 3 (typically bottom-left)
    @Column(name = "point3_pixel_x")
    private Integer point3PixelX;
    @Column(name = "point3_pixel_y")
    private Integer point3PixelY;
    @Column(name = "point3_lat")
    private Double point3Lat;
    @Column(name = "point3_lng")
    private Double point3Lng;

    // Control Point 4 (typically bottom-right)
    @Column(name = "point4_pixel_x")
    private Integer point4PixelX;
    @Column(name = "point4_pixel_y")
    private Integer point4PixelY;
    @Column(name = "point4_lat")
    private Double point4Lat;
    @Column(name = "point4_lng")
    private Double point4Lng;

    // Computed bounds for Leaflet ImageOverlay
    @Column(name = "bounds_sw_lat")
    private Double boundsSWLat;
    @Column(name = "bounds_sw_lng")
    private Double boundsSWLng;
    @Column(name = "bounds_ne_lat")
    private Double boundsNELat;
    @Column(name = "bounds_ne_lng")
    private Double boundsNELng;

    // Image dimensions
    @Column(name = "image_width")
    private Integer imageWidth;
    @Column(name = "image_height")
    private Integer imageHeight;

    // Total area in hectares
    // Total area in hectares
    @Column(name = "total_area_hectares")
    private Double totalAreaHectares;

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
